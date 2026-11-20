// a cover's colours for the player's backdrop and the hero's tint, worked out here instead of on a canvas in the page:
// decoded once, squeezed to 24x24, four weighted pools (one per quadrant), and kept for the next time it shows

use image::imageops::FilterType;
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;

const SIDE: u32 = 24;
const KEEP: usize = 96;

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Tint {
    pub bg: String,
    pub fg: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Palette {
    // top-left, top-right, bottom-left, bottom-right, each 0..1 rgb
    pub stops: [[f32; 3]; 4],
    pub tint: Tint,
    // how light the cover is overall, so text over it can pick a side
    pub luminance: f32,
}

#[derive(Default)]
pub struct PaletteCache {
    map: Mutex<(HashMap<String, Palette>, VecDeque<String>)>,
}

impl PaletteCache {
    pub fn get(&self, key: &str) -> Option<Palette> {
        self.map.lock().unwrap().0.get(key).cloned()
    }

    pub fn put(&self, key: String, palette: Palette) {
        let mut guard = self.map.lock().unwrap();
        let (map, order) = &mut *guard;
        if map.insert(key.clone(), palette).is_none() {
            order.push_back(key);
        }
        while order.len() > KEEP {
            if let Some(old) = order.pop_front() {
                map.remove(&old);
            }
        }
    }

    pub fn len(&self) -> usize {
        self.map.lock().unwrap().0.len()
    }

    pub fn clear(&self) -> usize {
        let mut guard = self.map.lock().unwrap();
        let n = guard.0.len();
        guard.0.clear();
        guard.1.clear();
        n
    }
}

pub fn from_bytes(bytes: &[u8]) -> Option<Palette> {
    let image = image::load_from_memory(bytes).ok()?;
    let small = image.resize_exact(SIDE, SIDE, FilterType::Triangle).to_rgb8();
    let mut sums = [[0f32; 4]; 4];
    let mut total_lum = 0f32;
    for (x, y, px) in small.enumerate_pixels() {
        let [r, g, b] = [px[0] as f32 / 255.0, px[1] as f32 / 255.0, px[2] as f32 / 255.0];
        let max = r.max(g).max(b);
        let min = r.min(g).min(b);
        let sat = if max == 0.0 { 0.0 } else { (max - min) / max };
        // colourful pixels count for more, so a grey border doesn't wash the pool out
        let w = 0.2 + sat * 1.8;
        let q = (if y >= SIDE / 2 { 2 } else { 0 }) + (if x >= SIDE / 2 { 1 } else { 0 });
        sums[q][0] += r * w;
        sums[q][1] += g * w;
        sums[q][2] += b * w;
        sums[q][3] += w;
        total_lum += 0.299 * r + 0.587 * g + 0.114 * b;
    }
    let mut stops = [[0.15f32, 0.12, 0.22]; 4];
    for (i, s) in sums.iter().enumerate() {
        if s[3] <= 0.0 {
            continue;
        }
        let (r, g, b) = (s[0] / s[3], s[1] / s[3], s[2] / s[3]);
        let avg = (r + g + b) / 3.0;
        // a little more colour than the cover has, and never black or white, so the backdrop always reads as a colour
        let lift = |c: f32| (avg + (c - avg) * 1.45).clamp(0.06, 0.75);
        stops[i] = [lift(r), lift(g), lift(b)];
    }
    let [r, g, b] = stops[0];
    let (rr, gg, bb) = ((r * 290.0).min(255.0).round(), (g * 290.0).min(255.0).round(), (b * 290.0).min(255.0).round());
    let lum = (0.299 * rr + 0.587 * gg + 0.114 * bb) / 255.0;
    Some(Palette {
        stops,
        tint: Tint { bg: format!("rgb({}, {}, {})", rr, gg, bb), fg: if lum > 0.56 { "#000000".into() } else { "#ffffff".into() } },
        luminance: total_lum / (SIDE * SIDE) as f32,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_red_cover_gives_red_pools() {
        let mut img = image::RgbImage::new(32, 32);
        for p in img.pixels_mut() {
            *p = image::Rgb([220, 30, 30]);
        }
        let mut png = Vec::new();
        image::DynamicImage::ImageRgb8(img)
            .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
            .unwrap();
        let palette = from_bytes(&png).unwrap();
        for stop in palette.stops {
            assert!(stop[0] > stop[1] && stop[0] > stop[2]);
            assert!(stop.iter().all(|c| (0.06..=0.75).contains(c)));
        }
        assert_eq!(palette.tint.fg, "#ffffff");
    }
}
