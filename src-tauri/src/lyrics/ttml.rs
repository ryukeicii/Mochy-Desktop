use regex::Regex;
use roxmltree::{Document, Node};
use std::collections::HashMap;

struct Span {
    text: String,
    start: f64,
    end: f64,
    space_after: bool,
}

struct Line {
    text: String,
    start: f64,
    words: Vec<(String, f64, f64)>,
    agent: Option<String>,
    backing: Vec<Line>,
    sub: Option<String>,
}

pub struct TTMLParser;

impl TTMLParser {
    pub fn to_lrc(ttml: &str) -> Option<String> {
        let re = Regex::new(r"</span>[ \t\u{00A0}]+<span").unwrap();
        let marked = re.replace_all(ttml, "</span><ws/><span");
        let doc = Document::parse(&marked).ok()?;

        let readings = Self::keyed_texts(&doc, "transliterations");
        let translations = Self::keyed_texts(&doc, "translations");

        let mut out = String::new();
        for node in doc.descendants() {
            if !node.is_element() || node.tag_name().name() != "p" {
                continue;
            }
            let Some(line) = Self::parse_line(node) else {
                continue;
            };
            out.push_str(&Self::stamp(line.start));
            if let Some(ref agent) = line.agent {
                out.push_str(&format!("{{agent:{}}}", agent));
            }
            out.push_str(&line.text);
            out.push('\n');

            if !line.words.is_empty() {
                out.push_str(&Self::word_line(&line.words));
                out.push('\n');
            }

            let key = Self::attribute(node, "key");
            let sub = line.sub.or_else(|| {
                key.and_then(|k| readings.get(&k).or_else(|| translations.get(&k)).cloned())
            });
            if let Some(sub_text) = sub {
                if !sub_text.is_empty() && sub_text != line.text {
                    out.push_str(&Self::stamp(line.start));
                    out.push_str("{sub}");
                    out.push_str(&sub_text);
                    out.push('\n');
                }
            }

            for backing in line.backing {
                out.push_str(&Self::stamp(backing.start));
                out.push_str("{bg}");
                out.push_str(&backing.text);
                out.push('\n');
                if !backing.words.is_empty() {
                    out.push_str(&Self::word_line(&backing.words));
                    out.push('\n');
                }
            }
        }

        let trimmed = out.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    }

    fn parse_line(element: Node) -> Option<Line> {
        let begin = Self::attribute(element, "begin")?;
        if begin.is_empty() {
            return None;
        }
        let start = Self::time(&begin);
        let mut spans = Vec::new();
        let mut backing = Vec::new();
        let mut reading: Option<String> = None;
        let mut translation: Option<String> = None;

        let children: Vec<Node> = element.children().collect();
        for (index, node) in children.iter().enumerate() {
            if !node.is_element() || node.tag_name().name() != "span" {
                continue;
            }
            match Self::attribute(*node, "role").as_deref() {
                Some("x-bg") => {
                    if let Some(bg_line) = Self::parse_backing(*node, start) {
                        backing.push(bg_line);
                    }
                }
                Some("x-roman") => {
                    reading = Some(Self::plain_text(*node));
                }
                Some("x-translation") => {
                    translation = Some(Self::plain_text(*node));
                }
                _ => {
                    let next = children.get(index + 1).copied();
                    if let Some(timed) = Self::timed_span(*node, next) {
                        spans.push(timed);
                    }
                }
            }
        }

        let words = Self::merge(&spans);
        let mut text: String = words
            .iter()
            .map(|(t, _, _)| t.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        if text.is_empty() {
            text = Self::direct_text(element).trim().to_string();
        }
        if text.is_empty() {
            return None;
        }
        let agent = Self::attribute(element, "agent").filter(|a| !a.is_empty());
        let sub = [reading, translation]
            .into_iter()
            .flatten()
            .find(|s| !s.is_empty());

        Some(Line {
            text,
            start,
            words,
            agent,
            backing,
            sub,
        })
    }

    fn parse_backing(span: Node, parent_start: f64) -> Option<Line> {
        let start = Self::attribute(span, "begin")
            .map(|b| Self::time(&b))
            .unwrap_or(parent_start);
        let mut spans = Vec::new();
        let children: Vec<Node> = span.children().collect();
        for (index, node) in children.iter().enumerate() {
            if !node.is_element() || node.tag_name().name() != "span" {
                continue;
            }
            let role = Self::attribute(*node, "role");
            if matches!(role.as_deref(), Some("x-translation") | Some("x-roman")) {
                continue;
            }
            let next = children.get(index + 1).copied();
            if let Some(timed) = Self::timed_span(*node, next) {
                spans.push(timed);
            }
        }
        let words = Self::merge(&spans);
        let mut text: String = words
            .iter()
            .map(|(t, _, _)| t.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        if text.is_empty() {
            text = Self::direct_text(span).trim().to_string();
        }
        if text.is_empty() {
            return None;
        }
        Some(Line {
            text,
            start,
            words,
            agent: None,
            backing: Vec::new(),
            sub: None,
        })
    }

    fn timed_span(span: Node, next: Option<Node>) -> Option<Span> {
        let text = Self::node_text(span).trim().to_string();
        if text.is_empty() {
            return None;
        }
        let begin = Self::attribute(span, "begin")?;
        let end = Self::attribute(span, "end")?;
        if begin.is_empty() || end.is_empty() {
            return None;
        }
        Some(Span {
            text,
            start: Self::time(&begin),
            end: Self::time(&end),
            space_after: Self::is_word_boundary(next),
        })
    }

    fn is_word_boundary(node: Option<Node>) -> bool {
        let Some(node) = node else {
            return false;
        };
        if node.is_element() && node.tag_name().name() == "ws" {
            return true;
        }
        if node.is_text() {
            if let Some(between) = node.text() {
                if between.is_empty() || between.contains('\n') || between.contains('\r') {
                    return false;
                }
                return between
                    .chars()
                    .any(|c| c == ' ' || c == '\t' || c == '\u{00A0}');
            }
        }
        false
    }

    fn merge(spans: &[Span]) -> Vec<(String, f64, f64)> {
        let mut words: Vec<(String, f64, f64)> = Vec::new();
        let mut prev_space_after: Option<bool> = None;
        for span in spans {
            if prev_space_after == Some(false) {
                if let Some(last) = words.last_mut() {
                    last.0.push_str(&span.text);
                    last.2 = span.end;
                    prev_space_after = Some(span.space_after);
                    continue;
                }
            }
            words.push((span.text.clone(), span.start, span.end));
            prev_space_after = Some(span.space_after);
        }
        words
    }

    fn direct_text(element: Node) -> String {
        element
            .children()
            .map(|node| {
                if node.is_text() {
                    return node.text().unwrap_or_default().to_string();
                }
                if node.is_element() && node.tag_name().name() == "span" {
                    let role = Self::attribute(node, "role");
                    if matches!(
                        role.as_deref(),
                        Some("x-bg") | Some("x-translation") | Some("x-roman")
                    ) {
                        return String::new();
                    }
                    return Self::node_text(node);
                }
                String::new()
            })
            .collect()
    }

    fn node_text(node: Node) -> String {
        let mut out = String::new();
        for d in node.descendants() {
            if d.is_text() {
                if let Some(t) = d.text() {
                    out.push_str(t);
                }
            }
        }
        out
    }

    fn keyed_texts(doc: &Document, block: &str) -> HashMap<String, String> {
        let mut texts = HashMap::new();
        for node in doc.descendants() {
            if node.is_element() && node.tag_name().name() == block {
                for desc in node.descendants() {
                    if desc.is_element() && desc.tag_name().name() == "text" {
                        if let Some(key) = Self::attribute(desc, "for") {
                            if !texts.contains_key(&key) {
                                let t = Self::plain_text(desc);
                                if !t.is_empty() {
                                    texts.insert(key, t);
                                }
                            }
                        }
                    }
                }
            }
        }
        texts
    }

    fn plain_text(element: Node) -> String {
        fn walk(node: Node) -> String {
            if node.is_text() {
                return node.text().unwrap_or_default().to_string();
            }
            if !node.is_element() {
                return String::new();
            }
            if node.tag_name().name() == "ws" {
                return " ".to_string();
            }
            if TTMLParser::attribute(node, "role").as_deref() == Some("x-bg") {
                return String::new();
            }
            node.children().map(walk).collect()
        }
        let text: String = element.children().map(walk).collect();
        text.split_whitespace().collect::<Vec<_>>().join(" ")
    }

    fn attribute(element: Node, local_name: &str) -> Option<String> {
        for attr in element.attributes() {
            if attr.name() == local_name || attr.name().ends_with(&format!(":{}", local_name)) {
                return Some(attr.value().to_string());
            }
        }
        None
    }

    fn time(raw: &str) -> f64 {
        let value = if raw.ends_with('s') && !raw.ends_with("ms") {
            &raw[..raw.len() - 1]
        } else {
            raw
        };
        let parts: Vec<f64> = value
            .split(':')
            .filter_map(|p| p.parse::<f64>().ok())
            .collect();
        match parts.len() {
            2 => parts[0] * 60.0 + parts[1],
            3 => parts[0] * 3600.0 + parts[1] * 60.0 + parts[2],
            _ => value.parse::<f64>().unwrap_or(0.0),
        }
    }

    fn stamp(seconds: f64) -> String {
        let ms = (seconds * 1000.0).round() as i64;
        format!(
            "[{:02}:{:02}.{:02}]",
            ms / 60_000,
            (ms / 1000) % 60,
            (ms % 1000) / 10
        )
    }

    fn word_line(words: &[(String, f64, f64)]) -> String {
        let parts: Vec<String> = words
            .iter()
            .map(|(text, start, end)| {
                let clean: String = text.chars().filter(|c| !":|<>".contains(*c)).collect();
                format!("{}:{}:{}", clean, start, end)
            })
            .collect();
        format!("<{}>", parts.join("|"))
    }
}
