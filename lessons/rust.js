export const rustLessons = { name: "Rust", lessons: [
  {
    id: "ownership",
    title: "Ownership & Borrowing",
    difficulty: "Essential",
    icon: "🔑",
    description:
      "The core concept that makes Rust unique. Every value has exactly one owner, and when ownership moves, the old variable is gone.",
    concepts: [
      "Ownership and move semantics",
      "Borrowing with & (immutable references)",
      "Mutable references with &mut",
      "The borrow checker's rules",
    ],
    bridges: {
      "C++":
        "Like unique_ptr but enforced at compile time. No use-after-free possible.",
      Python:
        "In Python every variable is a reference-counted pointer. In Rust, there's exactly one owner.",
      Java: "No garbage collector. The compiler handles memory at compile time.",
    },
    code: `fn main() {
    // Ownership: each value has exactly one owner
    let s1 = String::from("hello");
    let s2 = s1;
    // println!("{s1}"); // COMPILE ERROR: s1 was moved to s2
    println!("{s2}");

    // Clone: explicit deep copy
    let s3 = s2.clone();
    println!("s2 = {s2}, s3 = {s3}");

    // Borrowing: lend without giving up ownership
    let s4 = String::from("world");
    let len = calculate_length(&s4);
    println!("'{s4}' has length {len}"); // s4 still valid!

    // Mutable borrow: one &mut at a time, no & alongside
    let mut s5 = String::from("hello");
    change(&mut s5);
    println!("{s5}");

    // Stack types (i32, bool, char) implement Copy - no move
    let x = 42;
    let y = x;
    println!("x = {x}, y = {y}"); // both valid!
}

fn calculate_length(s: &String) -> usize {
    s.len()
    // s goes out of scope, but since it doesn't own the String, nothing happens
}

fn change(s: &mut String) {
    s.push_str(", world");
}`,
    seedQuestions: [
      "What happens to s1 after `let s2 = s1`? Why?",
      "Why can we still use s4 after passing it to calculate_length?",
      "What would happen if we tried to create two &mut references to s5 at the same time?",
      "Why don't integers (i32) get moved like Strings do?",
    ],
  },

  {
    id: "enums-matching",
    title: "Enums & Pattern Matching",
    difficulty: "Core",
    icon: "🎯",
    description:
      "Rust enums can hold data in each variant. Combined with match, they replace inheritance hierarchies and null checks.",
    concepts: [
      "Enums with data in variants",
      "Exhaustive pattern matching",
      "Destructuring in match arms",
      "impl blocks on enums",
    ],
    bridges: {
      "C++":
        "Like std::variant + std::visit, but with nicer syntax and compile-time exhaustiveness.",
      Python:
        "Think of it as tagged unions. Python has no equivalent — closest is class hierarchies.",
      Java: "Replaces both enum + switch AND the visitor pattern. Much more concise.",
    },
    code: `use std::f64::consts::PI;

enum Shape {
    Circle(f64),                         // tuple variant
    Rectangle(f64, f64),                 // two fields
    Triangle { base: f64, height: f64 }, // named fields (struct variant)
}

impl Shape {
    fn area(&self) -> f64 {
        match self {
            Shape::Circle(radius) => PI * radius * radius,
            Shape::Rectangle(w, h) => w * h,
            Shape::Triangle { base, height } => 0.5 * base * height,
        }
    }

    fn describe(&self) -> &str {
        match self {
            Shape::Circle(_) => "circle",
            Shape::Rectangle(_, _) => "rectangle",
            Shape::Triangle { .. } => "triangle",
        }
    }

    fn is_large(&self) -> bool {
        self.area() > 50.0
    }
}

fn classify(shape: &Shape) {
    match shape {
        Shape::Circle(r) if *r > 10.0 => println!("Big circle!"),
        Shape::Circle(_) => println!("Small circle"),
        Shape::Rectangle(w, h) if (w - h).abs() < f64::EPSILON => {
            println!("It's a square!")
        }
        _ => println!("Some other shape"),
    }
}

fn main() {
    let shapes = vec![
        Shape::Circle(5.0),
        Shape::Rectangle(4.0, 4.0),
        Shape::Triangle { base: 3.0, height: 8.0 },
    ];

    for shape in &shapes {
        println!("{}: area = {:.2}", shape.describe(), shape.area());
        classify(shape);
    }

    // if let: when you only care about one variant
    let maybe_circle = Shape::Circle(7.0);
    if let Shape::Circle(r) = &maybe_circle {
        println!("Radius is {r}");
    }
}`,
    seedQuestions: [
      "What happens if you forget a variant in a match? (e.g. leave out Triangle)",
      "What does the `{ .. }` pattern mean in describe()?",
      "How is `if let` different from a full `match`?",
      "Can you add methods to an enum just like a struct?",
    ],
  },

  {
    id: "error-handling",
    title: "Error Handling",
    difficulty: "Core",
    icon: "⚡",
    description:
      "No exceptions, no null. Rust uses Result<T, E> for operations that can fail and Option<T> for values that might not exist.",
    concepts: [
      "Result<T, E> for fallible operations",
      "Option<T> instead of null",
      "The ? operator for error propagation",
      "Custom error types with From conversions",
    ],
    bridges: {
      "C++":
        "Like std::expected (C++23) or std::optional. No exceptions to catch.",
      Python:
        "Instead of try/except, errors are return values you must handle. Like if every function returned (result, error).",
      Java: "Like Optional<T> but for errors too. Checked exceptions concept, but as return types.",
    },
    code: `use std::fs;
use std::num::ParseIntError;

#[derive(Debug)]
enum AppError {
    Parse(ParseIntError),
    Validation(String),
    Io(std::io::Error),
}

// From traits let ? auto-convert errors
impl From<ParseIntError> for AppError {
    fn from(e: ParseIntError) -> Self {
        AppError::Parse(e)
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e)
    }
}

fn parse_age(input: &str) -> Result<u8, AppError> {
    let age: u8 = input.trim().parse()?; // ? converts ParseIntError -> AppError
    if age == 0 || age > 150 {
        return Err(AppError::Validation(
            format!("Age {age} out of range 1-150"),
        ));
    }
    Ok(age)
}

fn load_age(path: &str) -> Result<u8, AppError> {
    let contents = fs::read_to_string(path)?; // ? converts io::Error -> AppError
    parse_age(&contents)
}

fn main() {
    // Result: match on success or specific error variant
    match load_age("age.txt") {
        Ok(age) => println!("Age: {age}"),
        Err(AppError::Parse(e)) => eprintln!("Bad format: {e}"),
        Err(AppError::Validation(msg)) => eprintln!("Invalid: {msg}"),
        Err(AppError::Io(e)) => eprintln!("File error: {e}"),
    }

    // Option: values that might not exist
    let names = vec!["Alice", "Bob", "Charlie"];
    let second: Option<&&str> = names.get(1);
    let tenth: Option<&&str> = names.get(9);

    println!("Second: {}", second.unwrap_or(&&"nobody"));

    // Chaining with map, and_then, unwrap_or
    let length = tenth
        .map(|name| name.len())
        .unwrap_or(0);
    println!("Tenth name length: {length}");

    // if let with Option
    if let Some(name) = names.get(0) {
        println!("First: {name}");
    }

    // Converting between Option and Result
    let parsed: Result<i32, &str> = "42"
        .parse::<i32>()
        .ok()                // Result -> Option (discards error)
        .filter(|&n| n > 0) // keep only positive
        .ok_or("not a positive number"); // Option -> Result
    println!("Parsed: {parsed:?}");
}`,
    seedQuestions: [
      "What does the ? operator do? How does it know which error type to convert to?",
      "Why does Rust use Result instead of exceptions?",
      "What's the difference between unwrap() and unwrap_or()?",
      "When would you use Option vs Result?",
    ],
  },

  {
    id: "traits-generics",
    title: "Traits & Generics",
    difficulty: "Intermediate",
    icon: "🧩",
    description:
      "Traits define shared behavior (like interfaces). Generics let you write code that works with many types while staying type-safe.",
    concepts: [
      "Defining and implementing traits",
      "Default method implementations",
      "Generic functions with trait bounds",
      "impl Trait syntax (argument and return position)",
    ],
    bridges: {
      "C++":
        "Traits = concepts (C++20). Generics = templates but type-checked at definition, not instantiation.",
      Python:
        "Like ABCs/Protocols but enforced at compile time. No duck typing — you declare what you need.",
      Java: "Like interfaces with default methods + bounded generics. Very similar mental model.",
    },
    code: `use std::fmt;

trait Summary {
    // Required: implementors must provide these
    fn headline(&self) -> String;
    fn author(&self) -> &str;

    // Default implementation: can be overridden
    fn preview(&self) -> String {
        format!("{} — by {}", self.headline(), self.author())
    }
}

struct BlogPost {
    title: String,
    author: String,
    content: String,
}

struct Tweet {
    username: String,
    content: String,
    reply: bool,
}

impl Summary for BlogPost {
    fn headline(&self) -> String {
        self.title.clone()
    }
    fn author(&self) -> &str {
        &self.author
    }
    // uses default preview()
}

impl Summary for Tweet {
    fn headline(&self) -> String {
        format!("@{}: {}", self.username, self.content)
    }
    fn author(&self) -> &str {
        &self.username
    }
    fn preview(&self) -> String {
        let kind = if self.reply { "reply" } else { "tweet" };
        format!("[{kind}] {}", self.headline())
    }
}

// Display trait: how to print with {}
impl fmt::Display for BlogPost {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "\\"{}\\" by {}", self.title, self.author)
    }
}

// impl Trait in argument position (sugar for generics)
fn notify(item: &impl Summary) {
    println!("Breaking: {}", item.preview());
}

// Explicit generic with trait bound (same as above but more flexible)
fn notify_twice<T: Summary + fmt::Debug>(item: &T) {
    println!("1: {}", item.preview());
    println!("2: {:?}", item);
}

// Generic function with trait bound
fn largest<T: PartialOrd>(list: &[T]) -> &T {
    let mut result = &list[0];
    for item in &list[1..] {
        if item > result {
            result = item;
        }
    }
    result
}

// Returning impl Trait (caller doesn't know concrete type)
fn make_greeter(name: String) -> impl Fn() -> String {
    move || format!("Hello from {name}!")
}

fn main() {
    let post = BlogPost {
        title: String::from("Rust Traits Explained"),
        author: String::from("ferris"),
        content: String::from("Traits are Rust's way of defining shared behavior..."),
    };

    let tweet = Tweet {
        username: String::from("rustlang"),
        content: String::from("Rust 2024 edition is here!"),
        reply: false,
    };

    notify(&post);
    notify(&tweet);
    println!("{post}"); // uses Display

    let numbers = vec![34, 50, 25, 100, 65];
    println!("Largest number: {}", largest(&numbers));

    let greet = make_greeter("World".into());
    println!("{}", greet());
}`,
    seedQuestions: [
      "What's the difference between a default method and a required method in a trait?",
      "Why use `impl Summary` vs `T: Summary` as a function parameter?",
      "Can a type implement multiple traits? How?",
      "What does `impl Fn() -> String` as a return type mean?",
    ],
  },

  {
    id: "lifetimes",
    title: "Lifetimes",
    difficulty: "Advanced",
    icon: "⏳",
    description:
      "Lifetimes tell the compiler how long references are valid. Usually inferred, but sometimes you must annotate them explicitly.",
    concepts: [
      "Why lifetimes exist",
      "Lifetime annotations on functions",
      "Lifetime annotations on structs",
      "Lifetime elision rules",
      "'static lifetime",
    ],
    bridges: {
      "C++":
        "Like if the compiler tracked every pointer's validity scope and refused to compile dangling references.",
      Python:
        "Python's GC means you never think about this. In Rust, the compiler proves references are valid — no GC needed.",
      Java: "Similar to Python — GC handles it. Rust trades GC for compile-time proof of reference validity.",
    },
    code: `// The compiler needs to know: does the return value live as long as x or y?
// 'a says: the returned reference lives at least as long as BOTH inputs
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

// Struct holding a reference: must declare the lifetime
#[derive(Debug)]
struct Excerpt<'a> {
    text: &'a str,
    line: usize,
}

impl<'a> Excerpt<'a> {
    // Lifetime elision: compiler infers &self's lifetime for return
    fn first_word(&self) -> &str {
        self.text.split_whitespace().next().unwrap_or("")
    }

    // When return could come from self OR another ref, must be explicit
    fn with_prefix(&self, prefix: &str) -> String {
        // Returns owned String, so no lifetime issues
        format!("[L{}] {}: {}", self.line, prefix, self.text)
    }
}

fn find_line<'a>(text: &'a str, query: &str) -> Option<Excerpt<'a>> {
    for (i, line) in text.lines().enumerate() {
        if line.contains(query) {
            return Some(Excerpt {
                text: line,
                line: i + 1,
            });
        }
    }
    None
}

// Elision rule: single input reference -> output gets same lifetime
fn first_line(text: &str) -> &str {
    text.lines().next().unwrap_or("")
}

fn main() {
    // Basic: both references must live long enough
    let result;
    let s1 = String::from("long string is long");
    {
        let s2 = String::from("xyz");
        result = longest(s1.as_str(), s2.as_str());
        println!("Longest: {result}");
    }
    // Can't use \`result\` here — s2 is dropped, and result might point to it

    // Struct with lifetime
    let novel = String::from(
        "Call me Ishmael.\\n\\
         Some years ago, never mind how long precisely,\\n\\
         having little or no money in my purse",
    );

    if let Some(excerpt) = find_line(&novel, "precisely") {
        println!("Found: {:?}", excerpt);
        println!("First word: {}", excerpt.first_word());
        println!("{}", excerpt.with_prefix("Moby Dick"));
    }

    // Elided lifetime: compiler handles it
    let line = first_line(&novel);
    println!("First line: {line}");

    // 'static: lives for the entire program
    let s: &'static str = "I exist for the whole program";
    println!("{s}");
}`,
    seedQuestions: [
      "Why can't we use `result` after the inner block where s2 is dropped?",
      "What does 'a mean in `fn longest<'a>(...)`? Is it a type?",
      "Why doesn't first_word() need explicit lifetime annotations?",
      "When would you actually need to write lifetime annotations in practice?",
    ],
  },

  // ===== CODEBASE LESSONS: minigrep =====
  {
    id: "minigrep-overview",
    title: "minigrep: How It Fits Together",
    difficulty: "Project",
    icon: "📦",
    description:
      "A real CLI tool that searches files for text. Three files, one clear purpose. See how a Rust project is structured.",
    concepts: [
      "Project structure & modules",
      "CLI argument parsing",
      "Error propagation with ?",
      "Separating binary vs library logic",
    ],
    bridges: {
      "C++": "Like splitting into main.cpp, config.h, and search.cpp — but Rust uses modules instead of headers.",
      Python: "Like having main.py, config.py, search.py — but with compile-time module resolution.",
      Java: "Like Main.java, Config.java, Search.java — but without class-per-file ceremony.",
    },
    files: [
      {
        name: "main.rs",
        code: `use std::env;
use std::process;

mod config;
mod search;

fn main() {
    let args: Vec<String> = env::args().collect();

    let config = config::Config::build(&args).unwrap_or_else(|err| {
        eprintln!("Problem parsing arguments: {err}");
        process::exit(1);
    });

    println!("Searching for '{}' in '{}'", config.query, config.file_path);

    if let Err(e) = run(config) {
        eprintln!("Application error: {e}");
        process::exit(1);
    }
}

fn run(config: config::Config) -> Result<(), Box<dyn std::error::Error>> {
    let contents = std::fs::read_to_string(&config.file_path)?;

    let results = if config.ignore_case {
        search::search_case_insensitive(&config.query, &contents)
    } else {
        search::search(&config.query, &contents)
    };

    for line in results {
        println!("{line}");
    }

    Ok(())
}`,
      },
      {
        name: "config.rs",
        code: `pub struct Config {
    pub query: String,
    pub file_path: String,
    pub ignore_case: bool,
}

impl Config {
    pub fn build(args: &[String]) -> Result<Config, &'static str> {
        if args.len() < 3 {
            return Err("not enough arguments (usage: minigrep QUERY FILE)");
        }

        let query = args[1].clone();
        let file_path = args[2].clone();
        let ignore_case = std::env::var("IGNORE_CASE").is_ok();

        Ok(Config { query, file_path, ignore_case })
    }
}`,
      },
      {
        name: "search.rs",
        code: `pub fn search<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
    contents
        .lines()
        .filter(|line| line.contains(query))
        .collect()
}

pub fn search_case_insensitive<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
    let query = query.to_lowercase();
    contents
        .lines()
        .filter(|line| line.to_lowercase().contains(&query))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn case_sensitive() {
        let query = "duct";
        let contents = "Rust:\\nsafe, fast, productive.\\nPick three.\\nDuct tape.";
        assert_eq!(vec!["safe, fast, productive."], search(query, contents));
    }

    #[test]
    fn case_insensitive() {
        let query = "rUsT";
        let contents = "Rust:\\nsafe, fast, productive.\\nPick three.\\nTrust me.";
        assert_eq!(
            vec!["Rust:", "Trust me."],
            search_case_insensitive(query, contents)
        );
    }
}`,
      },
    ],
    seedQuestions: [
      "How does main.rs know about config.rs and search.rs?",
      "What does unwrap_or_else do differently from just unwrap?",
      "Why is run() a separate function from main()?",
      "What does Box<dyn std::error::Error> mean?",
    ],
  },

  {
    id: "minigrep-search",
    title: "minigrep: Search & Lifetimes",
    difficulty: "Project",
    icon: "🔍",
    description:
      "The search logic uses lifetimes, iterators, and closures in just a few lines. All the concepts come together here.",
    concepts: [
      "Lifetimes in practice (why search needs 'a)",
      "Iterator chains: lines(), filter(), collect()",
      "Closures as filter predicates",
      "Testing with #[cfg(test)]",
    ],
    bridges: {
      "C++": "Like returning string_views — the lifetime ensures they don't outlive the source string.",
      Python: "Like [line for line in text.split('\\n') if query in line] — but Rust tracks the memory.",
      Java: "Like Stream.filter().collect() — but lifetimes prove the results won't dangle.",
    },
    files: [
      {
        name: "search.rs",
        code: `pub fn search<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
    contents
        .lines()
        .filter(|line| line.contains(query))
        .collect()
}

pub fn search_case_insensitive<'a>(query: &str, contents: &'a str) -> Vec<&'a str> {
    let query = query.to_lowercase();
    contents
        .lines()
        .filter(|line| line.to_lowercase().contains(&query))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn case_sensitive() {
        let query = "duct";
        let contents = "Rust:\\nsafe, fast, productive.\\nPick three.\\nDuct tape.";
        assert_eq!(vec!["safe, fast, productive."], search(query, contents));
    }

    #[test]
    fn case_insensitive() {
        let query = "rUsT";
        let contents = "Rust:\\nsafe, fast, productive.\\nPick three.\\nTrust me.";
        assert_eq!(
            vec!["Rust:", "Trust me."],
            search_case_insensitive(query, contents)
        );
    }
}`,
      },
      {
        name: "main.rs (caller)",
        code: `// In main.rs, search is called like this:

fn run(config: config::Config) -> Result<(), Box<dyn std::error::Error>> {
    let contents = std::fs::read_to_string(&config.file_path)?;

    let results = if config.ignore_case {
        search::search_case_insensitive(&config.query, &contents)
    } else {
        search::search(&config.query, &contents)
    };

    // results borrows from contents — both live in this scope
    for line in results {
        println!("{line}");
    }

    Ok(())
}`,
      },
    ],
    seedQuestions: [
      "Why does search need lifetime 'a on contents but not on query?",
      "What would break if we removed the lifetime annotations?",
      "Why does search_case_insensitive call to_lowercase() on a new String?",
      "How does #[cfg(test)] work — does test code ship in the binary?",
    ],
  },
] };
