use crate::metadata::{classic_decision_record, madr_decision_made, status_from_prose};
use crate::normalize::normalize_status;
use crate::types::AdrStatus;

/// Resolve status across common ADR conventions (Nygard, MADR, Tyree–Akerman, tables, YAML).
pub fn resolve_record_status(
    front_matter: Option<&str>,
    table_status: Option<&str>,
    body: &str,
) -> AdrStatus {
    for raw in [front_matter, table_status] {
        if let Some(s) = raw {
            let trimmed = s.trim();
            if !trimmed.is_empty() {
                let normalized = normalize_status(Some(trimmed));
                if normalized != AdrStatus::Unknown {
                    return normalized;
                }
            }
        }
    }

    if let Some(line) = status_from_prose(body) {
        let normalized = normalize_status(Some(&line));
        if normalized != AdrStatus::Unknown {
            return normalized;
        }
    }

    if madr_decision_made(body) || classic_decision_record(body) {
        return AdrStatus::Accepted;
    }

    AdrStatus::Unknown
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn madr_outcome_implies_accepted() {
        let body = r#"## Decision Outcome

Chosen option: "MADR", because reasons.
"#;
        assert_eq!(
            resolve_record_status(None, None, body),
            AdrStatus::Accepted
        );
    }

    #[test]
    fn nygard_status_line() {
        let body = "**Status:** Proposed\n\n## Context\n\nx";
        assert_eq!(
            resolve_record_status(None, None, body),
            AdrStatus::Proposed
        );
    }

    #[test]
    fn front_matter_on_hold() {
        assert_eq!(
            resolve_record_status(Some("on hold"), None, ""),
            AdrStatus::Proposed
        );
    }

    #[test]
    fn plain_nygard_markdown() {
        let body = r#"# Use Redis for cache

## Context

We need a fast cache.

## Decision

Use Redis.
"#;
        assert_eq!(
            resolve_record_status(None, None, body),
            AdrStatus::Accepted
        );
    }
}
