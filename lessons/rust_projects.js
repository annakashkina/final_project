export const rustProjects = { name: "Real Projects", lessons: [
  {
    id: "rust-project-cli",
    title: "CLI Tool: Word Counter",
    difficulty: "Project",
    icon: "🔧",
    description:
      "A complete word counting CLI tool split across modules. Shows how a real Rust project separates concerns: main.rs handles arguments and orchestration, counter.rs owns the counting logic. Error handling uses Result throughout, and the output is formatted for readability.",
    concepts: [
      "Project structure for CLI tools",
      "Separating concerns into modules",
      "Error handling in real apps",
      "Argument parsing patterns",
      "Formatted output",
    ],
    bridges: {
      "C++":
        "Like a multi-file C++ project with main.cpp and utility modules. Rust modules replace header files.",
      Python:
        "Like a Python CLI script split into modules. Rust adds compile-time safety and produces a single binary.",
      Java:
        "Like a main class delegating to helper classes. Rust skips the boilerplate of class-per-file.",
    },
    files: [
      {
        name: "main.rs",
        code: `mod counter;

use std::env;
use std::fs;
use std::process;

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        eprintln!("Usage: wordcount <file> [--lines] [--chars]");
        process::exit(1);
    }

    let file_path = &args[1];
    let show_lines = args.contains(&"--lines".to_string());
    let show_chars = args.contains(&"--chars".to_string());

    let content = fs::read_to_string(file_path).unwrap_or_else(|e| {
        eprintln!("Error reading '{file_path}': {e}");
        process::exit(1);
    });

    let stats = counter::count(&content);
    println!("{:>8} words  {file_path}", stats.words);
    if show_lines { println!("{:>8} lines", stats.lines); }
    if show_chars { println!("{:>8} chars", stats.chars); }
}`,
      },
      {
        name: "counter.rs",
        code: `pub struct Stats {
    pub words: usize,
    pub lines: usize,
    pub chars: usize,
}

pub fn count(text: &str) -> Stats {
    Stats {
        words: text.split_whitespace().count(),
        lines: text.lines().count(),
        chars: text.chars().count(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_words() {
        let s = count("hello world\nfoo bar baz");
        assert_eq!(s.words, 5);
        assert_eq!(s.lines, 2);
        assert_eq!(s.chars, 23);
    }

    #[test]
    fn empty_input() {
        let s = count("");
        assert_eq!(s.words, 0);
    }
}`,
      },
    ],
    seedQuestions: [
      "Why is counter.rs a separate module instead of putting everything in main.rs?",
      "How does unwrap_or_else differ from match for error handling here?",
      "What does the {:>8} format specifier do in the println! call?",
      "How would you add a new stat (like unique words) to this design?",
    ],
  },

  {
    id: "rust-project-library",
    title: "Library: A Stack Data Structure",
    difficulty: "Project",
    icon: "📚",
    description:
      "A generic stack library crate showing idiomatic Rust library design. Stack<T> works with any type, implements Iterator for consuming elements, and Display for printing. The lib.rs defines the public API; main.rs shows usage. This demonstrates how to design reusable data structures with standard trait implementations.",
    concepts: [
      "Library crate design",
      "Generic data structures",
      "Implementing standard traits",
      "Public API design",
      "Documentation patterns",
    ],
    bridges: {
      "C++":
        "Like a template class in a header file. Rust generics are similar but type-checked at definition, not instantiation.",
      Python:
        "Like a class-based data structure, but Rust generics give compile-time type safety. Python relies on duck typing.",
      Java:
        "Very similar to a generic class (Stack<T>). Rust avoids boxing — Stack<i32> stores i32 directly, no Integer wrapper.",
    },
    files: [
      {
        name: "lib.rs",
        code: `use std::fmt;

/// A generic last-in, first-out stack.
pub struct Stack<T> {
    elements: Vec<T>,
}

impl<T> Stack<T> {
    pub fn new() -> Self {
        Stack { elements: Vec::new() }
    }

    pub fn push(&mut self, item: T) {
        self.elements.push(item);
    }

    pub fn pop(&mut self) -> Option<T> {
        self.elements.pop()
    }

    pub fn peek(&self) -> Option<&T> {
        self.elements.last()
    }

    pub fn len(&self) -> usize {
        self.elements.len()
    }

    pub fn is_empty(&self) -> bool {
        self.elements.is_empty()
    }
}

impl<T: fmt::Display> fmt::Display for Stack<T> {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[")?;
        for (i, item) in self.elements.iter().enumerate() {
            if i > 0 { write!(f, ", ")?; }
            write!(f, "{item}")?;
        }
        write!(f, "]")
    }
}

// IntoIterator: consume the stack, yielding top-to-bottom
impl<T> IntoIterator for Stack<T> {
    type Item = T;
    type IntoIter = std::iter::Rev<std::vec::IntoIter<T>>;
    fn into_iter(self) -> Self::IntoIter {
        self.elements.into_iter().rev()
    }
}`,
      },
      {
        name: "main.rs",
        code: `mod lib; // in a real crate this would be: use my_stack::Stack;
use lib::Stack;

fn main() {
    let mut stack: Stack<i32> = Stack::new();
    stack.push(10);
    stack.push(20);
    stack.push(30);

    println!("Stack: {stack}");
    println!("Top: {:?}", stack.peek());
    println!("Popped: {:?}", stack.pop());
    println!("After pop: {stack}");

    // Works with any type
    let mut names: Stack<&str> = Stack::new();
    names.push("Alice");
    names.push("Bob");

    // Iterate (consumes the stack, top-to-bottom)
    for name in names {
        println!("Name: {name}");
    }
}`,
      },
    ],
    seedQuestions: [
      "Why does pop() return Option<T> instead of just T?",
      "How does implementing IntoIterator let you use Stack in a for loop?",
      "Why does Display require the bound T: fmt::Display on the impl?",
      "What would you need to change to make Stack cloneable?",
    ],
  },

  {
    id: "rust-project-data",
    title: "Data Pipeline: Log Analyzer",
    difficulty: "Project",
    icon: "📊",
    description:
      "A log analyzer that parses structured log lines, categorizes by severity, and computes statistics. Combines enums for log levels, structs for parsed entries, iterators for processing, and HashMap for aggregation. Shows how Rust concepts come together in a real data processing pipeline.",
    concepts: [
      "Data pipeline architecture",
      "Parsing with structs and enums",
      "Iterator-based processing",
      "Aggregation with HashMap",
      "Combining all Rust concepts",
    ],
    bridges: {
      "C++":
        "Similar architecture with classes and maps. Rust's enums and iterators make the pipeline more concise and safe.",
      Python:
        "Like a data processing script with dataclasses and Counter. Rust adds type safety and compiles to a fast binary.",
      Java:
        "Like Stream processing with record types. Rust's pattern matching is more ergonomic than Java's switch.",
    },
    files: [
      {
        name: "parser.rs",
        code: `#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Level {
    Info,
    Warn,
    Error,
}

#[derive(Debug)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: Level,
    pub message: String,
}

pub fn parse_line(line: &str) -> Option<LogEntry> {
    let parts: Vec<&str> = line.splitn(3, ' ').collect();
    if parts.len() < 3 { return None; }

    let level = match parts[1] {
        "INFO" => Level::Info,
        "WARN" => Level::Warn,
        "ERROR" => Level::Error,
        _ => return None,
    };

    Some(LogEntry {
        timestamp: parts[0].to_string(),
        level,
        message: parts[2].to_string(),
    })
}`,
      },
      {
        name: "analyzer.rs",
        code: `use std::collections::HashMap;
use crate::parser::{Level, LogEntry};

pub struct Report {
    pub total: usize,
    pub counts: HashMap<Level, usize>,
    pub errors: Vec<String>,
}

pub fn analyze(entries: &[LogEntry]) -> Report {
    let mut counts = HashMap::new();
    let mut errors = Vec::new();

    for entry in entries {
        *counts.entry(entry.level.clone()).or_insert(0) += 1;
        if entry.level == Level::Error {
            errors.push(entry.message.clone());
        }
    }

    Report { total: entries.len(), counts, errors }
}`,
      },
      {
        name: "main.rs",
        code: `mod parser;
mod analyzer;

fn main() {
    let log_data = "\
10:01:05 INFO Server started on port 8080
10:01:12 INFO User alice logged in
10:02:44 WARN Disk usage at 85%
10:03:01 ERROR Connection to database lost
10:03:15 INFO Retrying connection
10:03:22 ERROR Retry failed: timeout";

    let entries: Vec<_> = log_data
        .lines()
        .filter_map(parser::parse_line)
        .collect();

    let report = analyzer::analyze(&entries);

    println!("=== Log Report ===");
    println!("Total entries: {}", report.total);
    for (level, count) in &report.counts {
        println!("  {level:?}: {count}");
    }

    if !report.errors.is_empty() {
        println!("\\nErrors:");
        for msg in &report.errors {
            println!("  - {msg}");
        }
    }
}`,
      },
    ],
    seedQuestions: [
      "Why does parse_line return Option<LogEntry> instead of Result?",
      "How does filter_map combine filtering and transforming in one step?",
      "Why does the Level enum need to derive Hash and Eq to be used as a HashMap key?",
      "How would you extend this to parse log entries from a file instead of a string?",
    ],
  },
] };
