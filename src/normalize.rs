use crate::types::AdrStatus;
use std::path::Path;

pub fn normalize_adr_id(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    let trimmed = trimmed
        .strip_prefix("ADR-")
        .or_else(|| trimmed.strip_prefix("adr-"))
        .unwrap_or(trimmed);
    let digits: String = trimmed
        .chars()
        .filter(|c| c.is_ascii_digit())
        .take(8)
        .collect();
    if digits.is_empty() {
        return None;
    }
    let n: u32 = digits.parse().ok()?;
    Some(format!("{:04}", n))
}

pub fn title_from_filename(base: &str) -> String {
    let without_ext = Path::new(base)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or(base);
    let slug = without_ext
        .trim_start_matches(|c: char| c.is_ascii_digit() || c == '-' || c == '_' || c == '.');
    slug.split(|c| c == '-' || c == '_')
        .filter(|s| !s.is_empty())
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                None => String::new(),
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn normalize_status(raw: Option<&str>) -> AdrStatus {
    let s = raw.map(|s| s.to_lowercase().trim().to_string());
    let Some(s) = s.filter(|s| !s.is_empty()) else {
        return AdrStatus::Unknown;
    };

    if s.contains("superseded") || s.contains("superseeded") {
        return AdrStatus::Superseded;
    }
    if s.contains("rejected") || s.contains("declined") {
        return AdrStatus::Rejected;
    }
    if s.contains("deprecated") || s.contains("retired") {
        return AdrStatus::Deprecated;
    }
    if s == "accepted"
        || s == "approved"
        || s == "agreed"
        || s == "decided"
        || s == "implemented"
        || s == "done"
        || s == "active"
        || s == "final"
    {
        return AdrStatus::Accepted;
    }
    if s == "proposed"
        || s == "draft"
        || s == "pending"
        || s == "wip"
        || s.contains("on hold")
        || s.contains("on-hold")
    {
        return AdrStatus::Proposed;
    }

    AdrStatus::Unknown
}
