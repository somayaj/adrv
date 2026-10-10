mod static_files;

use adrv::{
    allow_graph_without_cursor_key, clear_cursor_api_key, cursor_auth_status,
    cursor_login_interactive, cursor_enrich, ensure_cursor_api_key_or_prompt,
    load_adr_graph_with_options, load_cursor_api_key, AdrGraph, ArchitectureSpec,
    LoadOptions,
};
use std::sync::Mutex;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use clap::{Parser, Subcommand};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

#[derive(Parser)]
#[command(
    name = "adrv",
    about = "ADR dependency graph & architecture visualizer",
    subcommand_required = false
)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Serve the web UI and /api/graph
    Serve {
        /// Directory containing ADR markdown files
        #[arg(long, default_value = "docs/adr")]
        root: PathBuf,
        /// Port to listen on
        #[arg(short, long, default_value_t = 8080)]
        port: u16,
        /// Path to the React UI build (default: ADRV_WEB_DIR, then packages/web/dist, then embedded UI)
        #[arg(long)]
        web: Option<PathBuf>,
    },
    /// Print the ADR graph as JSON (stdout)
    Graph {
        #[arg(long, default_value = "docs/adr")]
        root: PathBuf,
    },
    /// List ADRs that include an architecture model
    Architecture {
        #[arg(long, default_value = "docs/adr")]
        root: PathBuf,
    },
    /// Cursor API token for future AI-assisted ADR interpretation
    Cursor {
        #[command(subcommand)]
        command: CursorCommands,
    },
}

#[derive(Subcommand)]
enum CursorCommands {
    /// Prompt for a token and save it under ~/.adrv/credentials.toml
    Login,
    /// Remove the saved token file
    Logout,
    /// Show whether a token is configured (not the secret)
    Status,
}

struct GraphCache {
    graph: Option<AdrGraph>,
    /// ADR ids left to send to Cursor (one at a time).
    queue: Vec<String>,
    /// Background worker is draining `queue` (or will exit when empty).
    worker_running: bool,
    current_enrich_id: Option<String>,
    /// Progress for the current analyze batch (not all-time enriched count).
    enrich_session_done: u32,
    enrich_session_total: u32,
    /// 0–1 for the in-flight ADR (`current_enrich_id`).
    enrich_item_progress: f32,
}

struct EnrichProgressSnap {
    done: u32,
    total: u32,
    current: Option<String>,
    queued: Vec<String>,
    item_progress: f32,
}

fn enrich_progress_snap(cache: &GraphCache) -> EnrichProgressSnap {
    EnrichProgressSnap {
        done: cache.enrich_session_done,
        total: cache.enrich_session_total,
        current: cache
            .current_enrich_id
            .clone()
            .filter(|id| !id.is_empty()),
        queued: cache.queue.clone(),
        item_progress: cache.enrich_item_progress,
    }
}

fn attach_enrich_progress(graph: &mut AdrGraph, snap: &EnrichProgressSnap) {
    graph.cursor_enrich_done = snap.done;
    graph.cursor_enrich_total = snap.total;
    graph.cursor_enrich_current = snap.current.clone();
    graph.cursor_enrich_queued = snap.queued.clone();
    graph.cursor_enrich_item_progress = snap.item_progress;
}

fn start_enrich_worker_if_needed(state: Arc<AppState>) {
    let should_spawn = {
        let mut cache = state.cache.lock().expect("graph cache lock");
        if cache.queue.is_empty() || cache.worker_running {
            false
        } else {
            cache.worker_running = true;
            true
        }
    };
    if should_spawn {
        spawn_sequential_enrich(state);
    }
}

struct AppState {
    adr_root: PathBuf,
    cache: Mutex<GraphCache>,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let cli = Cli::parse();
    match cli.command.unwrap_or(Commands::Serve {
        root: PathBuf::from("docs/adr"),
        port: 8080,
        web: None,
    }) {
        Commands::Serve { root, port, web } => {
            ensure_cursor_api_key_or_prompt();
            let load_options = graph_load_options();
            serve(root, port, web, load_options).await
        }
        Commands::Graph { root } => graph_json(root, graph_load_options()),
        Commands::Architecture { root } => architecture_list(root),
        Commands::Cursor { command } => match command {
            CursorCommands::Login => {
                if let Err(e) = cursor_login_interactive() {
                    eprintln!("{e}");
                    std::process::exit(1);
                }
            }
            CursorCommands::Logout => {
                if let Err(e) = clear_cursor_api_key() {
                    eprintln!("{e}");
                    std::process::exit(1);
                }
                println!("Removed saved Cursor token.");
            }
            CursorCommands::Status => cursor_auth_status(),
        },
    }
}

fn graph_load_options() -> LoadOptions {
    LoadOptions {
        cursor_enrich: cursor_enrich::cursor_enrich_enabled(),
        // Diagrams: ```architecture``` fences or Cursor Analyze — not prose inference.
        defer_inferred_architecture: true,
    }
}

fn graph_json(root: PathBuf, options: LoadOptions) {
    let graph = load_adr_graph_with_options(&root, options).expect("failed to load ADRs");
    println!("{}", serde_json::to_string_pretty(&graph).expect("json"));
}

fn architecture_list(root: PathBuf) {
    let graph = load_adr_graph_with_options(&root, LoadOptions::default()).expect("failed to load ADRs");
    let with_arch: Vec<(&str, &str, &ArchitectureSpec)> = graph
        .nodes
        .iter()
        .filter_map(|n| {
            n.architecture
                .as_ref()
                .map(|a| (n.id.as_str(), n.title.as_str(), a))
        })
        .collect();
    if with_arch.is_empty() {
        eprintln!("No ```architecture blocks found under {}", root.display());
        std::process::exit(1);
    }
    for (id, title, spec) in with_arch {
        println!(
            "{} — {} ({} nodes, {} edges)",
            id,
            title,
            spec.nodes.len(),
            spec.edges.len()
        );
    }
}

fn web_dir_from_env_or_flag(web: Option<PathBuf>) -> Option<PathBuf> {
    web.or_else(|| std::env::var("ADRV_WEB_DIR").ok().map(PathBuf::from))
}

fn discover_built_web_ui() -> Option<PathBuf> {
    const CANDIDATES: &[&str] = &["packages/web/dist", "web/dist"];
    for rel in CANDIDATES {
        let path = PathBuf::from(rel);
        if path.is_dir() && path.join("index.html").is_file() {
            return Some(path);
        }
    }
    None
}

fn resolve_web_dir(web: Option<PathBuf>) -> Option<PathBuf> {
    web_dir_from_env_or_flag(web).or_else(discover_built_web_ui)
}

async fn serve(adr_root: PathBuf, port: u16, web: Option<PathBuf>, load_options: LoadOptions) {
    let adr_root = adr_root
        .canonicalize()
        .unwrap_or_else(|_| adr_root.clone());

    let _ = load_options;
    let state = Arc::new(AppState {
        adr_root: adr_root.clone(),
        cache: Mutex::new(GraphCache {
            graph: None,
            queue: vec![],
            worker_running: false,
            current_enrich_id: None,
            enrich_session_done: 0,
            enrich_session_total: 0,
            enrich_item_progress: 0.0,
        }),
    });

    let api = Router::new()
        .route("/api/graph", get(api_graph))
        .route("/api/enrich/{adr_id}", post(api_enrich_adr))
        .with_state(state);

    let app = if let Some(web_dir) = resolve_web_dir(web) {
        if !web_dir.is_dir() || !web_dir.join("index.html").is_file() {
            eprintln!(
                "Web UI not found at {} (run: npm run build -w @adrv/web)",
                web_dir.display()
            );
            std::process::exit(1);
        }
        tracing::info!("adrv serving UI from {}", web_dir.display());
        Router::new()
            .merge(api)
            .fallback_service(ServeDir::new(web_dir).append_index_html_on_directories(true))
    } else {
        tracing::info!("adrv serving embedded UI");
        Router::new()
            .merge(api)
            .fallback(static_files::serve_embedded)
    };

    let app = app.layer(CorsLayer::permissive());

    tracing::info!("ADR root: {}", adr_root.display());
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    tracing::info!("Open http://{}/", addr);

    let listener = match tokio::net::TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) if e.kind() == std::io::ErrorKind::AddrInUse => {
            eprintln!("Port {port} is already in use (another adrv serve?). Try --port.");
            std::process::exit(1);
        }
        Err(e) => panic!("bind: {e}"),
    };
    axum::serve(listener, app).await.expect("server");
}

fn graph_shell(
    root: &PathBuf,
    warnings: Vec<String>,
    requires_cursor_key: bool,
    cursor_enriching: bool,
) -> AdrGraph {
    AdrGraph {
        root: root.to_string_lossy().to_string(),
        nodes: vec![],
        edges: vec![],
        warnings,
        requires_cursor_key,
        cursor_enriching,
        ..Default::default()
    }
}

async fn api_graph_local(state: Arc<AppState>) -> Result<Json<AdrGraph>, StatusCode> {
    match load_adr_graph_with_options(&state.adr_root, graph_load_options()) {
        Ok(graph) => Ok(Json(graph)),
        Err(e) => {
            tracing::error!("load graph: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

fn spawn_sequential_enrich(state: Arc<AppState>) {
    tokio::spawn(async move {
        let api_key = match load_cursor_api_key() {
            Some(k) => k,
            None => return,
        };

        loop {
            let id = {
                let mut cache = state.cache.lock().expect("graph cache lock");
                if cache.queue.is_empty() {
                    cache.current_enrich_id = None;
                    cache.worker_running = false;
                    let snap = enrich_progress_snap(&cache);
                    if let Some(g) = cache.graph.as_mut() {
                        g.cursor_enriching = false;
                        attach_enrich_progress(g, &snap);
                    }
                    cache.enrich_session_done = 0;
                    cache.enrich_session_total = 0;
                    cache.enrich_item_progress = 0.0;
                    break;
                }
                let id = cache.queue.remove(0);
                cache.current_enrich_id = Some(id.clone());
                cache.enrich_item_progress = 0.0;
                let snap = enrich_progress_snap(&cache);
                if let Some(g) = cache.graph.as_mut() {
                    g.cursor_enriching = true;
                    attach_enrich_progress(g, &snap);
                }
                id
            };
            let api_key = api_key.clone();

            let mut graph = {
                let cache = state.cache.lock().expect("graph cache lock");
                cache.graph.clone().expect("graph")
            };

            let id_for_msg = id.clone();
            let state_progress = state.clone();
            let result = tokio::task::spawn_blocking(move || {
                let on_poll = |p: f32| {
                    let mut cache = state_progress.cache.lock().expect("graph cache lock");
                    cache.enrich_item_progress = p.clamp(0.0, 1.0);
                    let snap = enrich_progress_snap(&cache);
                    if let Some(g) = cache.graph.as_mut() {
                        attach_enrich_progress(g, &snap);
                    }
                };
                if let Err(e) =
                    cursor_enrich::enrich_one_into_graph(&api_key, &mut graph, &id, Some(&on_poll))
                {
                    graph
                        .warnings
                        .push(format!("Cursor enrichment failed for {id}: {e}"));
                }
                graph
            })
            .await;

            let mut cache = state.cache.lock().expect("graph cache lock");
            let still_enriching = !cache.queue.is_empty();
            match result {
                Ok(mut graph) => {
                    cache.enrich_session_done += 1;
                    cache.current_enrich_id = None;
                    cache.enrich_item_progress = 0.0;
                    graph.cursor_enriching = still_enriching;
                    let snap = enrich_progress_snap(&cache);
                    attach_enrich_progress(&mut graph, &snap);
                    cache.graph = Some(graph);
                }
                Err(e) => {
                    cache.enrich_session_done += 1;
                    cache.enrich_item_progress = 0.0;
                    let snap = enrich_progress_snap(&cache);
                    if let Some(mut graph) = cache.graph.clone() {
                        graph
                            .warnings
                            .push(format!("Cursor task failed for {id_for_msg}: {e}"));
                        graph.cursor_enriching = still_enriching;
                        attach_enrich_progress(&mut graph, &snap);
                        cache.graph = Some(graph);
                    }
                }
            }
        }
        start_enrich_worker_if_needed(state);
    });
}

fn ensure_serve_graph_loaded(
    state: &AppState,
    cache: &mut GraphCache,
) -> Result<(), StatusCode> {
    if cache.graph.is_some() {
        return Ok(());
    }
    let graph = load_adr_graph_with_options(
        &state.adr_root,
        LoadOptions {
            cursor_enrich: false,
            defer_inferred_architecture: true,
        },
    )
    .map_err(|e| {
        tracing::error!("load graph: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    cache.graph = Some(graph);
    Ok(())
}

fn enqueue_adr_enrich(cache: &mut GraphCache, adr_id: &str) -> Result<(), StatusCode> {
    {
        let graph = cache.graph.as_ref().expect("graph");
        if !graph.nodes.iter().any(|n| n.id == adr_id) {
            return Err(StatusCode::NOT_FOUND);
        }
        if graph
            .nodes
            .iter()
            .any(|n| n.id == adr_id && n.cursor_enriched)
        {
            return Ok(());
        }
    }
    if cache.queue.iter().any(|q| q == adr_id) {
        return Ok(());
    }
    if cache.current_enrich_id.as_deref() == Some(adr_id) {
        return Ok(());
    }
    cache.queue.push(adr_id.to_string());
    cache.enrich_session_total += 1;
    let snap = enrich_progress_snap(cache);
    let graph = cache.graph.as_mut().expect("graph");
    graph.cursor_enriching = true;
    attach_enrich_progress(graph, &snap);
    Ok(())
}

fn graph_response(cache: &GraphCache) -> AdrGraph {
    let mut graph = cache.graph.clone().expect("graph");
    let snap = enrich_progress_snap(cache);
    attach_enrich_progress(&mut graph, &snap);
    graph
}

async fn api_enrich_adr(
    State(state): State<Arc<AppState>>,
    Path(adr_id): Path<String>,
) -> Result<Json<AdrGraph>, StatusCode> {
    if allow_graph_without_cursor_key() {
        return Err(StatusCode::NOT_FOUND);
    }
    if load_cursor_api_key().is_none() {
        return Err(StatusCode::UNAUTHORIZED);
    }

    let mut cache = state.cache.lock().expect("graph cache lock");
    ensure_serve_graph_loaded(&state, &mut cache)?;
    enqueue_adr_enrich(&mut cache, &adr_id)?;

    let graph = graph_response(&cache);
    drop(cache);
    start_enrich_worker_if_needed(state);

    Ok(Json(graph))
}

async fn api_graph(
    State(state): State<Arc<AppState>>,
) -> Result<Json<AdrGraph>, StatusCode> {
    if allow_graph_without_cursor_key() {
        return api_graph_local(state).await;
    }

    if load_cursor_api_key().is_none() {
        return Ok(Json(graph_shell(
            &state.adr_root,
            vec![
                "Cursor API key required. Run `adrv cursor login` in a terminal, then refresh."
                    .into(),
            ],
            true,
            false,
        )));
    }

    let mut cache = state.cache.lock().expect("graph cache lock");
    ensure_serve_graph_loaded(&state, &mut cache)?;
    Ok(Json(graph_response(&cache)))
}
