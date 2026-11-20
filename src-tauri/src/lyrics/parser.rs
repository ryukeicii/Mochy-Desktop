use crate::lyrics::models::{
    BackingVocal, LyricLine, LyricWord, Lyrics, LyricsProvider, LyricsSync, Script,
};
use regex::Regex;
use std::collections::{HashMap, HashSet};

#[derive(Clone, Debug)]
struct Piece {
    text: String,
    start: f64,
    end: f64,
}

#[derive(Clone, Debug)]
struct RawLine {
    time: f64,
    text: String,
    pieces: Vec<Piece>,
    agent: Option<String>,
    is_background: bool,
    is_sub: bool,
}

pub struct LyricsParser;

impl LyricsParser {
    pub fn parse(raw: &str, provider: LyricsProvider) -> Option<Lyrics> {
        let text = Self::cleaned(raw);
        let rows: Vec<String> = text
            .lines()
            .map(|r| r.trim().to_string())
            .filter(|r| !r.is_empty() && !r.starts_with("[offset:"))
            .collect();
        if rows.is_empty() {
            return None;
        }

        let is_enhanced = rows.iter().any(|row| {
            !Self::leading_stamps(row).0.is_empty()
                && row.contains('<')
                && Self::first_inline_stamp(row).is_some()
        });

        let raws = if is_enhanced {
            Self::parse_enhanced(&rows)
        } else {
            Self::parse_standard(&rows)
        };

        let timed: Vec<&RawLine> = raws
            .iter()
            .filter(|r| !r.text.is_empty() || !r.pieces.is_empty())
            .collect();

        let unique_times: HashSet<i64> = timed.iter().map(|r| (r.time * 1000.0) as i64).collect();
        if timed.is_empty()
            || (unique_times.len() == 1 && timed.len() > 1)
            || (timed.len() == 1 && timed[0].time == 0.0)
        {
            return Self::plain(&text, provider);
        }

        Self::assemble(raws, provider)
    }

    pub fn plain(text: &str, provider: LyricsProvider) -> Option<Lyrics> {
        let mut lines = Vec::new();
        let mut last_was_blank = true;
        for row in Self::cleaned(text).lines() {
            let line = Self::strip_stamps(row).trim().to_string();
            if line.is_empty() {
                if last_was_blank {
                    continue;
                }
                last_was_blank = true;
            } else {
                last_was_blank = false;
            }
            lines.push(LyricLine::new(
                lines.len(),
                0.0,
                line,
                Vec::new(),
                None,
                None,
                None,
                None,
            ));
        }
        while lines.last().map(|l| l.text.is_empty()).unwrap_or(false) {
            lines.pop();
        }
        if !lines.iter().any(|l| !l.text.is_empty()) {
            return None;
        }
        Some(Lyrics::new(lines, LyricsSync::Plain, provider))
    }

    fn parse_standard(rows: &[String]) -> Vec<RawLine> {
        let mut result: Vec<RawLine> = Vec::new();
        let mut last_row_range: Option<std::ops::Range<usize>> = None;
        for row in rows {
            if row.starts_with('<') && row.ends_with('>') {
                if let Some(range) = last_row_range.take() {
                    let inner = &row[1..row.len() - 1];
                    let pieces = Self::word_line(inner);
                    for idx in range {
                        result[idx].pieces = pieces.clone();
                    }
                    continue;
                }
            }
            let (times, rest) = Self::leading_stamps(row);
            if times.is_empty() {
                last_row_range = None;
                continue;
            }
            let (agent, is_background, is_sub, content) = Self::markers(rest);
            let start = result.len();
            let collapsed = Self::collapse(&content);
            for time in times {
                result.push(RawLine {
                    time,
                    text: collapsed.clone(),
                    pieces: Vec::new(),
                    agent: agent.clone(),
                    is_background,
                    is_sub,
                });
            }
            last_row_range = Some(start..result.len());
        }
        result
    }

    fn parse_enhanced(rows: &[String]) -> Vec<RawLine> {
        let mut parsed: Vec<(f64, String)> = Vec::new();
        for row in rows {
            let (times, rest) = Self::leading_stamps(row);
            if let Some(&time) = times.first() {
                parsed.push((time, rest.to_string()));
            }
        }
        let mut result = Vec::new();
        for (index, (time, rest)) in parsed.iter().enumerate() {
            let (agent, is_background, is_sub, content) = Self::markers(rest);
            if is_sub {
                result.push(RawLine {
                    time: *time,
                    text: Self::collapse(&Self::remove_inline_stamps(&content)),
                    pieces: Vec::new(),
                    agent: None,
                    is_background: false,
                    is_sub: true,
                });
                continue;
            }
            let next_line = parsed.get(index + 1).map(|(t, _)| *t);
            let mut pieces = Self::inline_pieces(&content);
            if pieces.len() > 1 && pieces.last().map(|p| p.text.trim().is_empty()).unwrap_or(false)
            {
                let last = pieces.pop().unwrap();
                if let Some(prev) = pieces.last_mut() {
                    prev.end = last.start;
                }
            } else if !pieces.is_empty() {
                let spans: Vec<f64> = pieces
                    .iter()
                    .take(pieces.len().saturating_sub(1))
                    .map(|p| p.end - p.start)
                    .collect();
                let typical = if spans.is_empty() {
                    0.6
                } else {
                    spans.iter().sum::<f64>() / (spans.len() as f64)
                };
                let last_start = pieces.last().unwrap().start;
                let guess = last_start + (1.2f64).max(typical * 2.5);
                let end = next_line.map(|n| n.min(guess)).unwrap_or(guess);
                if let Some(last) = pieces.last_mut() {
                    last.end = end;
                }
            }
            let plain_text = Self::collapse(&Self::remove_inline_stamps(&content));
            result.push(RawLine {
                time: *time,
                text: plain_text,
                pieces,
                agent,
                is_background,
                is_sub: false,
            });
        }
        result
    }

    fn word_line(data: &str) -> Vec<Piece> {
        data.split('|')
            .filter_map(|part| {
                let fields: Vec<&str> = part.split(':').collect();
                if fields.len() < 3 {
                    return None;
                }
                let start = fields[fields.len() - 2].parse::<f64>().ok()?;
                let end = fields[fields.len() - 1].parse::<f64>().ok()?;
                let text = fields[..fields.len() - 2].join(":");
                Some(Piece {
                    text,
                    start,
                    end: end.max(start),
                })
            })
            .collect()
    }

    fn assemble(raws: Vec<RawLine>, provider: LyricsProvider) -> Option<Lyrics> {
        let glued_song = Self::spaces_dropped(&raws);
        let mut mains: Vec<RawLine> = Vec::new();
        let mut backings: HashMap<usize, RawLine> = HashMap::new();
        let mut subs: HashMap<usize, String> = HashMap::new();
        let mut first_at_time: HashMap<i64, usize> = HashMap::new();
        let mut blank_ends: HashMap<usize, f64> = HashMap::new();

        for line in raws {
            if line.text.is_empty() && line.pieces.is_empty() {
                if !mains.is_empty() {
                    blank_ends.insert(mains.len() - 1, line.time);
                }
                continue;
            }
            if line.is_sub {
                if !mains.is_empty() {
                    let owner = mains.len() - 1;
                    if !subs.contains_key(&owner) && !line.text.is_empty() {
                        subs.insert(owner, line.text);
                    }
                }
                continue;
            }
            let time_key = (line.time * 1000.0).round() as i64;
            if !line.is_background && line.pieces.is_empty() {
                if let Some(&owner) = first_at_time.get(&time_key) {
                    if !subs.contains_key(&owner)
                        && mains[owner].agent == line.agent
                        && mains[owner].text != line.text
                    {
                        subs.insert(owner, line.text);
                        continue;
                    }
                }
            }
            if line.is_background && !mains.is_empty() {
                let owner = mains.len() - 1;
                if let Some(existing) = backings.get_mut(&owner) {
                    existing.text.push(' ');
                    existing.text.push_str(&line.text);
                    existing.pieces.extend(line.pieces);
                } else {
                    backings.insert(owner, line);
                }
                continue;
            }
            first_at_time.entry(time_key).or_insert(mains.len());
            mains.push(line);
        }

        if mains.is_empty() {
            return None;
        }

        let mut order: Vec<usize> = (0..mains.len()).collect();
        order.sort_by(|&a, &b| {
            mains[a]
                .time
                .partial_cmp(&mains[b].time)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        let mut lines = Vec::new();
        for index in order {
            let raw = &mains[index];
            let words = Self::build_words(&raw.text, &raw.pieces, glued_song);
            let text = if glued_song
                && words.len() > 1
                && !raw.text.chars().any(|c| c.is_whitespace())
            {
                Self::spaced_text(&words)
            } else {
                raw.text.clone()
            };
            let backing = backings.get(&index).map(|back| {
                let back_words = Self::build_words(&back.text, &back.pieces, glued_song);
                BackingVocal {
                    time: back.time,
                    text: if back.text.is_empty() {
                        Self::spaced_text(&back_words)
                    } else {
                        back.text.clone()
                    },
                    words: back_words,
                }
            });
            let words_end = words
                .last()
                .map(|w| w.end)
                .unwrap_or(0.0)
                .max(
                    backing
                        .as_ref()
                        .and_then(|b| b.words.last().map(|w| w.end))
                        .unwrap_or(0.0),
                );
            let end = if words_end > 0.0 {
                Some(words_end)
            } else {
                blank_ends.get(&index).copied()
            };
            lines.push(LyricLine::new(
                lines.len(),
                raw.time,
                if text.is_empty() {
                    Self::spaced_text(&words)
                } else {
                    text
                },
                words,
                raw.agent.clone(),
                backing,
                end,
                subs.get(&index).cloned(),
            ));
        }

        let word_lines = lines.iter().filter(|l| !l.words.is_empty()).count();
        let sync = if word_lines * 2 >= lines.len() && word_lines > 0 {
            LyricsSync::Word
        } else {
            LyricsSync::Line
        };
        Some(Lyrics::new(lines, sync, provider))
    }

    fn build_words(text: &str, pieces: &[Piece], glued_song: bool) -> Vec<LyricWord> {
        if pieces.is_empty() {
            return Vec::new();
        }
        let glued_line = glued_song && !text.chars().any(|c| c.is_whitespace());
        let mut words: Vec<LyricWord> = Vec::new();
        let mut cursor = 0usize;
        let mut last_end: Option<usize> = None;

        for piece in pieces {
            let trimmed = piece.text.trim();
            let Some(first) = trimmed.chars().next() else {
                if let Some(last) = words.last_mut() {
                    last.space_after = true;
                }
                last_end = None;
                continue;
            };
            if glued_line {
                words.push(LyricWord {
                    text: trimmed.to_string(),
                    start: piece.start,
                    end: piece.end,
                    space_after: !Script::is_char_unspaced(first),
                });
                continue;
            }
            if let Some((start_idx, end_idx)) = Self::find_piece(trimmed, text, cursor) {
                let space_after = text[end_idx..]
                    .chars()
                    .next()
                    .map(|c| c.is_whitespace())
                    .unwrap_or(false);
                let prev_char = text[..start_idx].chars().next_back();
                let glued = last_end == Some(start_idx)
                    && start_idx > 0
                    && prev_char.map(|c| !Script::is_char_unspaced(c)).unwrap_or(false)
                    && !Script::is_char_unspaced(first);
                if glued {
                    if let Some(previous) = words.pop() {
                        words.push(LyricWord {
                            text: format!("{}{}", previous.text, trimmed),
                            start: previous.start,
                            end: previous.end.max(piece.end),
                            space_after,
                        });
                    }
                } else {
                    words.push(LyricWord {
                        text: trimmed.to_string(),
                        start: piece.start,
                        end: piece.end,
                        space_after,
                    });
                }
                cursor = end_idx;
                last_end = Some(end_idx);
            } else {
                let space_after = piece
                    .text
                    .chars()
                    .next_back()
                    .map(|c| c.is_whitespace())
                    .unwrap_or(false)
                    || !Script::is_char_unspaced(first);
                words.push(LyricWord {
                    text: trimmed.to_string(),
                    start: piece.start,
                    end: piece.end,
                    space_after,
                });
                last_end = None;
            }
        }

        for idx in 1..words.len() {
            if let Some(first) = words[idx].text.chars().next() {
                if ",.!?;:)]}…".contains(first) {
                    words[idx - 1].space_after = false;
                }
            }
        }
        if let Some(last) = words.last_mut() {
            last.space_after = false;
        }
        words
    }

    fn find_piece(piece: &str, text: &str, cursor: usize) -> Option<(usize, usize)> {
        if cursor >= text.len() {
            return None;
        }
        let rel = text[cursor..].find(piece)?;
        let start = cursor + rel;
        let end = start + piece.len();
        let skipped = &text[cursor..start];
        if skipped.chars().any(|c| c.is_alphanumeric()) {
            None
        } else {
            Some((start, end))
        }
    }

    fn spaces_dropped(raws: &[RawLine]) -> bool {
        let candidates: Vec<&RawLine> = raws
            .iter()
            .filter(|line| {
                let valid_pieces = line
                    .pieces
                    .iter()
                    .filter(|p| !p.text.trim().is_empty())
                    .count();
                let dom = Script::dominant(&line.text);
                valid_pieces >= 2 && !dom.is_unspaced() && dom != Script::Unknown
            })
            .collect();
        if candidates.len() < 3 {
            return false;
        }
        let glued = candidates
            .iter()
            .filter(|l| !l.text.chars().any(|c| c.is_whitespace()))
            .count();
        glued * 5 >= candidates.len() * 4
    }

    fn spaced_text(words: &[LyricWord]) -> String {
        words
            .iter()
            .map(|w| {
                if w.space_after {
                    format!("{} ", w.text)
                } else {
                    w.text.clone()
                }
            })
            .collect::<String>()
            .trim()
            .to_string()
    }

    fn leading_stamps(row: &str) -> (Vec<f64>, &str) {
        let mut rest = row;
        let mut times = Vec::new();
        while rest.starts_with('[') {
            let Some(close) = rest.find(']') else {
                break;
            };
            let inner = &rest[1..close];
            let Some(time) = Self::stamp(inner) else {
                break;
            };
            times.push(time);
            rest = &rest[close + 1..];
        }
        (times, rest)
    }

    fn strip_stamps(row: &str) -> &str {
        Self::leading_stamps(row).1
    }

    fn stamp(text: &str) -> Option<f64> {
        let parts: Vec<&str> = text.split(':').collect();
        if !(2..=3).contains(&parts.len()) {
            return None;
        }
        if !parts
            .iter()
            .all(|p| !p.is_empty() && p.chars().all(|c| c.is_ascii_digit() || c == '.'))
        {
            return None;
        }
        let minutes = parts[0].parse::<f64>().ok()?;
        if parts.len() == 2 {
            let seconds = parts[1].parse::<f64>().ok()?;
            return Some(minutes * 60.0 + seconds);
        }
        let seconds = parts[1].parse::<f64>().ok()?;
        let fraction = format!("0.{}", parts[2]).parse::<f64>().ok()?;
        Some(minutes * 60.0 + seconds + fraction)
    }

    fn markers(text: &str) -> (Option<String>, bool, bool, String) {
        let mut rest = text.trim_start();
        let mut agent = None;
        let mut is_background = false;
        let mut is_sub = false;
        loop {
            if let Some(after) = rest.strip_prefix("{bg}") {
                is_background = true;
                rest = after.trim_start();
            } else if let Some(after) = rest.strip_prefix("{sub}") {
                is_sub = true;
                rest = after.trim_start();
            } else if rest.starts_with("{agent:") {
                if let Some(close) = rest.find('}') {
                    agent = Some(rest[7..close].to_string());
                    rest = rest[close + 1..].trim_start();
                } else {
                    break;
                }
            } else {
                break;
            }
        }
        (agent, is_background, is_sub, rest.to_string())
    }

    fn first_inline_stamp(row: &str) -> Option<(usize, usize)> {
        let mut search = 0;
        while let Some(rel_open) = row[search..].find('<') {
            let open = search + rel_open;
            let rel_close = row[open..].find('>')?;
            let close = open + rel_close;
            if Self::stamp(&row[open + 1..close]).is_some() {
                return Some((open, close + 1));
            }
            search = open + 1;
        }
        None
    }

    fn inline_pieces(content: &str) -> Vec<Piece> {
        let mut pieces: Vec<Piece> = Vec::new();
        let mut rest = content;
        while let Some((start, end)) = Self::first_inline_stamp(rest) {
            let inner = &rest[start + 1..end - 1];
            let Some(time) = Self::stamp(inner) else {
                break;
            };
            let after = &rest[end..];
            let next_range = Self::first_inline_stamp(after);
            let word_text = if let Some((ns, _)) = next_range {
                let w = &after[..ns];
                rest = &after[ns..];
                w.to_string()
            } else {
                let w = after.to_string();
                rest = "";
                w
            };
            if let Some(last) = pieces.last_mut() {
                last.end = time;
            }
            pieces.push(Piece {
                text: word_text,
                start: time,
                end: time + 0.5,
            });
            if next_range.is_none() {
                break;
            }
        }
        pieces
    }

    fn remove_inline_stamps(content: &str) -> String {
        let mut result = content.to_string();
        while let Some((s, e)) = Self::first_inline_stamp(&result) {
            result.replace_range(s..e, "");
        }
        result
    }

    fn collapse(text: &str) -> String {
        let re = Regex::new(r"[\t\u{00A0} ]+").unwrap();
        re.replace_all(text, " ").trim().to_string()
    }

    fn cleaned(raw: &str) -> String {
        let mut text = raw.trim().to_string();
        if text.starts_with('"') && text.ends_with('"') && text.len() > 1 {
            text = text[1..text.len() - 1].to_string();
        }
        if !text.contains('\n') && text.contains("\\n") {
            text = text.replace("\\r", "").replace("\\n", "\n");
        }
        let entities = [
            ("&amp;", "&"),
            ("&quot;", "\""),
            ("&#39;", "'"),
            ("&apos;", "'"),
            ("&lt;", "<"),
            ("&gt;", ">"),
            ("&#x27;", "'"),
        ];
        for (entity, val) in entities {
            if text.contains(entity) {
                text = text.replace(entity, val);
            }
        }
        text.replace("\r\n", "\n").replace('\r', "\n")
    }
}
