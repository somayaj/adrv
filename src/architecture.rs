use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::LazyLock;

static ARCH_FENCE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"```architecture\s*\n([\s\S]*?)```").unwrap());
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchitectureSpec {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub direction: Option<String>,
    pub nodes: Vec<ArchNode>,
    pub edges: Vec<ArchEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchNode {
    pub id: String,
    pub label: String,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ArchEdge {
    pub from: String,
    pub to: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(rename = "async", skip_serializing_if = "Option::is_none")]
    pub is_async: Option<bool>,
}

fn normalize_kind(raw: &str) -> String {
    let k = raw.to_lowercase();
    match k.as_str() {
        "client" | "gateway" | "service" | "database" | "queue" | "worker" | "external" => k,
        _ => "service".to_string(),
    }
}

pub fn parse_architecture_from_body(body: &str) -> Option<ArchitectureSpec> {
    parse_architecture_fence(body)
}

pub fn architecture_from_document(
    body: &str,
    title: &str,
    tags: &[String],
    linked: &[(String, String, Vec<String>)],
) -> Option<ArchitectureSpec> {
    parse_architecture_fence(body).or_else(|| {
        crate::infer_architecture::infer_architecture_from_document(body, title, tags, linked)
    })
}

fn parse_architecture_fence(body: &str) -> Option<ArchitectureSpec> {
    let m = ARCH_FENCE.captures(body)?;
    let yaml_str = m.get(1)?.as_str().trim();
    let doc: serde_yaml::Value = serde_yaml::from_str(yaml_str).ok()?;
    let mapping = doc.as_mapping()?;

    let nodes_val = mapping.get(serde_yaml::Value::String("nodes".into()))?;
    let nodes_seq = nodes_val.as_sequence()?;
    if nodes_seq.is_empty() {
        return None;
    }

    let mut nodes = Vec::new();
    for item in nodes_seq {
        let m = item.as_mapping()?;
        let id = m
            .get(serde_yaml::Value::String("id".into()))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        if id.is_empty() {
            continue;
        }
        let label = m
            .get(serde_yaml::Value::String("label".into()))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| id.to_string());
        let kind = m
            .get(serde_yaml::Value::String("kind".into()))
            .and_then(|v| v.as_str())
            .map(normalize_kind)
            .unwrap_or_else(|| "service".to_string());
        let description = m
            .get(serde_yaml::Value::String("description".into()))
            .and_then(|v| v.as_str())
            .map(|s| s.trim().to_string());

        nodes.push(ArchNode {
            id: id.to_string(),
            label,
            kind,
            description,
        });
    }

    if nodes.is_empty() {
        return None;
    }

    let mut edges = Vec::new();
    if let Some(edges_val) = mapping.get(serde_yaml::Value::String("edges".into())) {
        if let Some(seq) = edges_val.as_sequence() {
            for item in seq {
                let m = item.as_mapping()?;
                let from = m
                    .get(serde_yaml::Value::String("from".into()))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim();
                let to = m
                    .get(serde_yaml::Value::String("to".into()))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .trim();
                if from.is_empty() || to.is_empty() {
                    continue;
                }
                let label = m
                    .get(serde_yaml::Value::String("label".into()))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string());
                let is_async = m
                    .get(serde_yaml::Value::String("async".into()))
                    .and_then(|v| v.as_bool());
                edges.push(ArchEdge {
                    from: from.to_string(),
                    to: to.to_string(),
                    label,
                    is_async,
                });
            }
        }
    }

    let direction = mapping
        .get(serde_yaml::Value::String("direction".into()))
        .and_then(|v| v.as_str())
        .map(|s| {
            if s.eq_ignore_ascii_case("lr") {
                "LR".to_string()
            } else {
                "TB".to_string()
            }
        });

    Some(ArchitectureSpec {
        direction,
        nodes,
        edges,
    })
}
