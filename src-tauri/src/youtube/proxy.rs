use crate::link::http::{write_response, Response};
use crate::link::LinkHub;
use crate::local::LocalMusic;
use crate::youtube::innertube::InnerTube;
use futures_util::StreamExt;
use std::path::PathBuf;
use std::sync::Arc;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

// what the page plays and shows goes through here: youtube's streams and covers, this computer's own song files,
// and a paired device's files, so the page never needs a key or an address on the wi-fi
#[derive(Clone)]
pub struct ProxyContext {
    pub innertube: Arc<InnerTube>,
    pub local: Arc<LocalMusic>,
    pub link: Arc<LinkHub>,
}

pub async fn start_proxy(ctx: ProxyContext) -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0")
        .await
        .expect("Failed to bind local stream proxy");
    let port = listener.local_addr().unwrap().port();
    ctx.innertube.set_proxy_port(port).await;

    tokio::spawn(async move {
        loop {
            if let Ok((stream, _)) = listener.accept().await {
                let ctx = ctx.clone();
                tokio::spawn(async move {
                    let _ = handle_connection(stream, ctx).await;
                });
            }
        }
    });

    port
}

async fn handle_connection(
    mut socket: TcpStream,
    ctx: ProxyContext,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut buf = [0u8; 8192];
    let n = socket.read(&mut buf).await?;
    if n == 0 {
        return Ok(());
    }
    let request_str = String::from_utf8_lossy(&buf[..n]);
    let mut lines = request_str.lines();
    let first_line = lines.next().unwrap_or("");
    let mut parts = first_line.split_whitespace();
    let method = parts.next().unwrap_or("GET");
    let path = parts.next().unwrap_or("/");

    if method == "OPTIONS" {
        let resp = "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: GET, HEAD, OPTIONS\r\nAccess-Control-Allow-Headers: Range, Content-Type\r\n\r\n";
        socket.write_all(resp.as_bytes()).await?;
        return Ok(());
    }

    let mut range_header: Option<String> = None;
    for line in lines {
        if line.is_empty() {
            break;
        }
        if let Some((k, v)) = line.split_once(':') {
            if k.trim().eq_ignore_ascii_case("range") {
                range_header = Some(v.trim().to_string());
            }
        }
    }
    let is_head = method == "HEAD";
    let bare = path.split('?').next().unwrap_or(path);

    // a song file on this computer, in whatever range the player asks for
    if let Some(id) = bare.strip_prefix("/local/") {
        let response = match ctx.local.get(id).await {
            Some(track) => Response::ranged_file(range_header.as_deref(), PathBuf::from(&track.path), track.bytes, &track.mime),
            None => Response::status(404, ""),
        };
        write_response(&mut socket, response, is_head).await?;
        return Ok(());
    }

    if let Some(id) = bare.strip_prefix("/art/") {
        let response = match ctx.local.art(id).await {
            Some((bytes, mime)) => Response::bytes(bytes, &mime).with_header("Cache-Control", "public, max-age=86400"),
            None => Response::status(404, ""),
        };
        write_response(&mut socket, response, is_head).await?;
        return Ok(());
    }

    // a paired device's file or cover, fetched by a signed link and passed through as it comes
    let linked = bare
        .strip_prefix("/link/")
        .map(|rest| (rest, "/file/"))
        .or_else(|| bare.strip_prefix("/link-art/").map(|rest| (rest, "/art/")));
    if let Some((rest, kind)) = linked {
        let (device, file) = rest.split_once('/').unwrap_or((rest, ""));
        let target = ctx.link.file_url(device, &format!("{}{}", kind, file)).await;
        let Some(url) = target else {
            write_response(&mut socket, Response::status(503, "device away"), is_head).await?;
            return Ok(());
        };
        let mut req = ctx.link.stream_client().get(&url);
        if let Some(ref r) = range_header {
            req = req.header("Range", r);
        }
        let upstream = req.send().await?;
        pass_through(&mut socket, upstream, is_head, "audio/mp4", None).await?;
        return Ok(());
    }

    if let Some(rest) = path.strip_prefix("/stream/") {
        let video_id = rest.split('?').next().unwrap_or(rest);
        let info = match ctx.innertube.cached_stream(video_id).await {
            Some(s) => s,
            None => ctx.innertube.stream(video_id, true).await?,
        };

        let mut req = ctx.innertube.stream_http.get(&info.url);
        for (k, v) in &info.headers {
            req = req.header(k, v);
        }
        if let Some(ref r) = range_header {
            req = req.header("Range", r);
        }

        let upstream = req.send().await?;
        pass_through(
            &mut socket,
            upstream,
            is_head,
            "audio/mp4",
            info.patched_init.as_deref(),
        )
        .await?;
        return Ok(());
    }

    if let Some(query) = path.strip_prefix("/image?") {
        let mut target_url = None;
        for pair in query.split('&') {
            if let Some((k, v)) = pair.split_once('=') {
                if k == "url" {
                    target_url = url::form_urlencoded::parse(format!("u={}", v).as_bytes())
                        .next()
                        .map(|(_, val)| val.into_owned());
                }
            }
        }
        if let Some(img_url) = target_url {
            if let Ok(upstream) = ctx.innertube.http.get(&img_url).send().await {
                let ct = upstream
                    .headers()
                    .get("content-type")
                    .and_then(|v| v.to_str().ok())
                    .unwrap_or("image/jpeg")
                    .to_string();
                if let Ok(bytes) = upstream.bytes().await {
                    let header = format!(
                        "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nAccess-Control-Allow-Origin: *\r\nCache-Control: public, max-age=86400\r\nConnection: close\r\n\r\n",
                        ct,
                        bytes.len()
                    );
                    socket.write_all(header.as_bytes()).await?;
                    socket.write_all(&bytes).await?;
                    return Ok(());
                }
            }
        }
    }

    let not_found = "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n";
    socket.write_all(not_found.as_bytes()).await?;
    Ok(())
}

// an upstream answer handed on: its status, the headers a player needs for seeking, then the body as it arrives
async fn pass_through(
    socket: &mut TcpStream,
    upstream: reqwest::Response,
    is_head: bool,
    fallback_type: &str,
    patch: Option<&[u8]>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let status = upstream.status();
    let header = |name: &str| upstream.headers().get(name).and_then(|v| v.to_str().ok()).map(str::to_string);
    let content_type = header("content-type").unwrap_or_else(|| fallback_type.to_string());
    let content_length = header("content-length");
    let content_range = header("content-range");
    let mut head = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n",
        status.as_u16(),
        status.canonical_reason().unwrap_or("OK"),
        content_type
    );
    if let Some(cl) = content_length {
        head.push_str(&format!("Content-Length: {}\r\n", cl));
    }
    if let Some(ref cr) = content_range {
        head.push_str(&format!("Content-Range: {}\r\n", cr));
    }
    head.push_str("\r\n");
    socket.write_all(head.as_bytes()).await?;
    if !is_head {
        let mut pos = response_start_offset(status.as_u16(), content_range.as_deref());
        let mut stream = upstream.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let bytes = chunk?;
            let written = match (patch, pos) {
                (Some(p), Some(cur)) if cur < p.len() as u64 => {
                    let mut buf = bytes.to_vec();
                    apply_prefix_patch(&mut buf, cur, p);
                    socket.write_all(&buf).await
                }
                _ => socket.write_all(&bytes).await,
            };
            if written.is_err() {
                break;
            }
            if let Some(ref mut cur) = pos {
                *cur = cur.saturating_add(bytes.len() as u64);
            }
        }
    }
    Ok(())
}

fn response_start_offset(status: u16, content_range: Option<&str>) -> Option<u64> {
    match status {
        200 => Some(0),
        206 => {
            let rest = content_range?.trim().strip_prefix("bytes ")?;
            let (start, _) = rest.split_once('-')?;
            start.trim().parse::<u64>().ok()
        }
        _ => None,
    }
}

fn apply_prefix_patch(buf: &mut [u8], offset: u64, patch: &[u8]) {
    let Ok(start) = usize::try_from(offset) else {
        return;
    };
    if start >= patch.len() {
        return;
    }
    let overlap = buf.len().min(patch.len() - start);
    buf[..overlap].copy_from_slice(&patch[start..start + overlap]);
}

// YouTube's DASH fragmented MP4s (mvex + empty sample tables in moov) write the full song duration into
// mvhd/tkhd/mdhd. CoreMedia/AVFoundation adds those header durations to the moof fragment durations,
// reporting 2x length with trailing silence. Zeroing them in-place matches ISO/IEC 14496-12 without shifting any byte offsets.
pub fn patch_fmp4_init(buf: &mut [u8]) -> Option<usize> {
    let (moov_payload, moov_end) = find_box(buf, 0, buf.len(), *b"moov")?;
    if !has_child_box(buf, moov_payload, moov_end, *b"mvex") {
        return None;
    }
    if moov_has_samples(buf, moov_payload, moov_end) {
        return None;
    }

    let mut changed = false;
    let mut pos = moov_payload;
    while let Some((payload, end, kind)) = read_box(buf, pos, moov_end) {
        match &kind {
            b"mvhd" => changed |= zero_fullbox_duration(&mut buf[payload..end], 16, 24),
            b"trak" => {
                let mut tpos = payload;
                while let Some((tpayload, tend, tkind)) = read_box(buf, tpos, end) {
                    match &tkind {
                        b"tkhd" => changed |= zero_fullbox_duration(&mut buf[tpayload..tend], 20, 28),
                        b"mdia" => {
                            if let Some((mpayload, mend)) = find_box(buf, tpayload, tend, *b"mdhd") {
                                changed |= zero_fullbox_duration(&mut buf[mpayload..mend], 16, 24);
                            }
                        }
                        _ => {}
                    }
                    tpos = tend;
                }
            }
            _ => {}
        }
        pos = end;
    }

    changed.then_some(moov_end)
}

fn read_box(buf: &[u8], pos: usize, limit: usize) -> Option<(usize, usize, [u8; 4])> {
    if pos.checked_add(8)? > limit {
        return None;
    }
    let raw_size = u32::from_be_bytes(buf[pos..pos + 4].try_into().ok()?) as u64;
    let kind: [u8; 4] = buf[pos + 4..pos + 8].try_into().ok()?;
    let (header_len, size) = if raw_size == 1 {
        if pos.checked_add(16)? > limit {
            return None;
        }
        let ext = u64::from_be_bytes(buf[pos + 8..pos + 16].try_into().ok()?);
        (16usize, ext)
    } else if raw_size == 0 {
        return None;
    } else {
        (8usize, raw_size)
    };
    if size < header_len as u64 {
        return None;
    }
    let end = pos.checked_add(usize::try_from(size).ok()?)?;
    if end > limit {
        return None;
    }
    Some((pos + header_len, end, kind))
}

fn find_box(buf: &[u8], start: usize, limit: usize, target: [u8; 4]) -> Option<(usize, usize)> {
    let mut pos = start;
    while let Some((payload, end, kind)) = read_box(buf, pos, limit) {
        if kind == target {
            return Some((payload, end));
        }
        pos = end;
    }
    None
}

fn has_child_box(buf: &[u8], start: usize, limit: usize, target: [u8; 4]) -> bool {
    find_box(buf, start, limit, target).is_some()
}

fn moov_has_samples(buf: &[u8], moov_payload: usize, moov_end: usize) -> bool {
    let mut pos = moov_payload;
    while let Some((payload, end, kind)) = read_box(buf, pos, moov_end) {
        if &kind == b"trak" {
            if let Some((mp, me)) = find_box(buf, payload, end, *b"mdia") {
                if let Some((ip, ie)) = find_box(buf, mp, me, *b"minf") {
                    if let Some((sp, se)) = find_box(buf, ip, ie, *b"stbl") {
                        if let Some((tp, te)) = find_box(buf, sp, se, *b"stts") {
                            if te - tp >= 8
                                && u32::from_be_bytes(buf[tp + 4..tp + 8].try_into().unwrap()) > 0
                            {
                                return true;
                            }
                        }
                        if let Some((zp, ze)) = find_box(buf, sp, se, *b"stsz") {
                            if ze - zp >= 12
                                && u32::from_be_bytes(buf[zp + 8..zp + 12].try_into().unwrap()) > 0
                            {
                                return true;
                            }
                        }
                    }
                }
            }
        }
        pos = end;
    }
    false
}

fn zero_fullbox_duration(payload: &mut [u8], v0_off: usize, v1_off: usize) -> bool {
    if payload.is_empty() {
        return false;
    }
    match payload[0] {
        0 if payload.len() >= v0_off + 4 => {
            let slot = &mut payload[v0_off..v0_off + 4];
            if slot != [0; 4] {
                slot.fill(0);
                return true;
            }
        }
        1 if payload.len() >= v1_off + 8 => {
            let slot = &mut payload[v1_off..v1_off + 8];
            if slot != [0; 8] {
                slot.fill(0);
                return true;
            }
        }
        _ => {}
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mp4_box(kind: &[u8; 4], payload: &[u8]) -> Vec<u8> {
        let mut out = Vec::with_capacity(8 + payload.len());
        out.extend_from_slice(&((8 + payload.len()) as u32).to_be_bytes());
        out.extend_from_slice(kind);
        out.extend_from_slice(payload);
        out
    }

    fn make_fmp4(with_mvex: bool, stts_entries: u32, dur: u32) -> Vec<u8> {
        let ftyp = mp4_box(b"ftyp", b"dash\0\0\0\0iso6mp41");

        let mut mvhd_payload = vec![0u8; 100];
        mvhd_payload[12..16].copy_from_slice(&44100u32.to_be_bytes());
        mvhd_payload[16..20].copy_from_slice(&dur.to_be_bytes());
        let mvhd = mp4_box(b"mvhd", &mvhd_payload);

        let mut tkhd_payload = vec![0u8; 84];
        tkhd_payload[12..16].copy_from_slice(&1u32.to_be_bytes());
        tkhd_payload[20..24].copy_from_slice(&dur.to_be_bytes());
        let tkhd = mp4_box(b"tkhd", &tkhd_payload);

        let mut mdhd_payload = vec![0u8; 24];
        mdhd_payload[12..16].copy_from_slice(&44100u32.to_be_bytes());
        mdhd_payload[16..20].copy_from_slice(&dur.to_be_bytes());
        let mdhd = mp4_box(b"mdhd", &mdhd_payload);

        let mut stts_payload = vec![0u8; 8];
        stts_payload[4..8].copy_from_slice(&stts_entries.to_be_bytes());
        let stts = mp4_box(b"stts", &stts_payload);
        let stsz = mp4_box(b"stsz", &[0u8; 12]);
        let stbl = mp4_box(b"stbl", &[stts, stsz].concat());
        let minf = mp4_box(b"minf", &stbl);
        let mdia = mp4_box(b"mdia", &[mdhd, minf].concat());
        let trak = mp4_box(b"trak", &[tkhd, mdia].concat());

        let mut moov_children = Vec::new();
        moov_children.extend_from_slice(&mvhd);
        if with_mvex {
            moov_children.extend_from_slice(&mp4_box(b"mvex", &mp4_box(b"trex", &[0u8; 24])));
        }
        moov_children.extend_from_slice(&trak);
        let moov = mp4_box(b"moov", &moov_children);

        let mut file = Vec::new();
        file.extend_from_slice(&ftyp);
        file.extend_from_slice(&moov);
        file.extend_from_slice(&mp4_box(b"sidx", &[0u8; 24]));
        file
    }

    #[test]
    fn zeroes_durations_on_fragmented_moov_preserving_size() {
        let mut data = make_fmp4(true, 0, 9_248_633);
        let orig_len = data.len();
        let moov_end = patch_fmp4_init(&mut data).expect("should patch fMP4");
        assert_eq!(data.len(), orig_len);
        assert!(moov_end < orig_len);
        // Running a second time is a no-op since all durations are now 0.
        assert_eq!(patch_fmp4_init(&mut data), None);
    }

    #[test]
    fn skips_non_fragmented_or_non_empty_moov() {
        let mut plain = make_fmp4(false, 0, 9_248_633);
        let plain_orig = plain.clone();
        assert_eq!(patch_fmp4_init(&mut plain), None);
        assert_eq!(plain, plain_orig);

        let mut hybrid = make_fmp4(true, 5, 9_248_633);
        let hybrid_orig = hybrid.clone();
        assert_eq!(patch_fmp4_init(&mut hybrid), None);
        assert_eq!(hybrid, hybrid_orig);
    }

    #[test]
    fn parses_content_range_and_applies_prefix_patch_across_ranges() {
        assert_eq!(response_start_offset(200, None), Some(0));
        assert_eq!(response_start_offset(206, Some("bytes 0-1/100")), Some(0));
        assert_eq!(response_start_offset(206, Some("bytes 24-758/1000")), Some(24));
        assert_eq!(response_start_offset(416, Some("bytes */1000")), None);

        let patch = [10u8, 11, 12, 13, 14];
        let mut chunk = [1u8, 2, 3, 4];
        apply_prefix_patch(&mut chunk, 3, &patch);
        assert_eq!(chunk, [13, 14, 3, 4]);

        let mut past = [9u8, 8];
        apply_prefix_patch(&mut past, 10, &patch);
        assert_eq!(past, [9, 8]);
    }
}
