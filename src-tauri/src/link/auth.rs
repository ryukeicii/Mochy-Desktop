// how paired devices prove a call is theirs, the same way the android app's LinkAuth does: an hmac over the call with
// the time and a nonce, so a call someone copied off the wi-fi is no good to them, and pairing that never sends the key

use super::http::{equal_secret, percent_decode_path, Request};
use base64::Engine;
use ring::agreement::{self, EphemeralPrivateKey, UnparsedPublicKey, ECDH_P256};
use ring::rand::{SecureRandom, SystemRandom};
use ring::{digest, hmac};
use std::collections::{BTreeMap, HashMap, HashSet, VecDeque};

pub const HEADER: &str = "x-mochy-auth";
// the header protocol 1 carried the key itself in; only looked for, so an old device hears "update" instead of "unpaired"
pub const OLD_KEY_HEADER: &str = "x-mochy-key";
const SCHEME: &str = "v2";
// a phone's clock and this computer's can drift a little; past this the call is turned away
const WINDOW_MS: i64 = 10 * 60_000;
// a song or cover link a player opens stays good this long, longer than any song takes
pub const LINK_GOOD_FOR_MS: i64 = 12 * 60 * 60_000;
const LINK_FIELDS: [&str; 3] = ["d", "e", "s"];
const SEEN_KEPT: usize = 2048;
// the der head java puts in front of a p-256 point when it writes a public key out
const SPKI_P256_HEAD: [u8; 26] = [
    0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
];

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

fn random_hex(len: usize) -> String {
    let mut bytes = vec![0u8; len];
    let _ = SystemRandom::new().fill(&mut bytes);
    hex(&bytes)
}

// the call written out the one way both sides agree on, so what's signed is what's checked
fn canonical(method: &str, path: &str, query: &HashMap<String, String>, time: i64, nonce: &str, body: &[u8]) -> String {
    let fields: BTreeMap<&str, &str> = query.iter().filter(|(k, _)| !LINK_FIELDS.contains(&k.as_str())).map(|(k, v)| (k.as_str(), v.as_str())).collect();
    let fields = fields.iter().map(|(k, v)| format!("{}={}", k, v)).collect::<Vec<_>>().join("&");
    let body_hash = hex(digest::digest(&digest::SHA256, body).as_ref());
    [method.to_ascii_uppercase(), path.to_string(), fields, time.to_string(), nonce.to_string(), body_hash].join("\n")
}

fn sign(key: &str, text: &str) -> String {
    let key = hmac::Key::new(hmac::HMAC_SHA256, key.as_bytes());
    hex(hmac::sign(&key, text.as_bytes()).as_ref())
}

// the header for one call to a paired device, made fresh each time from the url and body it's about to send
pub fn header(me: &str, key: &str, method: &str, url: &str, body: &[u8]) -> String {
    let parsed = url::Url::parse(url).ok();
    let path = parsed.as_ref().map(|u| percent_decode_path(u.path())).unwrap_or_default();
    let query: HashMap<String, String> = parsed.map(|u| u.query_pairs().into_owned().collect()).unwrap_or_default();
    let time = now_ms();
    let nonce = random_hex(12);
    let mac = sign(key, &canonical(method, &path, &query, time, &nonce, body));
    format!("{} {} {} {} {}", SCHEME, me, time, nonce, mac)
}

// the query for a link a player opens with no header of ours; only the path is signed, so a range or a head request is fine
pub fn signed_query(id: &str, key: &str, path: &str, expires_at: i64) -> String {
    let mac = sign(key, &canonical("GET", path, &HashMap::new(), expires_at, "", &[]));
    let id: String = url::form_urlencoded::byte_serialize(id.as_bytes()).collect();
    format!("d={}&e={}&s={}", id, expires_at, mac)
}

// one per server: remembers the nonces it has seen, so a call someone copied can't run twice
#[derive(Default)]
pub struct Verifier {
    seen: HashSet<String>,
    order: VecDeque<String>,
}

impl Verifier {
    // the sender's id when the call checks out against the key key_of gives for that id
    pub fn verify(&mut self, request: &Request, key_of: impl Fn(&str) -> Option<String>) -> Option<String> {
        if request.query.contains_key("s") {
            return verify_link(request, key_of);
        }
        let header = request.header(HEADER)?;
        let parts: Vec<&str> = header.split(' ').collect();
        if parts.len() != 5 || parts[0] != SCHEME {
            return None;
        }
        let (id, nonce) = (parts[1], parts[3]);
        let time: i64 = parts[2].parse().ok()?;
        if (now_ms() - time).abs() > WINDOW_MS {
            return None;
        }
        let key = key_of(id)?;
        let expected = sign(&key, &canonical(&request.method, &request.path, &request.query, time, nonce, &request.body));
        if !equal_secret(&expected, parts[4]) {
            return None;
        }
        // the same call twice is a copy, the first one already ran
        let seen = format!("{}:{}", id, nonce);
        if !self.seen.insert(seen.clone()) {
            return None;
        }
        self.order.push_back(seen);
        if self.order.len() > SEEN_KEPT {
            if let Some(old) = self.order.pop_front() {
                self.seen.remove(&old);
            }
        }
        Some(id.to_string())
    }
}

fn verify_link(request: &Request, key_of: impl Fn(&str) -> Option<String>) -> Option<String> {
    let id = request.query.get("d")?;
    let expires_at: i64 = request.query.get("e")?.parse().ok()?;
    if expires_at < now_ms() {
        return None;
    }
    let key = key_of(id)?;
    let expected = sign(&key, &canonical("GET", &request.path, &HashMap::new(), expires_at, "", &[]));
    equal_secret(&expected, request.query.get("s")?).then(|| id.clone())
}

// pairing: each side makes a key pair and sends only its public half, written the way java writes one
pub fn new_key_pair() -> Option<(EphemeralPrivateKey, String)> {
    let private = EphemeralPrivateKey::generate(&ECDH_P256, &SystemRandom::new()).ok()?;
    let point = private.compute_public_key().ok()?;
    let mut spki = SPKI_P256_HEAD.to_vec();
    spki.extend_from_slice(point.as_ref());
    Some((private, base64::engine::general_purpose::STANDARD.encode(spki)))
}

// both sides end up with the same key from the two halves and the code on the screen; someone who only listened in has neither private half
pub fn shared_key(private: EphemeralPrivateKey, other_public: &str, code: &str, ids: &[&str]) -> Option<String> {
    let der = base64::engine::general_purpose::STANDARD.decode(other_public.trim()).ok()?;
    // the point is the last 65 bytes of java's der, or the whole thing when it came bare
    let point = der.get(der.len().checked_sub(65)?..)?;
    if point[0] != 0x04 {
        return None;
    }
    let mut ids: Vec<&str> = ids.to_vec();
    ids.sort();
    let code = code.trim().to_string();
    agreement::agree_ephemeral(private, &UnparsedPublicKey::new(&ECDH_P256, point), |secret| {
        let mut ctx = digest::Context::new(&digest::SHA256);
        ctx.update(b"mochy-link-v2");
        ctx.update(secret);
        ctx.update(code.as_bytes());
        for id in &ids {
            ctx.update(id.as_bytes());
        }
        hex(ctx.finish().as_ref())
    })
    .ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(method: &str, path: &str, query: &[(&str, &str)], headers: &[(&str, &str)], body: &[u8]) -> Request {
        Request {
            method: method.into(),
            path: path.into(),
            query: query.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            headers: headers.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect(),
            body: body.to_vec(),
            remote: "127.0.0.1".parse().unwrap(),
        }
    }

    #[test]
    fn signed_calls_check_out_once() {
        let auth = header("phone", "secret", "POST", "http://10.0.0.2:47801/control?b=2&a=1", b"{}");
        let req = request("POST", "/control", &[("a", "1"), ("b", "2")], &[(HEADER, &auth)], b"{}");
        let mut verifier = Verifier::default();
        assert_eq!(verifier.verify(&req, |id| (id == "phone").then(|| "secret".to_string())), Some("phone".into()));
        assert_eq!(verifier.verify(&req, |_| Some("secret".into())), None);
        let tampered = request("POST", "/control", &[("a", "1"), ("b", "2")], &[(HEADER, &auth)], b"{\"x\":1}");
        assert_eq!(Verifier::default().verify(&tampered, |_| Some("secret".into())), None);
    }

    #[test]
    fn signed_links_check_out() {
        let query = signed_query("phone", "secret", "/art/pc1", now_ms() + 60_000);
        let pairs: Vec<(String, String)> = url::form_urlencoded::parse(query.as_bytes()).into_owned().collect();
        let pairs: Vec<(&str, &str)> = pairs.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
        let req = request("GET", "/art/pc1", &pairs, &[], b"");
        assert_eq!(Verifier::default().verify(&req, |_| Some("secret".into())), Some("phone".into()));
        let other = request("GET", "/art/pc2", &pairs, &[], b"");
        assert_eq!(Verifier::default().verify(&other, |_| Some("secret".into())), None);
    }

    #[test]
    fn both_sides_work_out_the_same_key() {
        let (a, a_pub) = new_key_pair().unwrap();
        let (b, b_pub) = new_key_pair().unwrap();
        let one = shared_key(a, &b_pub, "123456", &["x", "y"]).unwrap();
        let two = shared_key(b, &a_pub, " 123456 ", &["y", "x"]).unwrap();
        assert_eq!(one, two);
        assert_eq!(one.len(), 64);
    }
}
