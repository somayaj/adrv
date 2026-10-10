use crate::architecture::{ArchEdge, ArchNode, ArchitectureSpec};
use std::collections::HashMap;

struct Component {
    id: String,
    label: String,
    kind: String,
}

fn slugify(label: &str) -> String {
    let mut s: String = label
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    while s.contains("--") {
        s = s.replace("--", "-");
    }
    s.trim_matches('-').to_string()
}

fn classify(label: &str, tags: &[String]) -> String {
    let t = label.to_lowercase();
    let tagstr = tags.join(" ").to_lowercase();
    let hay = format!("{} {}", t, tagstr);
    if hay.contains("postgres")
        || hay.contains("mysql")
        || hay.contains("mongodb")
        || hay.contains("database")
        || (hay.contains("redis") && hay.contains("cache"))
    {
        return "database".to_string();
    }
    if hay.contains("nats")
        || hay.contains("jetstream")
        || hay.contains("kafka")
        || hay.contains("rabbit")
        || hay.contains("queue")
        || hay.contains("event bus")
        || hay.contains("messaging")
    {
        return "queue".to_string();
    }
    if hay.contains("gateway") || hay.contains("edge") && hay.contains("api") {
        return "gateway".to_string();
    }
    if hay.contains("worker") || hay.contains("fulfillment") || hay.contains("projector") {
        return "worker".to_string();
    }
    if hay.contains("mobile")
        || hay.contains("web app")
        || hay.contains("client")
        || hay.contains("browser")
    {
        return "client".to_string();
    }
    if hay.contains("external") || hay.contains("third-party") {
        return "external".to_string();
    }
    "service".to_string()
}

fn clean_step_line(raw: &str) -> String {
    let mut s = raw.trim().to_string();
    let bold = regex::Regex::new(r"\*\*([^*]+)\*\*").unwrap();
    s = bold.replace_all(&s, "$1").to_string();
    s = s.replace('`', "");
    s.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Numbered lines under ## Decision (e.g. `1. Merge…`, `2. Deploy…`) → ordered steps.
pub fn decision_steps_from_body(body: &str) -> Vec<String> {
    let decision = section_text(body, &["Decision"]);
    let re = regex::Regex::new(r"^\s*\d+\.\s+(.+)$").unwrap();
    let mut steps = Vec::new();
    for line in decision.lines() {
        if let Some(cap) = re.captures(line) {
            let step = clean_step_line(cap.get(1).unwrap().as_str());
            if step.len() >= 3 {
                steps.push(step);
            }
        }
    }
    steps
}

fn architecture_from_steps(steps: Vec<String>) -> ArchitectureSpec {
    let mut nodes = Vec::new();
    let mut edges = Vec::new();
    let mut ids = Vec::new();
    for (i, label) in steps.iter().enumerate() {
        let id = format!("step-{}", i + 1);
        ids.push(id.clone());
        nodes.push(ArchNode {
            id,
            label: label.clone(),
            kind: "service".to_string(),
            description: None,
        });
    }
    for i in 0..ids.len().saturating_sub(1) {
        edges.push(ArchEdge {
            from: ids[i].clone(),
            to: ids[i + 1].clone(),
            label: None,
            is_async: None,
        });
    }
    ArchitectureSpec {
        direction: Some("LR".to_string()),
        nodes,
        edges,
    }
}

fn extract_phrases(body: &str) -> Vec<String> {
    let mut out = Vec::new();
    let bold = regex::Regex::new(r"\*\*([^*]{2,80})\*\*").unwrap();
    for m in bold.captures_iter(body) {
        out.push(m.get(1).unwrap().as_str().trim().to_string());
    }
    let code = regex::Regex::new(r"`([^`]{2,60})`").unwrap();
    for m in code.captures_iter(body) {
        out.push(m.get(1).unwrap().as_str().trim().to_string());
    }
    out
}

fn strip_fenced_blocks(body: &str) -> String {
    let re = regex::Regex::new(r"```[\s\S]*?```").unwrap();
    re.replace_all(body, "").to_string()
}

fn section_text(body: &str, names: &[&str]) -> String {
    let mut parts = Vec::new();
    let heading = regex::Regex::new(r"^#{1,3}\s+(.+)$").unwrap();
    let mut current: Option<String> = None;
    let mut buf = String::new();
    for line in body.lines() {
        if let Some(cap) = heading.captures(line) {
            if let Some(name) = current {
                if names.iter().any(|n| name.eq_ignore_ascii_case(n)) {
                    parts.push(buf.clone());
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
            parts.push(buf);
        }
    }
    parts.join("\n")
}

fn add_component(map: &mut HashMap<String, Component>, label: &str, kind: &str) {
    let label = label.trim();
    if label.len() < 2 {
        return;
    }
    let id = slugify(label);
    if id.is_empty() {
        return;
    }
    if !map.contains_key(&id) {
        map.insert(
            id.clone(),
            Component {
                id,
                label: label.to_string(),
                kind: kind.to_string(),
            },
        );
    }
}

fn push_edge(
    edges: &mut Vec<ArchEdge>,
    components: &HashMap<String, Component>,
    from: &str,
    to: &str,
    label: Option<&str>,
    async_edge: bool,
) {
    if from != to && components.contains_key(from) && components.contains_key(to) {
        edges.push(ArchEdge {
            from: from.to_string(),
            to: to.to_string(),
            label: label.map(String::from),
            is_async: if async_edge { Some(true) } else { None },
        });
    }
}

fn wire_components(components: &HashMap<String, Component>) -> Vec<ArchEdge> {
    let mut edges = Vec::new();
    let ids: Vec<String> = components.keys().cloned().collect();
    let kind = |id: &str| components.get(id).map(|c| c.kind.as_str()).unwrap_or("service");

    let gateways: Vec<_> = ids.iter().filter(|id| kind(id) == "gateway").collect();
    let clients: Vec<_> = ids.iter().filter(|id| kind(id) == "client").collect();
    let services: Vec<_> = ids.iter().filter(|id| kind(id) == "service").collect();
    let databases: Vec<_> = ids.iter().filter(|id| kind(id) == "database").collect();
    let queues: Vec<_> = ids.iter().filter(|id| kind(id) == "queue").collect();
    let workers: Vec<_> = ids.iter().filter(|id| kind(id) == "worker").collect();

    for c in &clients {
        for g in &gateways {
            push_edge(&mut edges, components, c.as_str(), g.as_str(), None, false);
        }
    }
    for g in &gateways {
        for s in &services {
            push_edge(&mut edges, components, g.as_str(), s.as_str(), None, false);
        }
    }
    for s in &services {
        for d in &databases {
            push_edge(&mut edges, components, s.as_str(), d.as_str(), Some("data"), false);
        }
        for q in &queues {
            push_edge(
                &mut edges,
                components,
                s.as_str(),
                q.as_str(),
                Some("events"),
                true,
            );
        }
    }
    for q in &queues {
        for w in &workers {
            push_edge(&mut edges, components, q.as_str(), w.as_str(), None, true);
        }
    }
    if gateways.is_empty() && clients.is_empty() && services.len() == 1 && databases.len() == 1 {
        push_edge(
            &mut edges,
            components,
            services[0].as_str(),
            databases[0].as_str(),
            None,
            false,
        );
    }
    if components.len() == 2 && edges.is_empty() {
        let a = &ids[0];
        let b = &ids[1];
        push_edge(&mut edges, components, a, b, None, false);
    }
    edges
}

/// Build an architecture model from ordinary ADR prose (no `architecture` fence required).
pub fn infer_architecture_from_document(
    body: &str,
    title: &str,
    tags: &[String],
    linked: &[(String, String, Vec<String>)], // id, title, tags
) -> Option<ArchitectureSpec> {
    let stripped = strip_fenced_blocks(body);

    let steps = decision_steps_from_body(&stripped);
    if steps.len() >= 2 {
        return Some(architecture_from_steps(steps));
    }

    let focus = section_text(
        &stripped,
        &[
            "Issue",
            "Context",
            "Decision",
            "Argument",
            "Positions",
            "Implications",
            "Consequences",
            "Architecture",
        ],
    );
    let scan = if focus.trim().is_empty() {
        stripped.clone()
    } else {
        focus
    };

    let mut components: HashMap<String, Component> = HashMap::new();

    add_component(
        &mut components,
        title,
        &classify(title, tags),
    );

    for phrase in extract_phrases(&scan) {
        let k = classify(&phrase, tags);
        add_component(&mut components, &phrase, &k);
    }

    if scan.to_lowercase().contains("connection pooling") || scan.to_lowercase().contains("at the edge") {
        add_component(&mut components, "Edge / connection pool", "gateway");
    }
    if scan.to_lowercase().contains("services") && !components.contains_key("services") {
        add_component(&mut components, "Services", "service");
    }

    for (_id, peer_title, peer_tags) in linked {
        let k = classify(peer_title, peer_tags);
        add_component(&mut components, peer_title, &k);
    }

    if components.is_empty() {
        return None;
    }

    let edges = wire_components(&components);
    let nodes: Vec<ArchNode> = components
        .values()
        .map(|c| ArchNode {
            id: c.id.clone(),
            label: c.label.clone(),
            kind: c.kind.clone(),
            description: None,
        })
        .collect();

    Some(ArchitectureSpec {
        direction: Some("TB".to_string()),
        nodes,
        edges,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn infers_postgres_adr() {
        let body = r#"# ADR 0001: Use PostgreSQL for primary database

## Context

We need a relational store for orders, inventory, and billing with strong consistency and mature tooling.

## Decision

Use **PostgreSQL** as the system of record for all transactional data.

## Consequences

- Ops must run managed Postgres (backups, replicas).
- Services use connection pooling at the edge.
"#;
        let spec = infer_architecture_from_document(
            body,
            "Use PostgreSQL for primary database",
            &["data".to_string()],
            &[],
        );
        let spec = spec.expect("spec");
        assert!(spec.nodes.len() >= 2);
    }

    #[test]
    fn infers_numbered_decision_steps() {
        let body = r#"## Decision

1. Merge to trunk **automatically deploys** to launch.
2. Deploy triggers **Octane automation**.
3. Octane runs tests on launch.
"#;
        let spec = infer_architecture_from_document(body, "Flow", &[], &[]).expect("spec");
        assert_eq!(spec.nodes.len(), 3);
        assert_eq!(spec.edges.len(), 2);
        assert_eq!(spec.direction.as_deref(), Some("LR"));
    }
}
