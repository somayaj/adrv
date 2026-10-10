use glob::glob;
use std::path::{Path, PathBuf};

const GLOB_PATTERNS: &[&str] = &[
    "**/*.md",
    "**/*.markdown",
    "**/*.mdx",
    "**/*.txt",
    "**/*.text",
    "**/*.rst",
    "**/*.adoc",
    "**/*.asciidoc",
];

const SKIP_FILE_NAMES: &[&str] = &[
    "readme.md",
    "changelog.md",
    "license",
    "license.md",
    "license.txt",
    "contributing.md",
    "code_of_conduct.md",
];

const SKIP_DIR_PARTS: &[&str] = &[
    "node_modules",
    ".git",
    "target",
    "dist",
    ".cursor",
    ".vite",
];

pub fn collect_document_paths(root: &Path) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    for pat in GLOB_PATTERNS {
        let pattern = root.join(pat).to_string_lossy().to_string();
        for entry in glob(&pattern).unwrap_or_else(|_| glob("").unwrap()) {
            if let Ok(p) = entry {
                if should_skip_path(&p) {
                    continue;
                }
                paths.push(p);
            }
        }
    }
    paths.sort();
    paths.dedup();
    paths
}

fn should_skip_path(path: &Path) -> bool {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_lowercase();
    if SKIP_FILE_NAMES.iter().any(|s| name == *s) {
        return true;
    }
    if name.starts_with('_') || name.starts_with('.') {
        return true;
    }
    for component in path.components() {
        if let std::path::Component::Normal(part) = component {
            let s = part.to_string_lossy().to_lowercase();
            if SKIP_DIR_PARTS.iter().any(|d| s == *d) {
                return true;
            }
        }
    }
    false
}

pub fn read_document_text(path: &Path) -> Result<String, std::io::Error> {
    let bytes = std::fs::read(path)?;
    if bytes.contains(&0) {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidData,
            "binary file",
        ));
    }
    String::from_utf8(bytes).map_err(|_| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, "non-UTF-8 text")
    })
}
