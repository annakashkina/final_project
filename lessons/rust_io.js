export const rustIo = { name: "I/O & Files", lessons: [
  {
    id: "rust-file-io",
    title: "File I/O",
    difficulty: "Core",
    icon: "📄",
    description:
      "Reading and writing files in Rust. The simple way (fs::read_to_string, fs::write) handles small files in one call. For large files, BufReader and BufWriter stream data line by line without loading everything into memory.",
    concepts: [
      "fs::read_to_string() and fs::write()",
      "File::open() and File::create()",
      "BufReader for line-by-line reading",
      "BufWriter for buffered output",
      "Error handling with ? for I/O",
    ],
    bridges: {
      "C++":
        "Like ifstream/ofstream but with Result-based error handling instead of checking stream state. BufReader is like the default buffering in fstream.",
      Python:
        "fs::read_to_string is like open(f).read(). BufReader line-by-line is like `for line in open(f)`. Rust just makes errors explicit.",
      Java: "Like Files.readString() for simple reads, BufferedReader for streaming. Same concepts, Rust just uses Result instead of exceptions.",
    },
    code: `use std::fs;
use std::io::{self, BufRead, Write, BufWriter};

fn word_count(path: &str) -> io::Result<(usize, usize, usize)> {
    // Simple: read entire file at once (fine for small files)
    let content = fs::read_to_string(path)?;
    let lines = content.lines().count();
    let words = content.split_whitespace().count();
    let bytes = content.len();
    Ok((lines, words, bytes))
}

fn find_in_file(path: &str, query: &str) -> io::Result<Vec<String>> {
    // Buffered: read line by line (efficient for large files)
    let file = fs::File::open(path)?;
    let reader = io::BufReader::new(file);
    let mut matches = Vec::new();

    for (num, line) in reader.lines().enumerate() {
        let line = line?; // each line can fail (I/O error)
        if line.contains(query) {
            matches.push(format!("{}: {}", num + 1, line));
        }
    }
    Ok(matches)
}

fn write_report(path: &str, items: &[(&str, f64)]) -> io::Result<()> {
    // Simple write: entire content at once
    fs::write("summary.txt", "Report generated\\n")?;

    // Buffered write: efficient for many small writes
    let file = fs::File::create(path)?;
    let mut writer = BufWriter::new(file);

    writeln!(writer, "Item Report")?;
    writeln!(writer, "{:-<30}", "")?;
    for (name, price) in items {
        writeln!(writer, "{:<20} \${:.2}", name, price)?;
    }
    writer.flush()?;
    Ok(())
}

fn main() -> io::Result<()> {
    // Write a sample file to work with
    fs::write("sample.txt", "hello world\\nrust is fast\\nhello rust\\n")?;

    let (lines, words, bytes) = word_count("sample.txt")?;
    println!("{lines} lines, {words} words, {bytes} bytes");

    let matches = find_in_file("sample.txt", "hello")?;
    for m in &matches {
        println!("Found: {m}");
    }

    let items = vec![("Widget", 9.99), ("Gadget", 24.50)];
    write_report("report.txt", &items)?;
    println!("Report written to report.txt");

    // Cleanup
    fs::remove_file("sample.txt")?;
    fs::remove_file("summary.txt")?;
    fs::remove_file("report.txt")?;
    Ok(())
}`,
    seedQuestions: [
      "When would you use BufReader instead of fs::read_to_string()?",
      "Why does reader.lines() return Result<String> for each line instead of just String?",
      "What does the ? operator do in this code, and what happens if a file doesn't exist?",
      "Why call writer.flush() at the end — what could happen without it?",
    ],
  },

  {
    id: "rust-cli-args",
    title: "Command-Line Programs",
    difficulty: "Core",
    icon: "💻",
    description:
      "Building CLI tools in Rust using just the standard library. Parse arguments from std::env::args(), read from stdin, write errors to stderr, and exit with proper codes. This is a complete, minimal grep-like tool.",
    concepts: [
      "std::env::args() for arguments",
      "Parsing CLI arguments",
      "stdin/stdout/stderr",
      "process::exit() with codes",
      "Building complete CLI tools",
    ],
    bridges: {
      "C++":
        "Like argc/argv + cin/cout/cerr, but args() gives you owned Strings instead of raw char pointers.",
      Python:
        "Like sys.argv + input()/print(). Rust's approach is similar but typed. For complex CLIs, crates like clap replace argparse.",
      Java: "Like String[] args + System.in/out/err. Same structure, Rust just keeps it more lightweight.",
    },
    code: `use std::env;
use std::io::{self, BufRead, Write};
use std::process;

fn print_usage() {
    eprintln!("Usage: linefind <pattern> [--count] [--ignore-case]");
    eprintln!("Reads from stdin, prints matching lines");
}

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() < 2 {
        print_usage();
        process::exit(1);
    }

    let pattern = &args[1];
    let count_only = args.contains(&"--count".to_string());
    let ignore_case = args.contains(&"--ignore-case".to_string());

    if pattern.starts_with('-') {
        eprintln!("Error: first argument must be a pattern, got '{pattern}'");
        process::exit(1);
    }

    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut out = io::BufWriter::new(stdout.lock());
    let mut match_count: usize = 0;

    for (num, line) in stdin.lock().lines().enumerate() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Read error on line {}: {e}", num + 1);
                continue;
            }
        };

        let matches = if ignore_case {
            line.to_lowercase().contains(&pattern.to_lowercase())
        } else {
            line.contains(pattern.as_str())
        };

        if matches {
            match_count += 1;
            if !count_only {
                writeln!(out, "{}: {}", num + 1, line).ok();
            }
        }
    }

    if count_only {
        writeln!(out, "{match_count} matches").ok();
    }

    process::exit(if match_count > 0 { 0 } else { 1 });
}`,
    seedQuestions: [
      "Why does the program write errors to stderr (eprintln!) instead of stdout (println!)?",
      "What does process::exit(1) communicate to the shell or calling process?",
      "Why use BufWriter around stdout.lock() instead of just println! in the loop?",
      "How would you modify this to accept a filename argument instead of reading from stdin?",
    ],
  },

  {
    id: "rust-serde",
    title: "Serialization with serde",
    difficulty: "Intermediate",
    icon: "🔄",
    description:
      "serde is Rust's serialization framework. Add #[derive(Serialize, Deserialize)] to a struct and it maps to/from JSON (or TOML, YAML, etc.) automatically. Attributes like #[serde(rename)] and #[serde(default)] handle real-world API quirks.",
    concepts: [
      "serde derive macros",
      "JSON serialization/deserialization",
      "Struct to JSON mapping",
      "Serde attributes (rename, default)",
      "Handling optional fields",
    ],
    bridges: {
      "C++":
        "C++ has no built-in reflection, so JSON libs like nlohmann/json require manual mapping. serde derives it from the struct definition.",
      Python:
        "Like json.loads/dumps but type-safe. Closest is dataclasses + Pydantic — serde does the same compile-time validation.",
      Java: "Like Jackson's @JsonProperty and ObjectMapper, but with zero runtime reflection. All generated at compile time.",
    },
    code: `use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
struct User {
    #[serde(rename = "user_id")]
    id: u64,
    name: String,
    email: String,
    #[serde(default)]           // missing in JSON -> false
    active: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    bio: Option<String>,        // optional field
}

#[derive(Debug, Serialize, Deserialize)]
struct ApiResponse {
    status: String,
    #[serde(rename = "results")]
    users: Vec<User>,
    #[serde(default)]
    page: u32,
}

fn main() {
    // Deserialize: JSON string -> Rust struct
    let json_input = r#"{
        "status": "ok",
        "results": [
            {
                "user_id": 1,
                "name": "Alice",
                "email": "alice@example.com",
                "active": true,
                "bio": "Rust enthusiast"
            },
            {
                "user_id": 2,
                "name": "Bob",
                "email": "bob@example.com"
            }
        ]
    }"#;

    let response: ApiResponse =
        serde_json::from_str(json_input).expect("Failed to parse JSON");
    println!("Status: {}", response.status);

    for user in &response.users {
        println!("  {} (id: {}): {}", user.name, user.id, user.email);
        println!("    active: {}, bio: {:?}", user.active, user.bio);
    }

    // Serialize: Rust struct -> JSON string
    let new_user = User {
        id: 3,
        name: "Charlie".into(),
        email: "charlie@example.com".into(),
        active: true,
        bio: None,
    };

    let json_out = serde_json::to_string_pretty(&new_user).unwrap();
    println!("\\nSerialized:\\n{json_out}");
    // Note: bio is omitted (skip_serializing_if), id becomes "user_id"
}`,
    seedQuestions: [
      "What happens when Bob's JSON is missing the 'active' and 'bio' fields? How does serde handle each?",
      "Why does #[serde(rename = \"user_id\")] exist — when would you need to rename fields?",
      "What's the difference between Option<String> with skip_serializing_if and #[serde(default)]?",
      "What would happen if the JSON had an unexpected field like \"role\": \"admin\"?",
    ],
  },
] };
