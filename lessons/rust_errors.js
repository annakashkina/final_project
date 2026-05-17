export const rustErrors = { name: "Error Handling", lessons: [
  {
    id: "rust-result-option",
    title: "Result & Option",
    difficulty: "Core",
    icon: "⚡",
    description:
      "Rust has no exceptions and no null. Result<T, E> represents operations that can fail — you get Ok(value) or Err(error). Option<T> represents values that might not exist — you get Some(value) or None. The compiler forces you to handle both cases explicitly: you cannot ignore an error or use a possibly-missing value without checking first. unwrap() panics on failure, expect() panics with a message, unwrap_or() gives a default. map() and and_then() let you chain operations without unwrapping at every step.",
    concepts: [
      "Result<T,E> with Ok and Err",
      "Option<T> with Some and None",
      "unwrap vs expect vs unwrap_or",
      "map and and_then for chaining",
      "Pattern matching on Result/Option",
    ],
    bridges: {
      "C++":
        "Result is like std::expected (C++23), Option is like std::optional. No exceptions to catch — errors are values.",
      Python:
        "Instead of try/except, errors are return values. Instead of None checks, Option forces you to handle the missing case.",
      Java: "Option<T> is like java.util.Optional. Result is like checked exceptions but as return types you can't ignore.",
    },
    code: `use std::collections::HashMap;

fn parse_port(input: &str) -> Result<u16, String> {
    let n: u16 = input.trim().parse()
        .map_err(|e| format!("bad port '{input}': {e}"))?;
    if n == 0 {
        return Err("port cannot be zero".to_string());
    }
    Ok(n)
}

fn find_user(id: u32) -> Option<&'static str> {
    let users = HashMap::from([(1, "Alice"), (2, "Bob"), (3, "Carol")]);
    users.get(&id).copied()
}

fn main() {
    // Matching on Result
    match parse_port("8080") {
        Ok(port) => println!("Port: {port}"),
        Err(msg) => eprintln!("Error: {msg}"),
    }

    // unwrap panics on Err, expect panics with your message
    let port = parse_port("443").unwrap();
    let port2 = parse_port("3000").expect("default port must parse");
    println!("ports: {port}, {port2}");

    // unwrap_or provides a fallback, unwrap_or_else computes it lazily
    let fallback = parse_port("abc").unwrap_or(80);
    let lazy = parse_port("xyz").unwrap_or_else(|_| 8080);
    println!("fallback: {fallback}, lazy: {lazy}");

    // Option: values that might not exist
    match find_user(2) {
        Some(name) => println!("Found: {name}"),
        None => println!("User not found"),
    }

    // map transforms the inner value without unwrapping
    let name_len = find_user(1).map(|name| name.len());
    println!("Alice name length: {:?}", name_len); // Some(5)

    // and_then chains operations that themselves return Option
    let greeting = find_user(3)
        .map(|name| format!("Hello, {name}!"))
        .unwrap_or("Hello, stranger!".to_string());
    println!("{greeting}");

    // Combining: parse then look up
    let result = parse_port("not_a_number");
    println!("bad parse: {result:?}"); // Err(...)
}`,
    seedQuestions: [
      "What happens if you call unwrap() on an Err value? When is that acceptable?",
      "How does map() on an Option differ from unwrapping and re-wrapping manually?",
      "Why does Rust use Result instead of exceptions like Python or Java?",
      "What is the difference between unwrap_or and unwrap_or_else?",
    ],
  },

  {
    id: "rust-question-mark",
    title: "The ? Operator",
    difficulty: "Core",
    icon: "❓",
    description:
      "The ? operator is Rust's way of propagating errors up the call chain. When you write expression?, it returns the Ok/Some value if present, or immediately returns the Err/None from the current function. This replaces verbose match blocks with concise one-liners. The ? operator also auto-converts error types using the From trait, so you can use ? with different error types in the same function as long as conversions exist. Functions using ? must return Result or Option.",
    concepts: [
      "? operator for error propagation",
      "Auto-conversion via From trait",
      "? with Result and Option",
      "main() returning Result",
      "Chaining fallible operations",
    ],
    bridges: {
      "C++":
        "No equivalent — you manually check error codes or rely on exceptions. Rust's ? is like an automatic early return on error.",
      Python:
        "Exceptions propagate automatically up the call stack. Rust's ? gives explicit propagation — you see every point where an error can escape.",
      Java: "Like checked exceptions with throws, but ? is opt-in per expression. You see exactly which calls can fail.",
    },
    code: `use std::fs;
use std::num::ParseIntError;

#[derive(Debug)]
struct Config {
    host: String,
    port: u16,
    workers: u16,
}

// Without ?: verbose match nesting
fn parse_port_verbose(s: &str) -> Result<u16, String> {
    match s.trim().parse::<u16>() {
        Ok(port) => {
            if port > 0 { Ok(port) }
            else { Err("port must be positive".into()) }
        }
        Err(e) => Err(format!("invalid port: {e}")),
    }
}

// With ?: clean and linear
fn parse_port(s: &str) -> Result<u16, String> {
    let port: u16 = s.trim().parse()
        .map_err(|e: ParseIntError| format!("invalid port: {e}"))?;
    if port == 0 {
        return Err("port must be positive".into());
    }
    Ok(port)
}

// Chaining multiple ? calls — each can fail independently
fn load_config(path: &str) -> Result<Config, String> {
    let text = fs::read_to_string(path)
        .map_err(|e| format!("cannot read {path}: {e}"))?;

    let mut host = String::from("localhost");
    let mut port = 8080u16;
    let mut workers = 4u16;

    for line in text.lines() {
        let (key, val) = line.split_once('=')
            .ok_or(format!("bad line: {line}"))?; // ? on Option via ok_or
        match key.trim() {
            "host" => host = val.trim().to_string(),
            "port" => port = parse_port(val)?,
            "workers" => workers = val.trim().parse()
                .map_err(|e: ParseIntError| format!("bad workers: {e}"))?,
            _ => {} // ignore unknown keys
        }
    }
    Ok(Config { host, port, workers })
}

// main can return Result — errors print automatically
fn main() -> Result<(), String> {
    let config = load_config("server.conf")?;
    println!("{}:{} with {} workers", config.host, config.port, config.workers);
    Ok(())
}`,
    seedQuestions: [
      "What does the ? operator actually do — what code does it replace?",
      "Why must a function return Result or Option to use ? inside it?",
      "How does ok_or() bridge between Option and Result?",
      "What happens when main() returns an Err — how does the user see it?",
    ],
  },

  {
    id: "rust-custom-errors",
    title: "Custom Error Types",
    difficulty: "Intermediate",
    icon: "🛠️",
    description:
      "Real programs have multiple error sources: file I/O, parsing, validation, network. A custom error enum collects these into one type. You implement Display (for user-facing messages), Error (to participate in Rust's error ecosystem), and From<OtherError> (so the ? operator can auto-convert). For prototyping, Box<dyn Error> catches any error without defining a custom type — but custom enums give callers the ability to match on specific failures.",
    concepts: [
      "Custom error enum",
      "Display and Error trait implementations",
      "From conversions for ?",
      "Box<dyn Error> for prototyping",
      "Error composition from multiple sources",
    ],
    bridges: {
      "C++":
        "Like exception hierarchies (std::runtime_error, etc.) but errors are return values, not thrown. From is like implicit conversion between error types.",
      Python:
        "Like defining custom exception classes (class MyError(Exception)). From conversions are like automatic exception chaining.",
      Java: "Like custom exception classes extending Exception. From conversions replace the catch-and-rethrow pattern.",
    },
    code: `use std::fmt;
use std::fs;
use std::num::ParseIntError;

#[derive(Debug)]
enum ConfigError {
    Io(std::io::Error),
    Parse(ParseIntError),
    Missing(String),
    Invalid(String),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ConfigError::Io(e) => write!(f, "file error: {e}"),
            ConfigError::Parse(e) => write!(f, "parse error: {e}"),
            ConfigError::Missing(key) => write!(f, "missing key: {key}"),
            ConfigError::Invalid(msg) => write!(f, "invalid: {msg}"),
        }
    }
}
impl std::error::Error for ConfigError {}

impl From<std::io::Error> for ConfigError {
    fn from(e: std::io::Error) -> Self { ConfigError::Io(e) }
}
impl From<ParseIntError> for ConfigError {
    fn from(e: ParseIntError) -> Self { ConfigError::Parse(e) }
}

fn load_max_connections(path: &str) -> Result<u32, ConfigError> {
    let text = fs::read_to_string(path)?; // io::Error -> ConfigError via From
    let line = text.lines()
        .find(|l| l.starts_with("max_conn"))
        .ok_or(ConfigError::Missing("max_conn".into()))?;
    let val: u32 = line.split('=').nth(1)
        .ok_or(ConfigError::Invalid("missing '='".into()))?
        .trim()
        .parse()?; // ParseIntError -> ConfigError via From
    if val > 10_000 {
        return Err(ConfigError::Invalid(format!("{val} too high")));
    }
    Ok(val)
}

// Quick alternative: Box<dyn Error> catches anything
fn quick_load(path: &str) -> Result<String, Box<dyn std::error::Error>> {
    let text = fs::read_to_string(path)?;
    let _n: i32 = text.trim().parse()?;
    Ok(text)
}

fn main() {
    match load_max_connections("app.conf") {
        Ok(n) => println!("Max connections: {n}"),
        Err(ConfigError::Missing(key)) => eprintln!("Add '{key}' to config"),
        Err(e) => eprintln!("Config error: {e}"),
    }
}`,
    seedQuestions: [
      "Why do we need both Display and Error trait implementations?",
      "How does the From<std::io::Error> impl let us use ? with io errors?",
      "When would you choose Box<dyn Error> over a custom error enum?",
      "What does the source() method do and when would a caller use it?",
    ],
  },
] };
