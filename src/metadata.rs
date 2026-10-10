use std::collections::HashMap;

/// Key/value rows from markdown tables like `| **Status** | Proposed |`.
pub fn parse_metadata_table(body: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for line in body.lines() {
        let line = line.trim();
        if !line.starts_with('|') || line.contains("---") {
            continue;
        }
        let cells: Vec<&str> = line
            .split('|')
            .map(str::trim)
            .filter(|c| !c.is_empty())
            .collect();
        if cells.len() < 2 {
            continue;
        }
        let key = cells[0].trim_matches('*').trim().to_lowercase();
        let val = cells[1].trim();
        if key.is_empty() || val.is_empty() {
            continue;
        }
        map.insert(key, val.to_string());
    }
    map
}

/// `0004 — Title` or `0004 - Title` before the main heading.
pub fn title_from_leading_id_line(body: &str) -> Option<String> {
    let re = regex::Regex::new(r"^(\d{1,8})\s*[—–\-]\s*(.+)$").unwrap();
    for line in body.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if line.starts_with('#') {
            return None;
        }
        if let Some(cap) = re.captures(line) {
            return Some(cap.get(2)?.as_str().trim().to_string());
        }
        break;
    }
    None
}

fn strip_fenced_blocks(body: &str) -> String {
    let re = regex::Regex::new(r"```[\s\S]*?```").unwrap();
    re.replace_all(body, "").to_string()
}

/// Nygard `**Status:**`, `Status:`, MADR-style `status: accepted` at line start (outside fences).
pub fn status_from_prose(body: &str) -> Option<String> {
    let scan = strip_fenced_blocks(body);
    let status_bold =
        regex::Regex::new(r"(?im)^\*\*status:\*\*\s+(.+?)\s*$").unwrap();
    let status_plain = regex::Regex::new(r"(?im)^status:\s*(.+?)\s*$").unwrap();
    let superseded =
        regex::Regex::new(r"(?im)^\*\*supersedes\*\*:?\s*.+$").unwrap();

    let mut in_header = true;
    for line in scan.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if line.starts_with("## ") {
            in_header = false;
        }
        if let Some(cap) = status_bold.captures(line) {
            return Some(cap.get(1)?.as_str().trim().to_string());
        }
        if in_header {
            if let Some(cap) = status_plain.captures(line) {
                let val = cap.get(1)?.as_str().trim();
                if val.len() <= 120 && !val.starts_with('<') {
                    return Some(val.to_string());
                }
            }
            if superseded.is_match(line) {
                return Some("superseded".to_string());
            }
            if regex::Regex::new(r"(?i)superseded\s+by\s+adr")
                .unwrap()
                .is_match(line)
            {
                return Some("superseded".to_string());
            }
        }
    }
    None
}

fn section_body(body: &str, names: &[&str]) -> String {
    let heading = regex::Regex::new(r"^#{1,3}\s+(.+)$").unwrap();
    let mut current: Option<String> = None;
    let mut buf = String::new();
    let mut out = String::new();
    for line in body.lines() {
        if let Some(cap) = heading.captures(line) {
            if let Some(name) = current {
                if names.iter().any(|n| name.eq_ignore_ascii_case(n)) {
                    out = buf.clone();
                }
            }
            current = Some(cap.get(1).unwrap().as_str().trim().to_string());
            buf.clear();
        } else if current.is_some() {
            buf.push_str(line);
            buf.push('\n');
        }
    }
    if let Some(name) = current {
        if names.iter().any(|n| name.eq_ignore_ascii_case(n)) {
            out = buf;
        }
    }
    out
}

/// Plain Nygard / Tyree markdown: Context or Issue plus a non-empty Decision section.
pub fn classic_decision_record(body: &str) -> bool {
    let stripped = strip_fenced_blocks(body);
    let lower = stripped.to_lowercase();
    let has_context = lower.contains("## context")
        || lower.contains("## issue")
        || lower.contains("context and problem");
    if !has_context {
        return false;
    }
    let decision = section_body(&stripped, &["Decision"]);
    let decision = decision.trim();
    decision.len() >= 8 && !decision.starts_with("<!--")
}

/// `**Date:**` / `Date:` in the header (Nygard) or metadata table already handled elsewhere.
pub fn date_from_prose(body: &str) -> Option<String> {
    let scan = strip_fenced_blocks(body);
    let re_bold = regex::Regex::new(r"(?im)^\*\*date\*\*:?\s*(\S.+?)\s*$").unwrap();
    let re_plain = regex::Regex::new(r"(?im)^date:\s*(\S.+?)\s*$").unwrap();
    let mut in_header = true;
    for line in scan.lines() {
        let line = line.trim();
        if line.starts_with("## ") {
            in_header = false;
            break;
        }
        if !in_header {
            break;
        }
        if let Some(cap) = re_bold.captures(line) {
            return Some(cap.get(1).unwrap().as_str().trim().to_string());
        }
        if let Some(cap) = re_plain.captures(line) {
            return Some(cap.get(1).unwrap().as_str().trim().to_string());
        }
    }
    None
}

/// MADR `## Decision Outcome` with a chosen option (decision recorded).
pub fn madr_decision_made(body: &str) -> bool {
    let lower = body.to_lowercase();
    if lower.contains("chosen option:") || lower.contains("chosen option “") {
        return true;
    }
    if lower.contains("decision outcome") && lower.contains("chosen option") {
        return true;
    }
    false
}

pub fn tags_from_metadata(table: &HashMap<String, String>) -> Vec<String> {
    let mut tags = Vec::new();
    if let Some(audience) = table.get("audience") {
        for part in audience.split(';') {
            let t = part.trim();
            if !t.is_empty() {
                tags.push(t.to_string());
            }
        }
    }
    tags
}
