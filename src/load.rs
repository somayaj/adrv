use crate::architecture::{architecture_from_document, parse_architecture_from_body};
use crate::doc_files::{collect_document_paths, read_document_text};
use crate::adr_status::resolve_record_status;
use crate::metadata::{
    date_from_prose, parse_metadata_table, tags_from_metadata, title_from_leading_id_line,
};
use crate::normalize::{normalize_adr_id, title_from_filename};
use crate::relationships::{edges_from_body, edges_from_frontmatter, filter_known_edges};
use crate::types::{AdrGraph, AdrRecord};
use std::collections::HashSet;
use std::collections::HashMap;
use std::path::Path;

#[derive(thiserror::Error, Debug)]
pub enum LoadError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("YAML error: {0}")]
    Yaml(#[from] serde_yaml::Error),
}

fn split_front_matter(raw: &str) -> (Option<serde_yaml::Mapping>, String) {
    let trimmed = raw.trim_start();
    if !trimmed.starts_with("---") {
        return (None, raw.to_string());
    }
    let rest = trimmed.strip_prefix("---").unwrap_or(trimmed);
    let Some(end) = rest.find("\n---") else {
        return (None, raw.to_string());
    };
    let yaml_str = rest[..end].trim();
    let body = rest[end + 4..].trim_start_matches('\n').to_string();
    let mapping: serde_yaml::Mapping = serde_yaml::from_str(yaml_str).unwrap_or_default();
    (Some(mapping), body)
}

fn id_from_path(file_path: &Path, data: &serde_yaml::Mapping) -> String {
    for key in ["adr", "id", "number", "adr-id"] {
        if let Some(v) = data.get(serde_yaml::Value::String(key.to_string())) {
            if let Some(s) = value_as_string(v) {
                if let Some(n) = normalize_adr_id(&s) {
                    return n;
                }
            }
            if let Some(n) = v.as_u64() {
                return format!("{:04}", n);
            }
        }
    }
    let base = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("adr");
    normalize_adr_id(base).unwrap_or_else(|| {
        file_path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("document")
            .to_string()
    })
}

fn title_from_plain_first_line(body: &str) -> Option<String> {
    for line in body.lines() {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        if t.starts_with('#') {
            break;
        }
        if t.len() <= 120 {
            return Some(t.to_string());
        }
        break;
    }
    None
}

fn value_as_string(v: &serde_yaml::Value) -> Option<String> {
    match v {
        serde_yaml::Value::String(s) => Some(s.clone()),
        serde_yaml::Value::Number(n) => Some(n.to_string()),
        _ => None,
    }
}

fn title_from_record(data: &serde_yaml::Mapping, file_path: &Path) -> String {
    for key in ["title", "name"] {
        if let Some(v) = data.get(serde_yaml::Value::String(key.to_string())) {
            if let Some(s) = value_as_string(v) {
                if !s.trim().is_empty() {
                    return s.trim().to_string();
                }
            }
        }
    }
    let base = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("adr.md");
    title_from_filename(base)
}

fn title_from_heading(body: &str) -> Option<String> {
    let re = regex::Regex::new(r"^#{1,6}\s+(.+)$").unwrap();
    let first = body.lines().find_map(|line| re.captures(line))?;
    let h = first.get(1)?.as_str();
    let re2 = regex::Regex::new(r"^(?i)(?:ADR[-\s]*)?\d+\s*[:.\-–—]\s*").unwrap();
    let cleaned = re2.replace(h, "").trim().to_string();
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned)
    }
}

fn parse_tags(data: &serde_yaml::Mapping) -> Vec<String> {
    for key in ["tags", "labels"] {
        if let Some(v) = data.get(serde_yaml::Value::String(key.to_string())) {
            return match v {
                serde_yaml::Value::Sequence(seq) => seq
                    .iter()
                    .filter_map(value_as_string)
                    .collect(),
                serde_yaml::Value::String(s) => s
                    .split(|c| c == ',' || c == ';')
                    .map(|p| p.trim().to_string())
                    .filter(|p| !p.is_empty())
                    .collect(),
                _ => vec![],
            };
        }
    }
    vec![]
}

#[derive(Debug, Clone, Copy, Default)]
pub struct LoadOptions {
    /// Call Cursor Cloud Agents API when an API key is configured.
    pub cursor_enrich: bool,
    /// Omit prose-inferred architecture and numbered Decision steps (Cursor supplies diagrams).
    pub defer_inferred_architecture: bool,
}

pub fn load_adr_graph(adr_root: impl AsRef<Path>) -> Result<AdrGraph, LoadError> {
    load_adr_graph_with_options(adr_root, LoadOptions::default())
}

pub fn load_adr_graph_with_options(
    adr_root: impl AsRef<Path>,
    options: LoadOptions,
) -> Result<AdrGraph, LoadError> {
    let root = adr_root.as_ref().canonicalize().unwrap_or_else(|_| adr_root.as_ref().to_path_buf());
    let mut warnings = Vec::new();
    let paths = collect_document_paths(&root);

    if paths.is_empty() {
        warnings.push(format!("No documents found under {}", root.display()));
        return Ok(AdrGraph {
            root: root.to_string_lossy().to_string(),
            nodes: vec![],
            edges: vec![],
            warnings,
            ..Default::default()
        });
    }

    let mut nodes: Vec<AdrRecord> = Vec::new();
    for file_path in &paths {
        let raw = match read_document_text(file_path) {
            Ok(s) => s,
            Err(e) => {
                warnings.push(format!("Skip {}: {}", file_path.display(), e));
                continue;
            }
        };
        let (fm, body) = split_front_matter(&raw);
        let data = fm.unwrap_or_default();
        let table = parse_metadata_table(&body);
        let id = id_from_path(file_path, &data);
        let mut title = title_from_record(&data, file_path);
        if let Some(h) = title_from_leading_id_line(&body) {
            title = h;
        }
        if let Some(h) = title_from_heading(&body) {
            title = h;
        } else if let Some(h) = title_from_plain_first_line(&body) {
            title = h;
        }
        let status_raw = data
            .get(serde_yaml::Value::String("status".into()))
            .or_else(|| data.get(serde_yaml::Value::String("state".into())))
            .and_then(value_as_string)
            .or_else(|| table.get("status").cloned());
        let date = data
            .get(serde_yaml::Value::String("date".into()))
            .and_then(value_as_string)
            .or_else(|| table.get("date").cloned())
            .or_else(|| date_from_prose(&body));
        let relative = file_path
            .strip_prefix(&root)
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string();

        let body_trim = body.trim().to_string();
        let mut tags = parse_tags(&data);
        for t in tags_from_metadata(&table) {
            if !tags.contains(&t) {
                tags.push(t);
            }
        }
        nodes.push(AdrRecord {
            id,
            title,
            status: resolve_record_status(
                status_raw.as_deref(),
                table.get("status").map(|s| s.as_str()),
                &body_trim,
            ),
            date,
            tags,
            path: file_path.to_string_lossy().to_string(),
            relative_path: relative,
            body: body_trim,
            architecture: None,
            steps: None,
            cursor_enriched: false,
        });
    }

    let ids: HashSet<String> = nodes.iter().map(|n| n.id.clone()).collect();
    let mut all_edges = Vec::new();
    for node in &nodes {
        let raw = read_document_text(Path::new(&node.path)).unwrap_or_default();
        let (fm, body) = split_front_matter(&raw);
        let data = fm.unwrap_or_default();
        all_edges.extend(edges_from_frontmatter(&node.id, &data));
        all_edges.extend(edges_from_body(&node.id, &body));
    }
    let edges = filter_known_edges(all_edges, &ids, &mut warnings);

    let snapshot: HashMap<String, (String, Vec<String>, String)> = nodes
        .iter()
        .map(|n| (n.id.clone(), (n.title.clone(), n.tags.clone(), n.body.clone())))
        .collect();

    for node in &mut nodes {
        let linked: Vec<(String, String, Vec<String>)> = edges
            .iter()
            .filter(|e| e.from == node.id || e.to == node.id)
            .filter_map(|e| {
                let other = if e.from == node.id {
                    e.to.clone()
                } else {
                    e.from.clone()
                };
                snapshot
                    .get(&other)
                    .map(|(title, tags, _)| (other, title.clone(), tags.clone()))
            })
            .collect();
        let (_, _, body) = snapshot.get(&node.id).expect("node");
        let (title, tags, _) = &snapshot[&node.id];
        node.architecture = if options.defer_inferred_architecture {
            parse_architecture_from_body(body)
        } else {
            architecture_from_document(body, title, tags, &linked)
        };
        if !options.defer_inferred_architecture {
            let numbered = crate::infer_architecture::decision_steps_from_body(body);
            if !numbered.is_empty() {
                node.steps = Some(numbered);
            }
        }
    }

    let mut graph = AdrGraph {
        root: root.to_string_lossy().to_string(),
        nodes,
        edges,
        warnings,
        ..Default::default()
    };

    if options.cursor_enrich {
        crate::cursor_enrich::try_enrich_graph(&mut graph);
    }

    Ok(graph)
}

