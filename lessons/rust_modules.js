export const rustModules = { name: "Modules & Packages", lessons: [
  {
    id: "rust-modules",
    title: "Modules & Visibility",
    difficulty: "Core",
    icon: "📁",
    description:
      "Rust's module system organizes code into a tree of namespaces with explicit visibility control. By default everything is private. The mod keyword declares a module, pub makes items public, and use brings items into scope. Modules can be nested inline or split across files. Re-exports with pub use let you present a clean public API regardless of internal structure.",
    concepts: [
      "mod keyword for modules",
      "pub for visibility control",
      "use for bringing items into scope",
      "Nested modules",
      "Re-exports with pub use",
    ],
    bridges: {
      "C++":
        "Modules are like namespaces but with built-in visibility control — no need for separate header files. pub is like public, default is like private.",
      Python:
        "Like Python's import and packages, but with explicit visibility. In Python everything is public by convention; in Rust it's private by default.",
      Java:
        "Similar to Java packages with access modifiers. pub ~ public, default ~ private, pub(crate) ~ package-private.",
    },
    files: [
      {
        name: "main.rs",
        code: `mod network;

use network::server::start;
// Re-export makes this work without reaching into internals:
use network::Connection;

fn main() {
    let conn = Connection::new("10.0.0.1", 8080);
    println!("Connecting to {}", conn.address());
    start(conn);
}`,
      },
      {
        name: "network/mod.rs",
        code: `pub mod server;
mod internal;

// Re-export: users see network::Connection
// without knowing about internal module
pub use internal::Connection;

pub fn default_port() -> u16 {
    8080
}`,
      },
      {
        name: "network/internal.rs",
        code: `pub struct Connection {
    host: String,
    port: u16,
}

impl Connection {
    pub fn new(host: &str, port: u16) -> Self {
        Connection { host: host.into(), port }
    }

    pub fn address(&self) -> String {
        format!("{}:{}", self.host, self.port)
    }

    // Private: only accessible within this module
    fn raw_socket(&self) -> String {
        format!("socket({})", self.address())
    }
}`,
      },
      {
        name: "network/server.rs",
        code: `use super::Connection;
use super::default_port;

pub fn start(conn: Connection) {
    println!("Server listening on {}", conn.address());
    println!("Default port: {}", default_port());
}

// pub(crate): visible anywhere in this crate, but not to external users
pub(crate) fn health_check() -> bool {
    true
}

// pub(super): visible only to parent module (network)
pub(super) fn internal_status() -> &'static str {
    "running"
}`,
      },
    ],
    seedQuestions: [
      "Why can main.rs use Connection directly instead of network::internal::Connection?",
      "What's the difference between pub, pub(crate), and pub(super)?",
      "Why is raw_socket private and how would you make it accessible outside the module?",
      "How does `use super::Connection` work in server.rs?",
    ],
  },

  {
    id: "rust-crates",
    title: "Crates & Cargo.toml",
    difficulty: "Core",
    icon: "📦",
    description:
      "A crate is Rust's unit of compilation — either a binary (runs) or a library (imported). Cargo.toml is the manifest that declares metadata, dependencies, and features. Dependencies use semantic versioning, and feature flags enable optional functionality. Cargo handles fetching, building, and linking everything.",
    concepts: [
      "Cargo.toml structure",
      "Adding dependencies",
      "Semantic versioning in Rust",
      "Binary vs library crates",
      "Feature flags",
    ],
    bridges: {
      "C++":
        "Cargo.toml is like CMakeLists.txt + conan/vcpkg config combined. Cargo handles what CMake, a package manager, and a build system do separately in C++.",
      Python:
        "Like pyproject.toml + pip. Cargo is both the package manager and build tool, similar to how Poetry or PDM work.",
      Java:
        "Like pom.xml (Maven) or build.gradle. Dependencies with version ranges, build configuration, and artifact metadata in one file.",
    },
    files: [
      {
        name: "Cargo.toml",
        code: `[package]
name = "web-crawler"
version = "0.1.0"
edition = "2021"
description = "A simple web crawler"

# Binary crate: produces an executable
[[bin]]
name = "crawler"
path = "src/main.rs"

# Library crate: can be imported by other crates
[lib]
name = "web_crawler"
path = "src/lib.rs"

[dependencies]
reqwest = { version = "0.12", features = ["json"] }  # HTTP client with JSON support
tokio = { version = "1", features = ["full"] }       # async runtime
serde = { version = "1.0", features = ["derive"] }   # serialization
scraper = "0.20"                                      # HTML parsing
log = "0.4"                                           # logging facade

[dev-dependencies]
# Only used in tests and benchmarks
mockito = "1.4"
criterion = "0.5"

[features]
default = ["logging"]
logging = ["log"]            # enabled by default
advanced = ["scraper"]       # opt-in: cargo build --features advanced`,
      },
      {
        name: "src/lib.rs",
        code: `// Library root: defines what this crate exports
pub mod crawler;
pub mod parser;

// Re-export key types for convenience
pub use crawler::Crawler;
pub use parser::Page;`,
      },
      {
        name: "src/main.rs",
        code: `// Binary crate: uses the library crate
use web_crawler::Crawler;

fn main() {
    let urls = vec![
        "https://example.com",
        "https://example.org",
    ];

    let crawler = Crawler::new(3); // max depth 3
    for url in urls {
        match crawler.fetch(url) {
            Ok(page) => println!("Fetched: {} ({} links)", page.url, page.link_count()),
            Err(e) => eprintln!("Failed {url}: {e}"),
        }
    }
}`,
      },
    ],
    seedQuestions: [
      "What's the difference between [dependencies] and [dev-dependencies]?",
      "How does the binary crate (main.rs) use the library crate (lib.rs) in the same project?",
      "What does the version string \"0.12\" mean — which versions does it accept?",
      "How would you enable the 'advanced' feature when building this crate?",
    ],
  },

  {
    id: "rust-workspaces",
    title: "Workspaces",
    difficulty: "Intermediate",
    icon: "🏢",
    description:
      "A workspace is a set of related crates that share a single Cargo.lock, output directory, and optionally dependency versions. The root Cargo.toml defines [workspace] with a list of member crates. This is ideal for large projects or monorepos where multiple crates need to stay in sync. Workspace-level commands like `cargo test` run across all members.",
    concepts: [
      "Workspace Cargo.toml",
      "Shared dependency versions",
      "Inter-crate path dependencies",
      "When to use workspaces",
      "Workspace-level commands",
    ],
    bridges: {
      "C++":
        "Like a CMake project with add_subdirectory() for each component. The workspace root is like the top-level CMakeLists.txt.",
      Python:
        "Like a monorepo with multiple packages sharing a single virtual environment. Similar to what tools like uv workspaces or pip's editable installs achieve.",
      Java:
        "Like a multi-module Maven or Gradle project. The root pom.xml/build.gradle defines submodules, dependency versions are managed centrally.",
    },
    files: [
      {
        name: "Cargo.toml (workspace root)",
        code: `[workspace]
members = [
    "crates/core",
    "crates/api",
    "crates/cli",
]
# All members must use the same resolver
resolver = "2"

# Shared dependency versions — members inherit these
[workspace.dependencies]
serde = { version = "1.0", features = ["derive"] }
tokio = { version = "1", features = ["full"] }
log = "0.4"
thiserror = "2"`,
      },
      {
        name: "crates/core/Cargo.toml",
        code: `[package]
name = "myapp-core"
version = "0.1.0"
edition = "2021"

[dependencies]
# Inherit version from workspace — stays in sync automatically
serde = { workspace = true }
thiserror = { workspace = true }`,
      },
      {
        name: "crates/api/Cargo.toml",
        code: `[package]
name = "myapp-api"
version = "0.1.0"
edition = "2021"

[dependencies]
# Depend on sibling crate via path
myapp-core = { path = "../core" }
serde = { workspace = true }
tokio = { workspace = true }`,
      },
      {
        name: "crates/cli/Cargo.toml",
        code: `[package]
name = "myapp-cli"
version = "0.1.0"
edition = "2021"

# This is the binary users install
[[bin]]
name = "myapp"
path = "src/main.rs"

[dependencies]
myapp-core = { path = "../core" }
myapp-api = { path = "../api" }
tokio = { workspace = true }
log = { workspace = true }`,
      },
      {
        name: "crates/cli/src/main.rs",
        code: `use myapp_core::Config;
use myapp_api::Client;

fn main() {
    let config = Config::from_env();
    let client = Client::new(&config);

    // Workspace commands apply to all members:
    //   cargo build          — builds core, api, and cli
    //   cargo test           — tests all crates
    //   cargo test -p myapp-core  — test just core
    //   cargo run -p myapp-cli    — run just the CLI

    println!("myapp v{}", env!("CARGO_PKG_VERSION"));
    println!("Server: {}", config.server_url());
    client.ping();
}`,
      },
    ],
    seedQuestions: [
      "What does `serde = { workspace = true }` mean and why is it useful?",
      "How does myapp-api depend on myapp-core — what does `path = \"../core\"` do?",
      "Why share a single Cargo.lock across workspace members?",
      "When would you split a project into a workspace instead of keeping everything in one crate?",
    ],
  },
] };
