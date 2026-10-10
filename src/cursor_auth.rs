//! Local Cursor API token: env `CURSOR_API_KEY`, else `~/.adrv/credentials.toml`.

use std::fs;
use std::io::{self, IsTerminal};
use std::path::PathBuf;

pub const CURSOR_API_KEY_ENV: &str = "CURSOR_API_KEY";

/// Rule-based graph without Cursor (offline / no API key). Set `ADRV_WITHOUT_CURSOR_KEY=1`.
pub fn allow_graph_without_cursor_key() -> bool {
    std::env::var("ADRV_WITHOUT_CURSOR_KEY").is_ok_and(|v| {
        let v = v.trim().to_lowercase();
        v == "1" || v == "true" || v == "yes"
    })
}

fn credentials_path() -> Option<PathBuf> {
    std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".adrv").join("credentials.toml"))
}

fn read_token_from_file() -> Option<String> {
    let path = credentials_path()?;
    let raw = fs::read_to_string(&path).ok()?;
    for line in raw.lines() {
        let line = line.trim();
        if line.starts_with('#') || line.is_empty() {
            continue;
        }
        if let Some(rest) = line.strip_prefix("cursor_api_token") {
            let rest = rest.trim();
            if let Some(val) = rest.strip_prefix('=') {
                let val = val.trim().trim_matches('"').trim();
                if !val.is_empty() {
                    return Some(val.to_string());
                }
            }
        }
    }
    None
}

/// Token from environment or saved credentials file.
pub fn load_cursor_api_key() -> Option<String> {
    if let Ok(key) = std::env::var(CURSOR_API_KEY_ENV) {
        let key = key.trim();
        if !key.is_empty() {
            return Some(key.to_string());
        }
    }
    read_token_from_file()
}

pub fn save_cursor_api_key(token: &str) -> io::Result<PathBuf> {
    let path = credentials_path().ok_or_else(|| {
        io::Error::new(io::ErrorKind::NotFound, "HOME not set")
    })?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let escaped = token.replace('\\', "\\\\").replace('"', "\\\"");
    let contents = format!("# adrv — do not commit\ncursor_api_token = \"{escaped}\"\n");
    fs::write(&path, contents)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))?;
    }
    Ok(path)
}

pub fn clear_cursor_api_key() -> io::Result<()> {
    let path = credentials_path().ok_or_else(|| {
        io::Error::new(io::ErrorKind::NotFound, "HOME not set")
    })?;
    if path.is_file() {
        fs::remove_file(path)?;
    }
    Ok(())
}

/// Interactive login (used by `adrv cursor login` and default startup).
pub fn cursor_login_interactive() -> io::Result<Option<PathBuf>> {
    eprintln!("Cursor API token — create one at https://cursor.com/settings");
    eprintln!("(Press Enter with an empty line to skip.)");
    let token = dialoguer::Password::new()
        .with_prompt("Token")
        .allow_empty_password(true)
        .interact()
        .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;
    if token.is_empty() {
        eprintln!("No token saved.");
        return Ok(None);
    }
    let path = save_cursor_api_key(&token)?;
    eprintln!(
        "Saved to {} (or set ${}).",
        path.display(),
        CURSOR_API_KEY_ENV
    );
    eprintln!("Cursor enrichment is on by default for adrv serve and adrv graph.");
    Ok(Some(path))
}

/// If no token is configured, prompt once and save (default adrv behavior).
pub fn ensure_cursor_api_key_or_prompt() -> Option<String> {
    if let Some(key) = load_cursor_api_key() {
        return Some(key);
    }
    if !io::stdin().is_terminal() {
        return None;
    }
    match cursor_login_interactive() {
        Ok(_) => load_cursor_api_key(),
        Err(e) => {
            eprintln!("Could not save Cursor token: {e}");
            None
        }
    }
}

pub fn cursor_auth_status() {
    if std::env::var(CURSOR_API_KEY_ENV)
        .map(|s| !s.trim().is_empty())
        .unwrap_or(false)
    {
        println!("Cursor API token: set via {}", CURSOR_API_KEY_ENV);
        return;
    }
    if read_token_from_file().is_some() {
        let path = credentials_path().unwrap_or_default();
        println!("Cursor API token: saved at {}", path.display());
        return;
    }
    println!("Cursor API token: not configured (run `adrv cursor login`)");
}
