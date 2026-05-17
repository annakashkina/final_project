export const rustTraits = { name: "Traits & Generics", lessons: [
  {
    id: "rust-traits-intro",
    title: "Defining & Implementing Traits",
    difficulty: "Intermediate",
    icon: "🧩",
    description:
      "Traits define shared behavior — a contract that types can implement. A trait can have required methods (implementors must provide) and default methods (implementations provided, can be overridden). You implement a trait for a type with `impl TraitName for TypeName`. Rust's orphan rule means you can only implement a trait if you own either the trait or the type — this prevents conflicting implementations across crates.",
    concepts: [
      "Trait definitions",
      "Required vs default methods",
      "impl Trait for Type",
      "Calling trait methods",
      "Orphan rule (coherence)",
    ],
    bridges: {
      "C++":
        "Like abstract classes with pure virtual methods (required) and regular virtual methods (default). But traits have no data fields.",
      Python:
        "Like ABCs with @abstractmethod for required methods, or Protocols for structural typing. Rust enforces at compile time.",
      Java: "Very similar to interfaces with default methods (Java 8+). impl Trait for Type is like `class Foo implements Bar`.",
    },
    code: `trait Drawable {
    // Required: every implementor must provide these
    fn draw(&self) -> String;
    fn bounding_box(&self) -> (f64, f64);

    // Default: provided, but can be overridden
    fn label(&self) -> String {
        format!("shape({}x{})", self.bounding_box().0, self.bounding_box().1)
    }
}

struct Circle {
    x: f64,
    y: f64,
    radius: f64,
}

struct TextBox {
    content: String,
    width: f64,
    height: f64,
}

impl Drawable for Circle {
    fn draw(&self) -> String {
        format!("circle at ({}, {}) r={}", self.x, self.y, self.radius)
    }
    fn bounding_box(&self) -> (f64, f64) {
        (self.radius * 2.0, self.radius * 2.0)
    }
    // uses default label()
}

impl Drawable for TextBox {
    fn draw(&self) -> String {
        format!("text: \"{}\"", self.content)
    }
    fn bounding_box(&self) -> (f64, f64) {
        (self.width, self.height)
    }
    fn label(&self) -> String {
        format!("\"{}\" ({}x{})", self.content, self.width, self.height)
    }
}

fn render(item: &impl Drawable) {
    println!("{}", item.draw());
    println!("  bounds: {:?}, label: {}", item.bounding_box(), item.label());
}

fn main() {
    let c = Circle { x: 10.0, y: 20.0, radius: 5.0 };
    let t = TextBox { content: "Hello".into(), width: 100.0, height: 30.0 };

    render(&c);
    render(&t);
}`,
    seedQuestions: [
      "What happens if a type implements Drawable but forgets to implement draw()?",
      "When would you override a default method instead of using the provided one?",
      "What is the orphan rule, and why does Rust have it?",
      "Can a single type implement multiple different traits?",
    ],
  },

  {
    id: "rust-generics",
    title: "Generic Types",
    difficulty: "Intermediate",
    icon: "🔲",
    description:
      "Generics let you write code that works with many types without duplicating it. Functions, structs, enums, and impl blocks can all be generic. Rust's Option<T> and Result<T,E> are themselves generic enums. At compile time, the compiler generates specialized code for each concrete type used (monomorphization) — so generics have zero runtime cost. The turbofish syntax ::<T> lets you specify the type explicitly when the compiler can't infer it.",
    concepts: [
      "Generic functions fn foo<T>()",
      "Generic structs and enums",
      "impl<T> blocks",
      "Turbofish ::<T> syntax",
      "Monomorphization (zero-cost)",
    ],
    bridges: {
      "C++":
        "Like templates, but type-checked at definition, not instantiation. No SFINAE needed — use trait bounds instead.",
      Python:
        "Python has no generics at runtime — everything is dynamically typed. Rust generics give the same flexibility with compile-time safety.",
      Java: "Like Java generics but without type erasure. Rust generates separate code per type, so no boxing overhead.",
    },
    code: `struct Bounds<T> {
    min: T,
    max: T,
}

impl<T: PartialOrd + std::fmt::Display> Bounds<T> {
    fn new(a: T, b: T) -> Self {
        if a <= b { Bounds { min: a, max: b } }
        else { Bounds { min: b, max: a } }
    }
    fn contains(&self, val: &T) -> bool {
        val >= &self.min && val <= &self.max
    }
}

// Generic function with where clause
fn find_first<T, F>(items: &[T], predicate: F) -> Option<&T>
where
    F: Fn(&T) -> bool,
{
    items.iter().find(|item| predicate(item))
}

// Generic enum (Option and Result are built this way!)
enum Cached<T> {
    Fresh(T),
    Stale(T),
    Empty,
}

impl<T: std::fmt::Debug> Cached<T> {
    fn get(&self) -> Option<&T> {
        match self {
            Cached::Fresh(val) | Cached::Stale(val) => Some(val),
            Cached::Empty => None,
        }
    }
}

fn main() {
    let int_range = Bounds::new(10, 50);
    println!("[{}, {}]", int_range.min, int_range.max);
    println!("contains 25: {}", int_range.contains(&25));

    // Same code works with f64 — compiler generates both versions
    let float_range = Bounds::new(1.5, 9.9);
    println!("contains 5.0: {}", float_range.contains(&5.0));

    // Turbofish: explicitly specify type when compiler can't infer
    let nums = vec![1, 5, 12, 3, 8];
    let big = find_first(&nums, |n| *n > 10);
    println!("first > 10: {:?}", big);

    let parsed = "42".parse::<i64>().unwrap(); // turbofish on parse
    println!("parsed: {parsed}");

    let cache: Cached<String> = Cached::Fresh("data".to_string());
    println!("cached: {:?}", cache.get());
}`,
    seedQuestions: [
      "What does monomorphization mean, and why does it make generics zero-cost?",
      "Why do we need the bound T: PartialOrd on Bounds<T> — what breaks without it?",
      "When would you use the turbofish ::<T> syntax instead of letting the compiler infer?",
      "How is the Cached<T> enum similar to Option<T>?",
    ],
  },

  {
    id: "rust-trait-bounds",
    title: "Trait Bounds & Where Clauses",
    difficulty: "Intermediate",
    icon: "🔒",
    description:
      "Trait bounds constrain generics: T: Display means 'T must implement Display.' You can require multiple traits with + (T: Display + Clone). Where clauses make complex bounds readable. The shorthand `impl Trait` in argument position is sugar for a generic with a bound. Supertraits (trait A: B) require that any type implementing A must also implement B. You can even add methods to a generic type only when specific bounds are met (conditional implementation).",
    concepts: [
      "Trait bounds T: Display",
      "Multiple bounds with +",
      "where clauses",
      "impl Trait shorthand",
      "Supertraits",
    ],
    bridges: {
      "C++":
        "Like C++20 concepts: requires clauses constrain templates. Before concepts, you relied on SFINAE — much harder to read.",
      Python:
        "Python uses duck typing — if it has the method, it works. Rust trait bounds declare requirements upfront; errors come at the call site, not deep inside.",
      Java: "Like bounded generics: <T extends Comparable<T>>. Supertraits are like interface inheritance.",
    },
    code: `use std::fmt;

// Simple bound: T must implement Display
fn print_labeled<T: fmt::Display>(label: &str, value: T) {
    println!("{label}: {value}");
}

// Multiple bounds with +
fn print_both<T: fmt::Display + fmt::Debug>(val: T) {
    println!("display: {val}, debug: {val:?}");
}

// Where clause: more readable for complex signatures
fn longest_displayed<T>(a: T, b: T) -> T
where T: fmt::Display + PartialOrd {
    println!("comparing: {a} vs {b}");
    if a >= b { a } else { b }
}

// impl Trait shorthand (sugar for a generic with bound)
fn log_item(item: &impl fmt::Display) { println!("[LOG] {item}"); }

// Supertrait: Printable requires Display
trait Printable: fmt::Display {
    fn print(&self) { println!("{self}"); }
}

struct Temperature(f64);
impl fmt::Display for Temperature {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{:.1}\u{00B0}C", self.0)
    }
}
impl Printable for Temperature {}

// Conditional impl: method only exists when bounds are met
struct Pair<T> { a: T, b: T }
impl<T> Pair<T> {
    fn new(a: T, b: T) -> Self { Pair { a, b } }
}
impl<T: PartialOrd + fmt::Display> Pair<T> {
    fn larger(&self) -> &T {
        if self.a >= self.b { &self.a } else { &self.b }
    }
}

fn main() {
    print_labeled("name", "Alice");
    print_labeled("score", 98);
    println!("winner: {}", longest_displayed("alpha", "beta"));

    let temp = Temperature(36.6);
    temp.print(); // works because Temperature: Printable: Display
    log_item(&temp);

    let pair = Pair::new(10, 25);
    println!("larger: {}", pair.larger());
    // Pair<Vec<i32>> would NOT have larger() — Vec doesn't implement Display
}`,
    seedQuestions: [
      "What is the difference between `impl Display` as a parameter and `T: Display`?",
      "Why would you use a where clause instead of inline bounds?",
      "What does a supertrait guarantee about types that implement the sub-trait?",
      "Why does Pair<Vec<i32>> not have the larger() method?",
    ],
  },

  {
    id: "rust-trait-objects",
    title: "Trait Objects & Dynamic Dispatch",
    difficulty: "Intermediate",
    icon: "🎭",
    description:
      "Sometimes you need a collection of different types that share a trait — like a Vec of mixed shapes. Trait objects (dyn Trait) enable this through dynamic dispatch: method calls go through a vtable at runtime instead of being resolved at compile time. Box<dyn Trait> owns a trait object on the heap; &dyn Trait borrows one. The trade-off: dynamic dispatch has a small runtime cost but enables heterogeneous collections. Not all traits are object-safe — traits with generic methods or Self in return position cannot be used as trait objects.",
    concepts: [
      "dyn Trait for dynamic dispatch",
      "Box<dyn Trait> for owned trait objects",
      "Static vs dynamic dispatch trade-offs",
      "Object safety rules",
      "Heterogeneous collections",
    ],
    bridges: {
      "C++":
        "Exactly like virtual functions and vtables. Box<dyn Trait> is like unique_ptr<Base>. Same runtime mechanism.",
      Python:
        "Python always uses dynamic dispatch — every method call is a lookup. Rust makes you choose: static (default, fast) or dynamic (opt-in with dyn).",
      Java: "Like interface references: List<Drawable> where each element is a different class. Java always uses dynamic dispatch for interface methods.",
    },
    code: `use std::fmt;

trait Notifier: fmt::Display {
    fn send(&self, message: &str);
}

struct EmailNotifier { address: String }
struct SlackNotifier { channel: String }
struct LogNotifier;

impl Notifier for EmailNotifier {
    fn send(&self, msg: &str) { println!("  email to {}: {msg}", self.address); }
}
impl fmt::Display for EmailNotifier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Email({})", self.address)
    }
}

impl Notifier for SlackNotifier {
    fn send(&self, msg: &str) { println!("  slack #{}: {msg}", self.channel); }
}
impl fmt::Display for SlackNotifier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "Slack(#{})", self.channel)
    }
}

impl Notifier for LogNotifier {
    fn send(&self, msg: &str) { println!("  log: {msg}"); }
}
impl fmt::Display for LogNotifier {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result { write!(f, "Log") }
}

// Dynamic dispatch: different types behind one trait
fn broadcast(notifiers: &[Box<dyn Notifier>], message: &str) {
    for n in notifiers {
        println!("via {n}:");
        n.send(message); // resolved at runtime via vtable
    }
}

// Static dispatch: compiler knows the exact type, no vtable
fn send_one(notifier: &impl Notifier, msg: &str) { notifier.send(msg); }

fn main() {
    // Heterogeneous collection: each element is a different concrete type
    let notifiers: Vec<Box<dyn Notifier>> = vec![
        Box::new(EmailNotifier { address: "team@corp.com".into() }),
        Box::new(SlackNotifier { channel: "alerts".into() }),
        Box::new(LogNotifier),
    ];
    broadcast(&notifiers, "Server restarted");

    // Static dispatch — compiler generates specialized code
    let email = EmailNotifier { address: "me@dev.com".into() };
    send_one(&email, "Direct message");
}`,
    seedQuestions: [
      "What is the difference between static dispatch and dynamic dispatch?",
      "Why do we need Box<dyn Notifier> instead of just dyn Notifier in the Vec?",
      "What makes a trait 'object-safe' — what restrictions apply?",
      "When would you choose dynamic dispatch over generics with trait bounds?",
    ],
  },

  {
    id: "rust-common-traits",
    title: "Standard Library Traits",
    difficulty: "Intermediate",
    icon: "📚",
    description:
      "Rust's standard library defines traits that give types common behavior: Display for user-facing printing, Debug for developer output, Clone/Copy for duplication, PartialEq/Eq for comparison, Default for default values, and From/Into for type conversions. Most can be auto-implemented with #[derive(...)], but Display must always be implemented manually. Understanding these traits is essential — they appear everywhere in Rust APIs and unlock operators, formatting, and collections.",
    concepts: [
      "Display for user-facing output",
      "Debug for developer output",
      "Clone and Copy semantics",
      "PartialEq/Eq for comparison",
      "derive macro for auto-implementation",
    ],
    bridges: {
      "C++":
        "Display is like operator<<. Clone is like copy constructors. PartialEq is operator==. derive is like compiler-generated special members.",
      Python:
        "Display is __str__, Debug is __repr__. PartialEq is __eq__. Copy is like immutable value semantics. No derive equivalent — Python uses duck typing.",
      Java: "Display is toString(). PartialEq is equals(). Clone is Cloneable. derive is like Lombok's @Data annotation.",
    },
    code: `use std::fmt;

#[derive(Debug, Clone, PartialEq, Default)]
struct Color { r: u8, g: u8, b: u8 }

// Display must be implemented manually — derive cannot do it
impl fmt::Display for Color {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "#{:02X}{:02X}{:02X}", self.r, self.g, self.b)
    }
}

// From/Into: type conversion
impl From<(u8, u8, u8)> for Color {
    fn from((r, g, b): (u8, u8, u8)) -> Self { Color { r, g, b } }
}

// Copy: implicit bitwise copy for small stack types
#[derive(Debug, Clone, Copy, PartialEq)]
struct Point { x: f64, y: f64 }

fn main() {
    let red = Color { r: 255, g: 0, b: 0 };
    println!("display: {red}");          // Display: #FF0000
    println!("debug: {:?}", red);        // Debug: Color { r: 255, .. }

    // Clone: explicit deep copy
    let blue = Color { r: 0, g: 0, b: 255 };
    let blue2 = blue.clone();
    println!("cloned: {blue2}");

    // PartialEq: == comparison (derived field-by-field)
    println!("equal: {}", red == Color { r: 255, g: 0, b: 0 });

    // Default: all fields get default values (0 for u8)
    let black = Color::default();
    println!("default: {black}");

    // From/Into: conversion (implementing From gives you Into free)
    let green: Color = (0, 128, 0).into();
    println!("from tuple: {green}");

    // Copy: no move — both variables stay valid
    let p1 = Point { x: 1.0, y: 2.0 };
    let p2 = p1; // copy, not move!
    println!("p1: {:?}, p2: {:?}", p1, p2); // both valid
}`,
    seedQuestions: [
      "Why can't Display be derived automatically like Debug can?",
      "What is the difference between Clone and Copy — when would a type have Clone but not Copy?",
      "How does implementing From<(u8,u8,u8)> automatically give you Into?",
      "When would you use Debug output vs Display output?",
    ],
  },
] };
