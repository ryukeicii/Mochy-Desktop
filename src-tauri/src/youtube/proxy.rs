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

    // a paired device's file or cover, fetched with its key and passed through as it comes
    let linked = bare
        .strip_prefix("/link/")
        .map(|rest| (rest, "/file/"))
        .or_else(|| bare.strip_prefix("/link-art/").map(|rest| (rest, "/art/")));
    if let Some((rest, kind)) = linked {
        let (device, file) = rest.split_once('/').unwrap_or((rest, ""));
        let target = ctx.link.file_url(device, &format!("{}{}", kind, file)).await;
        let Some((url, key)) = target else {
            write_response(&mut socket, Response::status(503, "device away"), is_head).await?;
            return Ok(());
        };
        let mut req = ctx.link.stream_client().get(&url).header("X-Mochy-Key", key);
        if let Some(ref r) = range_header {
            req = req.header("Range", r);
        }
        let upstream = req.send().await?;
        pass_through(&mut socket, upstream, is_head, "audio/mp4").await?;
        return Ok(());
    }

    if let Some(rest) = path.strip_prefix("/stream/") {
        let video_id = rest.split('?').next().unwrap_or(rest);
        let info = match ctx.innertube.cached_stream(video_id).await {
            Some(s) => s,
            None => ctx.innertube.stream(video_id, true).await?,
        };

        let mut req = ctx.innertube.http.get(&info.url);
        for (k, v) in &info.headers {
            req = req.header(k, v);
        }
        if let Some(ref r) = range_header {
            req = req.header("Range", r);
        }

        let upstream = req.send().await?;
        pass_through(&mut socket, upstream, is_head, "audio/mp4").await?;
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
    if let Some(cr) = content_range {
        head.push_str(&format!("Content-Range: {}\r\n", cr));
    }
    head.push_str("\r\n");
    socket.write_all(head.as_bytes()).await?;
    if !is_head {
        let mut stream = upstream.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let bytes = chunk?;
            if socket.write_all(&bytes).await.is_err() {
                break;
            }
        }
    }
    Ok(())
}
