// a very small http/1.1 server, one request per connection, the same shape as the android LinkHttpServer so both sides speak alike

use std::collections::HashMap;
use std::future::Future;
use std::net::{IpAddr, SocketAddr};
use std::path::PathBuf;
use std::pin::Pin;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt, BufWriter};
use tokio::net::{TcpListener, TcpStream};
use tokio::task::JoinHandle;

const MAX_HEAD: usize = 32 * 1024;
const MAX_BODY: usize = 8 * 1024 * 1024;
const READ_TIMEOUT: Duration = Duration::from_secs(15);

pub const KEY_HEADER: &str = "x-mochy-key";

// one request as the link server reads it: the path without its query, the query split up, headers in lowercase
#[derive(Debug, Clone)]
pub struct Request {
    pub method: String,
    pub path: String,
    pub query: HashMap<String, String>,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
    pub remote: IpAddr,
}

impl Request {
    pub fn header(&self, name: &str) -> Option<&str> {
        self.headers.get(&name.to_ascii_lowercase()).map(|s| s.as_str())
    }

    // the key a paired device sends, in the header for api calls or the link itself for a song a player streams
    pub fn key(&self) -> Option<&str> {
        self.header(KEY_HEADER).or_else(|| self.query.get("k").map(|s| s.as_str()))
    }

    pub fn json(&self) -> serde_json::Value {
        if self.body.is_empty() {
            return serde_json::Value::Object(Default::default());
        }
        serde_json::from_slice(&self.body).unwrap_or_else(|_| serde_json::Value::Object(Default::default()))
    }

    pub fn remote_host(&self) -> String {
        match self.remote {
            IpAddr::V6(v6) => v6.to_ipv4_mapped().map(|v4| v4.to_string()).unwrap_or_else(|| v6.to_string()),
            IpAddr::V4(v4) => v4.to_string(),
        }
    }
}

pub enum Body {
    Bytes(Vec<u8>),
    // a slice of a file on disk, read in chunks so a long flac never sits in memory
    File { path: PathBuf, start: u64, len: u64 },
}

pub struct Response {
    pub status: u16,
    pub content_type: String,
    pub headers: Vec<(String, String)>,
    pub body: Body,
}

impl Response {
    pub fn bytes(bytes: Vec<u8>, content_type: &str) -> Self {
        Self { status: 200, content_type: content_type.to_string(), headers: Vec::new(), body: Body::Bytes(bytes) }
    }

    pub fn json(value: &serde_json::Value) -> Self {
        Self::bytes(value.to_string().into_bytes(), "application/json; charset=utf-8")
    }

    pub fn ok() -> Self {
        Self::bytes(b"{}".to_vec(), "application/json; charset=utf-8")
    }

    pub fn status(status: u16, message: &str) -> Self {
        Self { status, content_type: "text/plain; charset=utf-8".into(), headers: Vec::new(), body: Body::Bytes(message.as_bytes().to_vec()) }
    }

    pub fn with_header(mut self, name: &str, value: &str) -> Self {
        self.headers.push((name.to_string(), value.to_string()));
        self
    }

    // a file answered whole, or as the byte range the player asked for
    pub fn ranged_file(range: Option<&str>, path: PathBuf, total: u64, content_type: &str) -> Self {
        match parse_range(range, total) {
            None => Self {
                status: 200,
                content_type: content_type.to_string(),
                headers: vec![("Accept-Ranges".into(), "bytes".into())],
                body: Body::File { path, start: 0, len: total },
            },
            Some((start, end)) if start >= total || start > end => Self {
                status: 416,
                content_type: content_type.to_string(),
                headers: vec![("Content-Range".into(), format!("bytes */{}", total))],
                body: Body::Bytes(Vec::new()),
            },
            Some((start, end)) => Self {
                status: 206,
                content_type: content_type.to_string(),
                headers: vec![
                    ("Accept-Ranges".into(), "bytes".into()),
                    ("Content-Range".into(), format!("bytes {}-{}/{}", start, end, total)),
                ],
                body: Body::File { path, start, len: end - start + 1 },
            },
        }
    }

    fn length(&self) -> u64 {
        match &self.body {
            Body::Bytes(b) => b.len() as u64,
            Body::File { len, .. } => *len,
        }
    }
}

// "bytes=100-", "bytes=100-199" or "bytes=-500", the only kinds a media player sends
pub fn parse_range(header: Option<&str>, total: u64) -> Option<(u64, u64)> {
    let trimmed = header?.trim();
    let spec = trimmed.strip_prefix("bytes=")?;
    let first = spec.split(',').next()?.trim();
    let (start_text, end_text) = first.split_once('-')?;
    let (start_text, end_text) = (start_text.trim(), end_text.trim());
    if total == 0 {
        return Some((1, 0));
    }
    if start_text.is_empty() {
        let suffix: u64 = end_text.parse().ok()?;
        return Some((total.saturating_sub(suffix), total - 1));
    }
    let start: u64 = start_text.parse().ok()?;
    let end = end_text.parse::<u64>().ok().map(|e| e.min(total - 1)).unwrap_or(total - 1);
    Some((start, end))
}

pub fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        204 => "No Content",
        206 => "Partial Content",
        400 => "Bad Request",
        401 => "Unauthorized",
        403 => "Forbidden",
        404 => "Not Found",
        409 => "Conflict",
        416 => "Range Not Satisfiable",
        _ => "Error",
    }
}

fn percent_decode_path(path: &str) -> String {
    // paths keep '+' as a plus, only %xx is undone
    let bytes = path.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    let hex = |b: u8| (b as char).to_digit(16).map(|d| d as u8);
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(hi), Some(lo)) = (hex(bytes[i + 1]), hex(bytes[i + 2])) {
                out.push(hi * 16 + lo);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

pub type Handler = Arc<dyn Fn(Request) -> Pin<Box<dyn Future<Output = Response> + Send>> + Send + Sync>;

pub struct Server {
    pub port: u16,
    task: JoinHandle<()>,
}

impl Server {
    // binds the preferred port when it's free, otherwise any port; the other side finds it through mdns anyway
    pub async fn start(preferred: u16, handler: Handler) -> std::io::Result<Self> {
        let listener = match TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], preferred))).await {
            Ok(l) => l,
            Err(_) => TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], 0))).await?,
        };
        let port = listener.local_addr()?.port();
        let task = tokio::spawn(async move {
            loop {
                let Ok((socket, addr)) = listener.accept().await else { continue };
                let handler = handler.clone();
                tokio::spawn(async move {
                    let _ = serve(socket, addr.ip(), handler).await;
                });
            }
        });
        Ok(Self { port, task })
    }

}

impl Drop for Server {
    fn drop(&mut self) {
        self.task.abort();
    }
}

async fn serve(mut socket: TcpStream, remote: IpAddr, handler: Handler) -> std::io::Result<()> {
    let _ = socket.set_nodelay(true);
    let request = match tokio::time::timeout(READ_TIMEOUT, read_request(&mut socket, remote)).await {
        Ok(Ok(Some(r))) => r,
        _ => return Ok(()),
    };
    let is_head = request.method == "HEAD";
    let response = handler(request).await;
    write_response(&mut socket, response, is_head).await
}

async fn read_request(socket: &mut TcpStream, remote: IpAddr) -> std::io::Result<Option<Request>> {
    let mut buf: Vec<u8> = Vec::with_capacity(4096);
    let mut chunk = [0u8; 4096];
    let head_end = loop {
        if let Some(pos) = find(&buf, b"\r\n\r\n") {
            break pos;
        }
        if buf.len() > MAX_HEAD {
            return Ok(None);
        }
        let n = socket.read(&mut chunk).await?;
        if n == 0 {
            return Ok(None);
        }
        buf.extend_from_slice(&chunk[..n]);
    };
    let head = String::from_utf8_lossy(&buf[..head_end]).into_owned();
    let mut lines = head.split("\r\n");
    let request_line = lines.next().unwrap_or_default();
    let mut parts = request_line.split(' ');
    let method = parts.next().unwrap_or("GET").to_ascii_uppercase();
    let target = parts.next().unwrap_or("/").to_string();
    let mut headers = HashMap::new();
    for line in lines {
        if let Some((k, v)) = line.split_once(':') {
            headers.insert(k.trim().to_ascii_lowercase(), v.trim().to_string());
        }
    }
    let length = headers
        .get("content-length")
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(0)
        .min(MAX_BODY);
    let mut body = buf[head_end + 4..].to_vec();
    while body.len() < length {
        let n = socket.read(&mut chunk).await?;
        if n == 0 {
            break;
        }
        body.extend_from_slice(&chunk[..n]);
    }
    body.truncate(length);
    let (raw_path, raw_query) = target.split_once('?').unwrap_or((target.as_str(), ""));
    let path = percent_decode_path(raw_path);
    let query = url::form_urlencoded::parse(raw_query.as_bytes())
        .map(|(k, v)| (k.into_owned(), v.into_owned()))
        .collect();
    Ok(Some(Request { method, path, query, headers, body, remote }))
}

fn find(haystack: &[u8], needle: &[u8]) -> Option<usize> {
    haystack.windows(needle.len()).position(|w| w == needle)
}

pub async fn write_response(socket: &mut TcpStream, response: Response, is_head: bool) -> std::io::Result<()> {
    let mut out = BufWriter::with_capacity(64 * 1024, socket);
    let mut head = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nConnection: close\r\nAccess-Control-Allow-Origin: *\r\nContent-Length: {}\r\n",
        response.status,
        reason(response.status),
        response.content_type,
        response.length()
    );
    for (k, v) in &response.headers {
        head.push_str(k);
        head.push_str(": ");
        head.push_str(v);
        head.push_str("\r\n");
    }
    head.push_str("\r\n");
    out.write_all(head.as_bytes()).await?;
    if !is_head {
        match response.body {
            Body::Bytes(bytes) => out.write_all(&bytes).await?,
            Body::File { path, start, len } => {
                let mut file = tokio::fs::File::open(&path).await?;
                file.seek(std::io::SeekFrom::Start(start)).await?;
                let mut left = len;
                let mut buffer = vec![0u8; 64 * 1024];
                while left > 0 {
                    let want = (buffer.len() as u64).min(left) as usize;
                    let n = file.read(&mut buffer[..want]).await?;
                    if n == 0 {
                        break;
                    }
                    // a player that seeks drops the old connection halfway through a song, nothing to report there
                    out.write_all(&buffer[..n]).await?;
                    left -= n as u64;
                }
            }
        }
    }
    out.flush().await?;
    Ok(())
}

pub fn equal_secret(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ranges() {
        assert_eq!(parse_range(Some("bytes=0-"), 100), Some((0, 99)));
        assert_eq!(parse_range(Some("bytes=10-19"), 100), Some((10, 19)));
        assert_eq!(parse_range(Some("bytes=90-500"), 100), Some((90, 99)));
        assert_eq!(parse_range(Some("bytes=-30"), 100), Some((70, 99)));
        assert_eq!(parse_range(Some("bytes=-300"), 100), Some((0, 99)));
        assert_eq!(parse_range(None, 100), None);
        assert_eq!(parse_range(Some("items=1-2"), 100), None);
    }

    #[test]
    fn decode_paths() {
        assert_eq!(percent_decode_path("/file/abc%2Fdef"), "/file/abc/def");
        assert_eq!(percent_decode_path("/file/a+b"), "/file/a+b");
        assert_eq!(percent_decode_path("/x%"), "/x%");
    }

    #[test]
    fn secrets() {
        assert!(equal_secret("123456", "123456"));
        assert!(!equal_secret("123456", "123457"));
        assert!(!equal_secret("12345", "123456"));
    }
}
