use serde::{Deserialize, Serialize};

use crate::architecture::ArchitectureSpec;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AdrStatus {
    Proposed,
    Accepted,
    Deprecated,
    Superseded,
    Rejected,
    Unknown,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AdrEdgeType {
    Supersedes,
    #[serde(rename = "superseded-by")]
    SupersededBy,
    #[serde(rename = "depends-on")]
    DependsOn,
    Amends,
    #[serde(rename = "relates-to")]
    RelatesTo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdrRecord {
    pub id: String,
    pub title: String,
    pub status: AdrStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,
    pub tags: Vec<String>,
    pub path: String,
    pub relative_path: String,
    pub body: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub architecture: Option<ArchitectureSpec>,
    /// Ordered decision steps (from markdown or Cursor enrichment).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub steps: Option<Vec<String>>,
    /// Set when Cursor enrichment completed for this ADR.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub cursor_enriched: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdrEdge {
    pub from: String,
    pub to: String,
    #[serde(rename = "type")]
    pub edge_type: AdrEdgeType,
    #[serde(skip_serializing_if = "std::ops::Not::not")]
    pub inferred: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AdrGraph {
    pub root: String,
    pub nodes: Vec<AdrRecord>,
    pub edges: Vec<AdrEdge>,
    pub warnings: Vec<String>,
    /// UI gate: no Cursor API key configured on the server.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub requires_cursor_key: bool,
    /// Waiting for Cursor enrichment before painting the graph.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub cursor_enriching: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cursor_enrich_current: Option<String>,
    #[serde(default, skip_serializing_if = "is_enrich_progress_default")]
    pub cursor_enrich_done: u32,
    #[serde(default, skip_serializing_if = "is_enrich_progress_default")]
    pub cursor_enrich_total: u32,
    /// ADR ids waiting for Cursor (not including `cursor_enrich_current`).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub cursor_enrich_queued: Vec<String>,
    /// 0–1 progress for the ADR in `cursor_enrich_current` (Cursor agent polling).
    #[serde(default, skip_serializing_if = "is_item_progress_default")]
    pub cursor_enrich_item_progress: f32,
}

fn is_enrich_progress_default(v: &u32) -> bool {
    *v == 0
}

fn is_item_progress_default(v: &f32) -> bool {
    *v <= 0.0
}
