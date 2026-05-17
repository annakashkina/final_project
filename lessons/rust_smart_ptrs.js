export const rustSmartPtrs = { name: "Smart Pointers", lessons: [
  {
    id: "rust-box",
    title: "Box<T> & Heap Allocation",
    difficulty: "Advanced",
    icon: "📦",
    description:
      "By default, Rust allocates on the stack. Box<T> puts data on the heap — you get a pointer on the stack that owns heap memory. You need Box for recursive types (whose size can't be known at compile time), large data you don't want to copy on the stack, and trait objects (dyn Trait). Box<T> implements Deref, so you can use it like a regular reference in most contexts.",
    concepts: [
      "Box::new() for heap allocation",
      "Stack vs heap allocation",
      "Recursive types need indirection",
      "Deref coercion",
      "Box for trait objects",
    ],
    bridges: {
      "C++":
        "Similar to std::unique_ptr — single owner, heap allocation, auto-cleanup. But Box has Deref coercion built in.",
      Python:
        "Everything in Python is heap-allocated behind the scenes. Box makes this explicit and single-owner.",
      Java:
        "Everything except primitives is heap-allocated in Java. Box is like that but with exactly one owner and no GC.",
    },
    code: `use std::fmt;

// Recursive type: needs Box because the compiler can't know the size
#[derive(Debug)]
enum Tree {
    Leaf(i32),
    Node(Box<Tree>, i32, Box<Tree>),
}

impl Tree {
    fn sum(&self) -> i32 {
        match self {
            Tree::Leaf(v) => *v,
            Tree::Node(left, v, right) => left.sum() + v + right.sum(),
        }
    }
}

// Trait object: Box<dyn Trait> for dynamic dispatch
trait Describe: fmt::Display {
    fn kind(&self) -> &str;
}
impl Describe for String { fn kind(&self) -> &str { "string" } }
impl Describe for i32    { fn kind(&self) -> &str { "integer" } }

fn make_item(use_string: bool) -> Box<dyn Describe> {
    if use_string { Box::new(String::from("hello")) }
    else { Box::new(42i32) }
}

fn greet(name: &str) { println!("Hello, {name}!"); }

fn main() {
    let boxed = Box::new(41);
    println!("Boxed value: {}", *boxed + 1);

    // Deref coercion: Box<String> -> &String -> &str
    let boxed_name = Box::new(String::from("Rust"));
    greet(&boxed_name);

    // Recursive type
    let tree = Tree::Node(
        Box::new(Tree::Leaf(1)),
        2,
        Box::new(Tree::Node(Box::new(Tree::Leaf(3)), 4, Box::new(Tree::Leaf(5)))),
    );
    println!("Tree sum: {}", tree.sum());

    // Trait object: return type decided at runtime
    let item = make_item(true);
    println!("{} is a {}", item, item.kind());
}`,
    seedQuestions: [
      "Why does the Tree enum need Box around its children but not around the i32 value?",
      "How does Deref coercion let us pass &Box<String> where &str is expected?",
      "What would happen if we tried to define Tree without Box — would it compile?",
      "When would you use Box<dyn Trait> instead of generics with trait bounds?",
    ],
  },

  {
    id: "rust-rc-arc",
    title: "Rc<T> & Arc<T>",
    difficulty: "Advanced",
    icon: "🔗",
    description:
      "Sometimes one owner isn't enough. Rc<T> (Reference Counted) allows multiple owners of the same heap data in a single thread — each clone increments a counter, and the data is freed when the last owner drops. Arc<T> (Atomic Reference Counted) does the same thing but is safe to share across threads. Rc is cheaper than Arc because it skips atomic operations, so use Rc when you don't need threads.",
    concepts: [
      "Rc<T> for shared ownership",
      "Reference counting with Rc::clone()",
      "Rc::strong_count()",
      "Arc<T> for thread-safe sharing",
      "Rc vs Arc trade-offs",
    ],
    bridges: {
      "C++":
        "Rc is like std::shared_ptr (single-threaded). Arc is like std::shared_ptr with atomic refcount (the C++ default).",
      Python:
        "Python uses reference counting internally for all objects. Rc makes this explicit and visible.",
      Java:
        "Java's GC handles shared references automatically. Rc/Arc are manual shared ownership without a GC.",
    },
    code: `use std::rc::Rc;
use std::sync::Arc;
use std::thread;

// A config shared by multiple services (single-threaded)
#[derive(Debug)]
struct AppConfig {
    db_url: String,
    max_retries: u32,
}

struct Logger { config: Rc<AppConfig> }
struct Cache  { config: Rc<AppConfig> }

impl Logger {
    fn log(&self, msg: &str) {
        println!("[LOG db={}] {msg}", self.config.db_url);
    }
}

impl Cache {
    fn status(&self) {
        println!("Cache: max_retries={}", self.config.max_retries);
    }
}

fn main() {
    // Rc: shared ownership, single thread
    let config = Rc::new(AppConfig {
        db_url: String::from("postgres://localhost/app"),
        max_retries: 3,
    });

    let logger = Logger { config: Rc::clone(&config) };
    let cache  = Cache  { config: Rc::clone(&config) };
    println!("References: {}", Rc::strong_count(&config)); // 3

    logger.log("starting up");
    cache.status();

    drop(logger);
    println!("After drop: {}", Rc::strong_count(&config)); // 2

    // Arc: shared ownership across threads
    let shared_name = Arc::new(String::from("codeprobe"));
    let mut handles = vec![];

    for i in 0..3 {
        let name = Arc::clone(&shared_name);
        handles.push(thread::spawn(move || {
            println!("Thread {i}: {name}");
        }));
    }
    for h in handles { h.join().unwrap(); }
    println!("Final arc refs: {}", Arc::strong_count(&shared_name)); // 1
}`,
    seedQuestions: [
      "Why does Rc::clone() not deep-copy the data? What does it actually do?",
      "What happens when the last Rc pointing to data is dropped?",
      "Why can't you send an Rc<T> to another thread — what would go wrong?",
      "When would you choose Arc over Rc?",
    ],
  },

  {
    id: "rust-refcell",
    title: "RefCell & Interior Mutability",
    difficulty: "Advanced",
    icon: "🔓",
    description:
      "Rust's borrow checker normally enforces rules at compile time: one &mut OR many & references, never both. RefCell<T> moves this check to runtime — you can mutate data even through a shared reference. If you break the rules at runtime (two mutable borrows at once), it panics instead of causing undefined behavior. The Rc<RefCell<T>> pattern is common for shared mutable state in single-threaded code.",
    concepts: [
      "Interior mutability pattern",
      "RefCell runtime borrow checking",
      "borrow() and borrow_mut()",
      "Rc<RefCell<T>> pattern",
      "Compile-time vs runtime borrow checking",
    ],
    bridges: {
      "C++":
        "Similar to the mutable keyword on struct members, which allows mutation through a const reference. But RefCell panics on misuse instead of causing UB.",
      Python:
        "Python has no borrow rules — you can mutate anything anytime. RefCell gives Rust that flexibility with a runtime safety net.",
      Java:
        "Java has no borrow rules either. RefCell is like Rust admitting 'I can't prove this at compile time, so I'll check at runtime.'",
    },
    code: `use std::cell::RefCell;
use std::rc::Rc;

// A cache: looks immutable from outside, mutates inside
struct MemoizedLen {
    value: String,
    cache: RefCell<Option<usize>>,
}

impl MemoizedLen {
    fn new(value: &str) -> Self {
        MemoizedLen { value: value.to_string(), cache: RefCell::new(None) }
    }

    fn len(&self) -> usize {
        let mut cached = self.cache.borrow_mut();
        match *cached {
            Some(len) => len,
            None => { let len = self.value.len(); *cached = Some(len); len }
        }
    }
}

// Rc<RefCell<T>>: multiple owners, each can mutate
struct Subscriber {
    name: String,
    messages: Rc<RefCell<Vec<String>>>,
}

impl Subscriber {
    fn post(&self, msg: &str) {
        self.messages.borrow_mut().push(format!("{}: {msg}", self.name));
    }
}

fn main() {
    // Interior mutability: mutate through &self
    let memo = MemoizedLen::new("hello world");
    println!("Length: {}", memo.len()); // computes
    println!("Length: {}", memo.len()); // cached

    // Rc<RefCell<T>>: shared mutable state
    let log = Rc::new(RefCell::new(Vec::new()));
    let alice = Subscriber { name: "Alice".into(), messages: Rc::clone(&log) };
    let bob   = Subscriber { name: "Bob".into(),   messages: Rc::clone(&log) };

    alice.post("hello");
    bob.post("world");
    alice.post("!");
    println!("Messages: {:?}", log.borrow());

    // PANIC: two mutable borrows at once
    // let _a = log.borrow_mut();
    // let _b = log.borrow_mut(); // panics: already mutably borrowed
}`,
    seedQuestions: [
      "Why can MemoizedLen::len() take &self (not &mut self) yet still modify the cache?",
      "What happens at runtime if you call borrow_mut() twice without dropping the first?",
      "Why is Rc<RefCell<T>> only safe for single-threaded code?",
      "How does RefCell differ from just using &mut — when would you prefer one over the other?",
    ],
  },

  {
    id: "rust-cow",
    title: "Cow & Clone-on-Write",
    difficulty: "Advanced",
    icon: "🐄",
    description:
      "Cow<'a, T> (Clone-on-Write) is an enum with two variants: Borrowed and Owned. It holds a reference when possible and only clones to an owned value when mutation is needed. This is perfect for functions that usually just pass data through but sometimes need to modify it — you avoid cloning in the common case. Cow<str> is especially common for string processing functions.",
    concepts: [
      "Cow<'a, T> type",
      "Borrowed vs Owned variants",
      "Avoiding unnecessary clones",
      "Cow::into_owned()",
      "to_mut() for lazy cloning",
    ],
    bridges: {
      "C++":
        "Old C++ std::string implementations used copy-on-write internally. Cow makes this explicit and opt-in.",
      Python:
        "No direct equivalent. Python strings are immutable so copies are made on every modification. Cow avoids copies when no modification is needed.",
      Java:
        "No direct equivalent. Java Strings are immutable; StringBuilder is always owned. Cow sits between the two.",
    },
    code: `use std::borrow::Cow;

// Only clones if input actually needs modification
fn normalize_whitespace(input: &str) -> Cow<str> {
    if input.contains("  ") {
        let cleaned: String = input.split_whitespace().collect::<Vec<_>>().join(" ");
        Cow::Owned(cleaned)
    } else {
        Cow::Borrowed(input)
    }
}

fn ensure_trailing_slash(path: &str) -> Cow<str> {
    if path.ends_with('/') { Cow::Borrowed(path) }
    else { Cow::Owned(format!("{path}/")) }
}

// Cow in a struct: accept either borrowed or owned data
struct LogEntry<'a> {
    level: &'static str,
    message: Cow<'a, str>,
}

impl<'a> LogEntry<'a> {
    fn into_owned_message(self) -> String { self.message.into_owned() }
}

fn main() {
    // No extra spaces -> borrows original, zero allocation
    let clean = "hello world";
    let result = normalize_whitespace(clean);
    println!("{:?} (borrowed: {})", result, matches!(result, Cow::Borrowed(_)));

    // Has extra spaces -> allocates new string
    let messy = "hello    world   foo";
    let result = normalize_whitespace(messy);
    println!("{:?} (borrowed: {})", result, matches!(result, Cow::Borrowed(_)));

    // to_mut(): lazily clone only when you need to mutate
    let mut path: Cow<str> = Cow::Borrowed("/api/users");
    path.to_mut().push_str("/active"); // clones here, then mutates
    println!("Path: {path}");

    println!("{}", ensure_trailing_slash("/home/user/"));  // borrows
    println!("{}", ensure_trailing_slash("/home/user"));    // allocates

    // Struct with Cow
    let entry = LogEntry { level: "INFO", message: Cow::Borrowed("startup complete") };
    println!("[{}] {}", entry.level, entry.into_owned_message());
}`,
    seedQuestions: [
      "Why does normalize_whitespace return Cow<str> instead of just String?",
      "What does to_mut() do when the Cow is already in the Owned variant?",
      "When would you use Cow in a struct field instead of just String or &str?",
      "How does Cow help with performance in a function that usually doesn't need to modify its input?",
    ],
  },
] };
