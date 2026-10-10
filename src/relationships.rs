use crate::normalize::normalize_adr_id;
use crate::types::{AdrEdge, AdrEdgeType};
use std::collections::HashSet;

fn add_edge(
    edges: &mut Vec<AdrEdge>,
    from_id: &str,
    to_raw: &str,
    edge_type: AdrEdgeType,
    inferred: bool,
) {
    let to_id = normalize_adr_id(to_raw)
        .or_else(|| normalize_adr_id(to_raw.strip_suffix(".md").unwrap_or(to_raw)));
    let Some(to_id) = to_id else {
        return;
    };
    if from_id == to_id {
        return;
    }
    let key = format!("{}|{}|{}", from_id, to_id, edge_type_as_str(edge_type));
    let dup = edges.iter().any(|e| {
        format!("{}|{}|{}", e.from, e.to, edge_type_as_str(e.edge_type)) == key
    });
    if dup {
        return;
    }
    edges.push(AdrEdge {
        from: from_id.to_string(),
        to: to_id,
        edge_type,
        inferred,
    });
}

fn edge_type_as_str(t: AdrEdgeType) -> &'static str {
    match t {
        AdrEdgeType::Supersedes => "supersedes",
        AdrEdgeType::SupersededBy => "superseded-by",
        AdrEdgeType::DependsOn => "depends-on",
        AdrEdgeType::Amends => "amends",
        AdrEdgeType::RelatesTo => "relates-to",
    }
}

fn coerce_targets(value: &serde_yaml::Value) -> Vec<String> {
    match value {
        serde_yaml::Value::String(s) => s
            .split(|c| c == ',' || c == ';' || c == '|' || c == '\n')
            .map(|p| p.trim().to_string())
            .filter(|p| !p.is_empty())
            .collect(),
        serde_yaml::Value::Number(n) => vec![n.to_string()],
        serde_yaml::Value::Sequence(seq) => seq
            .iter()
            .flat_map(coerce_targets)
            .collect(),
        _ => vec![],
    }
}

pub fn edges_from_frontmatter(
    from_id: &str,
    data: &serde_yaml::Mapping,
) -> Vec<AdrEdge> {
    let mut edges = Vec::new();
    for (key, value) in data {
        if let serde_yaml::Value::String(k) = key {
            let norm = k.to_lowercase().replace('_', "-");
            let edge_type = match norm.as_str() {
                "supersedes" => AdrEdgeType::Supersedes,
                "superseded-by" | "supersededby" => AdrEdgeType::SupersededBy,
                "depends-on" | "dependson" | "depends" => AdrEdgeType::DependsOn,
                "amends" => AdrEdgeType::Amends,
                "relates-to" | "relatesto" | "related" => AdrEdgeType::RelatesTo,
                _ => continue,
            };
            for target in coerce_targets(value) {
                add_edge(&mut edges, from_id, &target, edge_type, false);
            }
        }
    }
    edges
}

pub fn edges_from_body(from_id: &str, body: &str) -> Vec<AdrEdge> {
    let mut edges = Vec::new();
    let link_re = regex::Regex::new(
        r"\[[^\]]*\]\(([^)]*?(\d{1,8})[-_][^/)]*\.md[^)]*)\)",
    )
    .unwrap();
    for m in link_re.captures_iter(body) {
        let id = m.get(2).map(|c| c.as_str());
        if let Some(id) = id {
            add_edge(&mut edges, from_id, id, AdrEdgeType::RelatesTo, true);
        }
    }

    let mention_re = regex::Regex::new(
        r"(?i)\b(?:supersedes?|superseded\s+by|depends\s+on|amends?|relates?\s+to)\s*:?\s*(?:ADR[-\s]*)?(\d{1,8})\b",
    )
    .unwrap();
    for m in mention_re.captures_iter(body) {
        let phrase = m.get(0).map(|c| c.as_str().to_lowercase()).unwrap_or_default();
        let id = m.get(1).map(|c| c.as_str()).unwrap_or("");
        let edge_type = if phrase.contains("superseded by") {
            AdrEdgeType::SupersededBy
        } else if phrase.contains("supersede") {
            AdrEdgeType::Supersedes
        } else if phrase.contains("depend") {
            AdrEdgeType::DependsOn
        } else if phrase.contains("amend") {
            AdrEdgeType::Amends
        } else {
            AdrEdgeType::RelatesTo
        };
        add_edge(&mut edges, from_id, id, edge_type, true);
    }
    edges
}

pub fn filter_known_edges(
    edges: Vec<AdrEdge>,
    ids: &HashSet<String>,
    warnings: &mut Vec<String>,
) -> Vec<AdrEdge> {
    let mut out = Vec::new();
    for e in edges {
        if !ids.contains(&e.from) {
            warnings.push(format!("Edge references missing source ADR: {}", e.from));
        }
        if !ids.contains(&e.to) {
            warnings.push(format!(
                "Edge {} → {} ({}): target ADR not found",
                e.from,
                e.to,
                edge_type_as_str(e.edge_type)
            ));
        }
        if ids.contains(&e.from) && ids.contains(&e.to) {
            out.push(e);
        }
    }
    out
}
