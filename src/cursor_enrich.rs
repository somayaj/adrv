use crate::architecture::ArchitectureSpec;
use crate::cursor_auth::CURSOR_API_KEY_ENV;
use crate::types::{AdrEdge, AdrEdgeType, AdrGraph, AdrRecord};
use serde::Deserialize;
use std::collections::{HashMap, HashSet};
use std::thread;
use std::time::Duration;

const API_BASE: &str = "https://api.cursor.com";

#[derive(Debug, Deserialize)]
struct CreateAgentResponse {
    agent: AgentRef,
    run: RunRef,
}

#[derive(Debug, Deserialize)]
struct AgentRef {
    id: String,
}

#[derive(Debug, Deserialize)]
struct RunRef {
    id: String,
}

#[derive(Debug, Deserialize)]
struct RunStatus {
    status: String,
    result: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CursorEnrichment {
    edges: Option<Vec<CursorEdge>>,
    nodes: Option<HashMap<String, CursorNodePatch>>,
}

#[derive(Debug, Deserialize)]
struct SingleAdrResponse {
    edges: Option<Vec<CursorEdge>>,
    steps: Option<Vec<String>>,
    architecture: Option<ArchitectureSpec>,
}

#[derive(Debug, Deserialize)]
struct CursorEdge {
    from: String,
    to: String,
    #[serde(rename = "type")]
    edge_type: String,
}

#[derive(Debug, Deserialize)]
struct CursorNodePatch {
    steps: Option<Vec<String>>,
    architecture: Option<ArchitectureSpec>,
}

fn truncate_body(body: &str, max: usize) -> String {
    if body.len() <= max {
        return body.to_string();
    }
    format!("{}…", body.chars().take(max).collect::<String>())
}

fn preview(text: &str, max: usize) -> String {
    let t = text.trim();
    if t.len() <= max {
        t.to_string()
    } else {
        format!("{}…", t.chars().take(max).collect::<String>())
    }
}

fn build_single_adr_prompt(record: &AdrRecord, peer_ids: &[String]) -> String {
    format!(
        r#"You are a JSON API. Output exactly one JSON object and nothing else (no markdown, no explanation).

Schema:
{{
  "edges": [{{ "from": "{id}", "to": "<peer-id>", "type": "depends-on" | "relates-to" | "supersedes" | "amends" }}],
  "steps": ["ordered decision step strings"],
  "architecture": {{
    "direction": "LR" | "TB",
    "nodes": [{{ "id": "snake", "label": "Label", "kind": "service" }}],
    "edges": [{{ "from": "a", "to": "b" }}]
  }}
}}

Rules:
- ADR id is "{id}". Only use peer ids from this list for edges: [{peers}]
- Read the full BODY carefully. The architecture object must interpret what this ADR decided: real components, data flows, and boundaries implied by the text (not generic placeholders).
- steps should match the decision flow implied by the ADR (ordered, concise).
- Always include architecture with at least 2 nodes and 1 edge when the ADR describes a system change; use labels taken from the ADR wording.
- architecture.kind: client, gateway, service, database, queue, worker, external.

Title: {title}

BODY:
{body}"#,
        id = record.id,
        peers = peer_ids.join(", "),
        title = record.title,
        body = truncate_body(&record.body, 8000),
    )
}

fn parse_edge_type(raw: &str) -> Option<AdrEdgeType> {
    match raw.trim().to_lowercase().as_str() {
        "depends-on" => Some(AdrEdgeType::DependsOn),
        "relates-to" => Some(AdrEdgeType::RelatesTo),
        "supersedes" => Some(AdrEdgeType::Supersedes),
        "superseded-by" => Some(AdrEdgeType::SupersededBy),
        "amends" => Some(AdrEdgeType::Amends),
        _ => None,
    }
}

fn extract_json_object(text: &str) -> Option<String> {
    let trimmed = text.trim();
    if trimmed.starts_with('{') && trimmed.ends_with('}') {
        return Some(trimmed.to_string());
    }
    for fence in ["```json", "```JSON", "```"] {
        if let Some(start) = trimmed.find(fence) {
            let rest = &trimmed[start + fence.len()..];
            if let Some(end) = rest.find("```") {
                let inner = rest[..end].trim();
                if inner.starts_with('{') {
                    return Some(inner.to_string());
                }
            }
        }
    }
    let start = trimmed.find('{')?;
    let mut depth = 0i32;
    for (i, ch) in trimmed[start..].char_indices() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(trimmed[start..start + i + 1].to_string());
                }
            }
            _ => {}
        }
    }
    None
}

fn parse_enrichment_from_text(text: &str, adr_id: &str) -> Result<CursorEnrichment, String> {
    let json_str = extract_json_object(text).ok_or_else(|| {
        format!(
            "Cursor response did not contain JSON (preview: {})",
            preview(text, 240)
        )
    })?;

    if let Ok(batch) = serde_json::from_str::<CursorEnrichment>(&json_str) {
        return Ok(batch);
    }

    let single: SingleAdrResponse = serde_json::from_str(&json_str)
        .map_err(|e| format!("Invalid JSON from Cursor: {e}; preview: {}", preview(&json_str, 200)))?;

    let mut nodes = HashMap::new();
    nodes.insert(
        adr_id.to_string(),
        CursorNodePatch {
            steps: single.steps,
            architecture: single.architecture,
        },
    );
    Ok(CursorEnrichment {
        edges: single.edges,
        nodes: Some(nodes),
    })
}

fn merge_enrichment(graph: &mut AdrGraph, patch: CursorEnrichment) {
    let ids: HashSet<String> = graph.nodes.iter().map(|n| n.id.clone()).collect();

    if let Some(edges) = patch.edges {
        for e in edges {
            if !ids.contains(&e.from) || !ids.contains(&e.to) {
                continue;
            }
            let Some(edge_type) = parse_edge_type(&e.edge_type) else {
                continue;
            };
            let dup = graph.edges.iter().any(|x| {
                x.from == e.from && x.to == e.to && x.edge_type == edge_type
            });
            if dup {
                continue;
            }
            graph.edges.push(AdrEdge {
                from: e.from,
                to: e.to,
                edge_type,
                inferred: true,
            });
        }
    }

    if let Some(nodes) = patch.nodes {
        for node in &mut graph.nodes {
            let Some(p) = nodes.get(&node.id) else {
                continue;
            };
            if let Some(steps) = &p.steps {
                if !steps.is_empty() {
                    node.steps = Some(steps.clone());
                }
            }
            if let Some(arch) = &p.architecture {
                if !arch.nodes.is_empty() {
                    node.architecture = Some(arch.clone());
                }
            }
        }
    }
}

const CURSOR_RUN_MAX_POLLS: u32 = 80;

fn run_cursor_prompt(
    api_key: &str,
    prompt: String,
    on_poll: Option<&dyn Fn(f32)>,
) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_secs(180))
        .build()
        .map_err(|e| e.to_string())?;

    let create_body = serde_json::json!({
        "prompt": { "text": prompt },
        "model": { "id": "auto" },
        "name": "adrv ADR enrich"
    });

    let create: CreateAgentResponse = client
        .post(format!("{API_BASE}/v1/agents"))
        .bearer_auth(api_key)
        .json(&create_body)
        .send()
        .map_err(|e| format!("Cursor API request failed: {e}"))?
        .error_for_status()
        .map_err(|e| format!("Cursor API error: {e}"))?
        .json()
        .map_err(|e| format!("Cursor API response parse error: {e}"))?;

    let run_url = format!(
        "{API_BASE}/v1/agents/{}/runs/{}",
        create.agent.id,
        create.run.id
    );

    if let Some(cb) = on_poll {
        cb(0.02);
    }

    for i in 0..CURSOR_RUN_MAX_POLLS {
        thread::sleep(Duration::from_secs(2));
        if let Some(cb) = on_poll {
            let p = ((i + 1) as f32 / CURSOR_RUN_MAX_POLLS as f32).min(0.98);
            cb(p);
        }
        let run: RunStatus = client
            .get(&run_url)
            .bearer_auth(api_key)
            .send()
            .map_err(|e| format!("Cursor poll failed: {e}"))?
            .error_for_status()
            .map_err(|e| format!("Cursor poll error: {e}"))?
            .json()
            .map_err(|e| format!("Cursor poll parse error: {e}"))?;

        match run.status.as_str() {
            "FINISHED" => {
                if let Some(cb) = on_poll {
                    cb(1.0);
                }
                return run
                    .result
                    .ok_or_else(|| "Cursor run finished with no result text".to_string());
            }
            "ERROR" | "CANCELLED" | "EXPIRED" => {
                return Err(format!("Cursor run ended with status {}", run.status));
            }
            _ => {}
        }
    }
    Err("Cursor run timed out waiting for result".to_string())
}

fn enrich_single_adr(
    api_key: &str,
    record: &AdrRecord,
    peer_ids: &[String],
    on_poll: Option<&dyn Fn(f32)>,
) -> Result<CursorEnrichment, String> {
    let prompt = build_single_adr_prompt(record, peer_ids);
    let text = run_cursor_prompt(api_key, prompt, on_poll)?;
    parse_enrichment_from_text(&text, &record.id)
}

/// Run Cursor for one ADR and merge into `graph` (for background workers).
pub fn enrich_one_into_graph(
    api_key: &str,
    graph: &mut AdrGraph,
    adr_id: &str,
    on_poll: Option<&dyn Fn(f32)>,
) -> Result<(), String> {
    let peer_ids: Vec<String> = graph.nodes.iter().map(|n| n.id.clone()).collect();
    let record = graph
        .nodes
        .iter()
        .find(|n| n.id == adr_id)
        .cloned()
        .ok_or_else(|| format!("ADR {adr_id} not in graph"))?;
    let patch = enrich_single_adr(api_key, &record, &peer_ids, on_poll)?;
    merge_enrichment(graph, patch);
    if let Some(node) = graph.nodes.iter_mut().find(|n| n.id == adr_id) {
        node.cursor_enriched = true;
    }
    Ok(())
}

/// Default cap for `adrv serve` background enrich (matches web list preview).
pub const DEFAULT_CURSOR_ENRICH_MAX: usize = 5;

/// Max ADRs to send to Cursor per session (`ADRV_CURSOR_ENRICH_MAX`, default 5).
pub fn cursor_enrich_max() -> usize {
    std::env::var("ADRV_CURSOR_ENRICH_MAX")
        .ok()
        .and_then(|s| s.parse().ok())
        .filter(|&n| n > 0)
        .unwrap_or(DEFAULT_CURSOR_ENRICH_MAX)
}

pub fn cursor_enrich_queue_ids(node_ids: &[String]) -> Vec<String> {
    let mut ids: Vec<String> = node_ids.to_vec();
    ids.sort();
    ids.truncate(cursor_enrich_max());
    ids
}

/// One ADR at a time; merges each successful result into `graph`.
pub fn enrich_graph_sequential(graph: &mut AdrGraph, api_key: &str) {
    let peer_ids: Vec<String> = graph.nodes.iter().map(|n| n.id.clone()).collect();
    let order = cursor_enrich_queue_ids(&peer_ids);
    let total = order.len();

    for (i, id) in order.iter().enumerate() {
        let Some(record) = graph.nodes.iter().find(|n| n.id == *id).cloned() else {
            continue;
        };
        tracing::info!("Cursor enrich ADR {}/{}: {}", i + 1, total, id);
        match enrich_single_adr(api_key, &record, &peer_ids, None) {
            Ok(patch) => {
                merge_enrichment(graph, patch);
                if let Some(node) = graph.nodes.iter_mut().find(|n| n.id == *id) {
                    node.cursor_enriched = true;
                }
            }
            Err(e) => {
                graph
                    .warnings
                    .push(format!("Cursor enrichment failed for {id}: {e}"));
                tracing::warn!("cursor enrich {id}: {}", e);
            }
        }
    }
}

/// Default: on when a Cursor API key is saved (`adrv cursor login`).
/// Disable with `ADRV_CURSOR_ENRICH=0`. Force on without a saved key: `ADRV_CURSOR_ENRICH=1`.
pub fn cursor_enrich_enabled() -> bool {
    let v = std::env::var("ADRV_CURSOR_ENRICH")
        .ok()
        .map(|s| s.trim().to_lowercase());
    match v.as_deref() {
        Some("0") | Some("false") | Some("no") => return false,
        Some("1") | Some("true") | Some("yes") => return true,
        _ => {}
    }
    crate::cursor_auth::load_cursor_api_key().is_some()
}

pub fn try_enrich_graph(graph: &mut AdrGraph) {
    if !cursor_enrich_enabled() {
        return;
    }
    let api_key = match std::env::var(CURSOR_API_KEY_ENV)
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| crate::cursor_auth::load_cursor_api_key())
    {
        Some(k) => k,
        None => return,
    };

    tracing::info!("Calling Cursor sequentially for each ADR…");
    enrich_graph_sequential(graph, &api_key);
}
