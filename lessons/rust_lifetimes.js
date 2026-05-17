export const rustLifetimes = { name: "Lifetimes", lessons: [
  {
    id: "rust-lifetime-basics",
    title: "Lifetime Annotations",
    difficulty: "Intermediate",
    icon: "⏳",
    description:
      "Lifetimes are Rust's way of ensuring references are always valid. Most of the time the compiler infers them, but sometimes you need to annotate them explicitly to tell the compiler how reference lifetimes relate. A lifetime annotation like 'a doesn't change how long a reference lives — it describes the relationship between lifetimes of multiple references so the borrow checker can verify correctness.",
    concepts: [
      "Why lifetimes exist",
      "Lifetime annotation syntax 'a",
      "Lifetime parameters on functions",
      "References must not outlive their data",
      "The borrow checker validates lifetimes",
    ],
    bridges: {
      "C++":
        "In C++, dangling pointers are runtime bugs (use-after-free). Rust catches these at compile time with lifetimes — no sanitizer needed.",
      Python:
        "Python's garbage collector handles object lifetimes automatically. Rust has no GC — lifetimes let the compiler prove safety statically.",
      Java:
        "Java's GC ensures references never dangle. Rust achieves the same guarantee at compile time with zero runtime cost.",
    },
    code: `// Without lifetime annotations, the compiler can't tell which
// input reference the return value is tied to.
// 'a says: the return value lives at least as long as BOTH inputs.
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

// This function is fine — it always returns x, but the compiler
// doesn't analyze function bodies to figure that out.
fn always_first<'a>(x: &'a str, _y: &str) -> &'a str {
    x // return is tied only to x's lifetime
}

fn main() {
    let novel = String::from("Call me Ishmael");
    let result;

    {
        let article = String::from("The quick brown fox");
        // Both references are valid here, so this works
        result = longest(novel.as_str(), article.as_str());
        println!("Longest: {result}");
    }
    // result can't be used here — article is dropped, and
    // result might point to it. The compiler rejects this:
    // println!("{result}"); // ERROR: \`article\` does not live long enough

    // always_first doesn't tie return to _y, so this is fine:
    let safe_result;
    {
        let temp = String::from("temporary");
        safe_result = always_first(novel.as_str(), temp.as_str());
    }
    println!("First: {safe_result}"); // OK: tied to novel, not temp

    // Without annotations, this wouldn't compile:
    // fn broken(x: &str, y: &str) -> &str { x }
    // ERROR: missing lifetime specifier
}`,
    seedQuestions: [
      "Why can't the compiler just look at the function body to figure out which reference is returned?",
      "What does 'a actually mean — does it change how long something lives?",
      "Why can we use safe_result after the inner block but not result?",
      "When does the compiler require you to write lifetime annotations?",
    ],
  },

  {
    id: "rust-lifetime-elision",
    title: "Lifetime Elision Rules",
    difficulty: "Intermediate",
    icon: "✨",
    description:
      "Rust has three lifetime elision rules that let the compiler infer lifetimes in common patterns, so you don't have to annotate them every time. Rule 1: each input reference gets its own lifetime parameter. Rule 2: if there's exactly one input lifetime, the output gets it. Rule 3: if one of the inputs is &self or &mut self, the output gets self's lifetime. When these rules don't fully determine output lifetimes, you must annotate explicitly.",
    concepts: [
      "Three lifetime elision rules",
      "When annotations are not needed",
      "Single input reference rule",
      "&self method rule",
      "When elision fails",
    ],
    bridges: {
      "C++":
        "C++ has no equivalent concept — there's no compiler tracking of reference validity, so no rules to elide.",
      Python:
        "No equivalent. Python's GC means reference validity is never a concern for the programmer.",
      Java:
        "No equivalent. Java's GC handles this entirely at runtime.",
    },
    code: `struct Config {
    name: String,
    verbose: bool,
}

impl Config {
    // Rule 3: &self input -> output gets self's lifetime
    // The compiler sees: fn name<'a>(&'a self) -> &'a str
    fn name(&self) -> &str {
        &self.name
    }

    // Rule 3 again: output tied to &self, not to prefix
    fn display_name(&self, prefix: &str) -> String {
        format!("{prefix}: {}", self.name) // returns owned String, no lifetime issue
    }
}

// Rule 2: one input reference -> output gets its lifetime
// Compiler sees: fn first_word<'a>(s: &'a str) -> &'a str
fn first_word(s: &str) -> &str {
    s.split_whitespace().next().unwrap_or("")
}

// Rule 2 again: one input -> output inherits it
fn trim_and_lower(input: &str) -> &str {
    input.trim()
}

// Rule 1 applies but doesn't resolve the output:
// Compiler sees: fn pick<'a, 'b>(a: &'a str, b: &'b str) -> &??? str
// Two inputs, no &self — which lifetime does the return get?
// MUST annotate explicitly:
fn pick<'a>(a: &'a str, b: &'a str, take_first: bool) -> &'a str {
    if take_first { a } else { b }
}

// No lifetime needed: returns an owned value, not a reference
fn make_greeting(name: &str) -> String {
    format!("Hello, {name}!")
}

fn main() {
    let cfg = Config { name: "prod-server".into(), verbose: true };
    println!("{}", cfg.name());          // Rule 3
    println!("{}", cfg.display_name("Server")); // owned return

    let text = "  hello world  ";
    println!("First: '{}'", first_word(text));  // Rule 2
    println!("Trimmed: '{}'", trim_and_lower(text)); // Rule 2

    let a = String::from("alpha");
    let b = String::from("beta");
    println!("Picked: {}", pick(&a, &b, true)); // explicit 'a

    println!("{}", make_greeting("Rust")); // no lifetime needed
}`,
    seedQuestions: [
      "Why doesn't first_word need a lifetime annotation but pick does?",
      "What's special about &self that gives it its own elision rule?",
      "If a function returns an owned String, does it ever need lifetime annotations?",
      "What happens when the compiler applies Rule 1 but can't determine the output lifetime?",
    ],
  },

  {
    id: "rust-lifetime-structs",
    title: "Lifetimes in Structs",
    difficulty: "Intermediate",
    icon: "📌",
    description:
      "When a struct holds a reference instead of owning data, it must declare a lifetime parameter. This tells the compiler that the struct cannot outlive the data it borrows. This is common for parsers, iterators, and views into larger data. The impl block must also carry the lifetime parameter.",
    concepts: [
      "Structs holding references",
      "Lifetime parameters on structs",
      "impl blocks with lifetimes",
      "Struct lifetime vs field lifetime",
      "Practical use cases for borrowed structs",
    ],
    bridges: {
      "C++":
        "Storing references in C++ structs compiles fine but risks dangling — a common source of undefined behavior. Rust's lifetimes make this safe.",
      Python:
        "No equivalent. Python objects hold references freely since GC keeps everything alive as long as it's reachable.",
      Java:
        "No equivalent. Java's GC means you never worry about a field's referent being collected while the object exists.",
    },
    code: `// A struct that borrows text — it cannot outlive the source
#[derive(Debug)]
struct Excerpt<'a> {
    text: &'a str,
    line_number: usize,
}

// impl block must declare the same lifetime parameter
impl<'a> Excerpt<'a> {
    fn new(text: &'a str, line_number: usize) -> Self {
        Excerpt { text, line_number }
    }

    // Elision Rule 3: return tied to &self
    fn first_word(&self) -> &str {
        self.text.split_whitespace().next().unwrap_or("")
    }
}

// A parser that holds a reference to its input
struct Parser<'src> {
    remaining: &'src str,
}

impl<'src> Parser<'src> {
    fn new(source: &'src str) -> Self {
        Parser { remaining: source }
    }

    // Returns a slice from the original source — tied to 'src
    fn next_line(&mut self) -> Option<&'src str> {
        if self.remaining.is_empty() { return None; }
        let (line, rest) = self.remaining
            .split_once('\\n')
            .unwrap_or((self.remaining, ""));
        self.remaining = rest;
        Some(line)
    }
}

fn main() {
    let document = String::from("Rust makes references safe\\nNo GC needed");

    let excerpt = Excerpt::new("Rust makes references safe", 1);
    println!("{:?}, first word: '{}'", excerpt, excerpt.first_word());

    let mut parser = Parser::new(&document);
    while let Some(line) = parser.next_line() {
        println!("Line: {line}");
    }

    // Struct can't outlive its source — this would fail:
    // let dangling;
    // { let temp = String::from("gone");
    //   dangling = Excerpt::new(&temp, 1); }
    // println!("{:?}", dangling); // ERROR: temp dropped
}`,
    seedQuestions: [
      "Why does Excerpt need a lifetime parameter but a struct with only owned Strings doesn't?",
      "What would happen if we tried to use an Excerpt after the source String is dropped?",
      "In Parser::next_word, why is the return type &'input str instead of &str tied to &self?",
      "When should you store a reference in a struct versus cloning the data?",
    ],
  },

  {
    id: "rust-lifetime-advanced",
    title: "Advanced Lifetime Patterns",
    difficulty: "Advanced",
    icon: "🔬",
    description:
      "Beyond basic annotations: multiple lifetime parameters let you express that different references have different scopes. The 'static lifetime means a reference lives for the entire program. Lifetime bounds (T: 'a) constrain generics, and trait objects need lifetime bounds too. Knowing when to use references vs owned data is a key Rust design decision.",
    concepts: [
      "Multiple lifetime parameters",
      "'static lifetime",
      "Lifetime bounds (T: 'a)",
      "Lifetimes in trait objects",
      "Choosing between references and owned data",
    ],
    bridges: {
      "C++":
        "C++ has no equivalent to lifetime parameters or 'static. The closest is const char* pointing to string literals, which are similarly program-lifetime.",
      Python:
        "No equivalent. All Python objects live on the heap and are GC'd. The concept of a 'static reference doesn't apply.",
      Java:
        "No equivalent. String literals in Java are interned and GC-managed. There's no way to express reference lifetime constraints.",
    },
    code: `use std::fmt::Display;

// Multiple lifetimes: return tied only to 'c, not 'm
fn annotate<'c, 'm>(content: &'c str, tag: &'m str) -> &'c str {
    println!("Tagged with: {tag}");
    content
}

// 'static: reference valid for the entire program
fn app_version() -> &'static str {
    "1.0.0" // string literals are always 'static
}

fn language_kind(name: &str) -> &'static str {
    match name { "rust" => "systems", "python" => "scripting", _ => "unknown" }
}

// Lifetime bound: T must live at least as long as 'a
struct Ref<'a, T: Display + 'a> {
    value: &'a T,
}

impl<'a, T: Display + 'a> Ref<'a, T> {
    fn show(&self) { println!("Ref: {}", self.value); }
}

// Trait objects need lifetime bounds
trait Processor {
    fn process(&self, input: &str) -> String;
}

struct Upper;
impl Processor for Upper {
    fn process(&self, input: &str) -> String { input.to_uppercase() }
}

// Box<dyn Trait + 'a> — trait object can hold refs with lifetime 'a
fn make_processor<'a>(_config: &'a str) -> Box<dyn Processor + 'a> {
    Box::new(Upper)
}

fn main() {
    let content = String::from("important data");
    {
        let tag = String::from("v2");
        let result = annotate(&content, &tag);
        println!("{result}"); // works: result tied to content, not tag
    }

    println!("Version: {}", app_version());
    println!("Rust is a {} language", language_kind("rust"));

    let value = 42;
    Ref { value: &value }.show(); // T: 'a bound satisfied

    let proc = make_processor("default");
    println!("{}", proc.process("hello"));
}`,
    seedQuestions: [
      "Why would you use two different lifetime parameters instead of one shared 'a?",
      "What makes string literals 'static — where do they live in memory?",
      "What does the bound T: 'a mean and when do you need it?",
      "When should you choose owned data (String) over borrowed (&str) in a struct?",
    ],
  },
] };
