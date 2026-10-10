mod adr_status;
mod architecture;
mod cursor_auth;
pub mod cursor_enrich;
mod doc_files;
mod infer_architecture;
mod load;
mod metadata;
mod normalize;
mod relationships;
mod types;

pub use architecture::{
    parse_architecture_from_body, ArchEdge, ArchNode, ArchitectureSpec,
};
pub use cursor_auth::{
    allow_graph_without_cursor_key, clear_cursor_api_key, cursor_auth_status,
    cursor_login_interactive, ensure_cursor_api_key_or_prompt, load_cursor_api_key,
    save_cursor_api_key, CURSOR_API_KEY_ENV,
};
pub use load::{load_adr_graph, load_adr_graph_with_options, LoadError, LoadOptions};
pub use types::*;
