use axum::{
    body::Body,
    http::{header, StatusCode, Uri},
    response::{IntoResponse, Response},
};
use rust_embed::Embed;

#[derive(Embed)]
#[folder = "static/"]
struct Assets;

fn asset_response(path: &str) -> Option<Response> {
    Assets::get(path).map(|content| {
        let mime = mime_guess::from_path(path)
            .first_or_octet_stream()
            .to_string();
        Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime)
            .body(Body::from(content.data.into_owned()))
            .unwrap()
    })
}

pub async fn serve_embedded(uri: Uri) -> impl IntoResponse {
    let path = uri.path().trim_start_matches('/');
    let path = if path.is_empty() { "index.html" } else { path };

    if let Some(resp) = asset_response(path) {
        return resp;
    }
    if path != "index.html" {
        return asset_response("index.html")
            .unwrap_or_else(|| (StatusCode::NOT_FOUND, "not found").into_response());
    }
    (StatusCode::NOT_FOUND, "not found").into_response()
}
