export const rustTypeSystem = { name: "Type System Patterns", lessons: [
  {
    id: "rust-newtype",
    title: "Newtype Pattern",
    difficulty: "Intermediate",
    icon: "🏷️",
    description:
      "Wrap a type in a single-field tuple struct to create a distinct type with zero runtime cost. This prevents mixing up values that have the same underlying type (like confusing meters with seconds), lets you implement traits on foreign types (bypassing the orphan rule), and makes APIs self-documenting.",
    concepts: [
      "Newtype wrapper structs",
      "Type safety for same underlying type",
      "Bypassing the orphan rule",
      "Deref for transparent access",
      "From/Into for conversions",
    ],
    bridges: {
      "C++":
        "C++ lacks built-in strong typedefs. You can simulate with wrapper classes, but it's verbose. Rust newtypes are zero-cost and idiomatic.",
      Python:
        "Python has no type distinction at runtime — two ints are always interchangeable. Rust newtypes catch mix-ups at compile time.",
      Java:
        "Java wrapper classes (Integer, etc.) add heap allocation. Rust newtypes are zero-cost — the wrapper disappears at compile time.",
    },
    code: `use std::ops::Deref;
use std::fmt;

// --- Newtypes: same underlying type, different meaning ---
struct Meters(f64);
struct Seconds(f64);

// This won't compile: can't accidentally mix units
// fn bad_speed(d: f64, t: f64) -> f64 { d / t }

fn speed(distance: &Meters, time: &Seconds) -> f64 {
    distance.0 / time.0
}

// --- Bypassing the orphan rule ---
// Can't impl Display for Vec<T> directly (foreign type + foreign trait)
// But we CAN impl Display for our newtype wrapping Vec<T>
struct CommaSeparated(Vec<String>);

impl fmt::Display for CommaSeparated {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.0.join(", "))
    }
}

// --- Deref for transparent access to inner type ---
struct Username(String);

impl Deref for Username {
    type Target = str;
    fn deref(&self) -> &str {
        &self.0
    }
}

// --- From/Into for conversions ---
struct UserId(u64);

impl From<u64> for UserId {
    fn from(id: u64) -> Self {
        UserId(id)
    }
}

fn find_user(id: UserId) -> String {
    format!("User #{}", id.0)
}

fn main() {
    let d = Meters(100.0);
    let t = Seconds(9.58);
    println!("Speed: {:.2} m/s", speed(&d, &t));

    let tags = CommaSeparated(vec!["rust".into(), "types".into(), "safety".into()]);
    println!("Tags: {tags}");

    let name = Username("ferris".into());
    println!("Length: {}", name.len()); // Deref lets us call str methods
    println!("Upper: {}", name.to_uppercase());

    let user = find_user(42u64.into()); // Into<UserId> from From<u64>
    println!("{user}");
}`,
    seedQuestions: [
      "What prevents you from passing a Seconds value where a Meters is expected?",
      "How does the Deref implementation on Username let you call str methods directly?",
      "What is the orphan rule, and how does the newtype pattern get around it?",
      "Is there any runtime cost to using a newtype wrapper?",
    ],
  },

  {
    id: "rust-type-state",
    title: "Type-State Pattern",
    difficulty: "Advanced",
    icon: "🔄",
    description:
      "Use the type system to encode states — making invalid transitions a compile error. Each state is a separate type, and methods consume self to move to the next state. The state machine is checked at compile time with zero runtime cost. If it compiles, the protocol is correct.",
    concepts: [
      "Types as state markers",
      "Invalid states unrepresentable",
      "self-consuming state transitions",
      "Zero-cost state machines",
      "Compile-time state validation",
    ],
    bridges: {
      "C++":
        "Possible with templates and move semantics, but cumbersome. Rust's ownership makes self-consuming transitions natural.",
      Python:
        "Not possible at the type level — you'd use runtime checks and raise exceptions for invalid transitions.",
      Java:
        "Possible with generics and separate classes per state, but verbose. Java lacks move semantics so it can't prevent reuse of old states.",
    },
    code: `// Marker types for each state (no data, zero-size)
struct Disconnected;
struct Connected;
struct Authenticated;

// Connection parameterized by state
struct Connection<State> {
    addr: String,
    _state: std::marker::PhantomData<State>,
}

impl Connection<Disconnected> {
    fn new(addr: &str) -> Self {
        println!("Created connection to {addr}");
        Connection { addr: addr.to_string(), _state: std::marker::PhantomData }
    }

    fn connect(self) -> Connection<Connected> {
        println!("Connected to {}", self.addr);
        Connection { addr: self.addr, _state: std::marker::PhantomData }
    }
}

impl Connection<Connected> {
    fn authenticate(self, token: &str) -> Connection<Authenticated> {
        println!("Authenticated with token {token}");
        Connection { addr: self.addr, _state: std::marker::PhantomData }
    }

    fn disconnect(self) -> Connection<Disconnected> {
        println!("Disconnected from {}", self.addr);
        Connection { addr: self.addr, _state: std::marker::PhantomData }
    }
}

impl Connection<Authenticated> {
    fn query(&self, sql: &str) -> String {
        format!("[{}] Result of: {sql}", self.addr)
    }

    fn disconnect(self) -> Connection<Disconnected> {
        println!("Logged out and disconnected");
        Connection { addr: self.addr, _state: std::marker::PhantomData }
    }
}

fn main() {
    let conn = Connection::<Disconnected>::new("db.example.com");
    let conn = conn.connect();
    let conn = conn.authenticate("secret-token");
    println!("{}", conn.query("SELECT * FROM users"));
    let _conn = conn.disconnect();

    // These would be COMPILE ERRORS:
    // Connection::<Disconnected>::new("x").query("...");  // can't query before connect
    // Connection::<Disconnected>::new("x").authenticate("t"); // can't auth before connect
}`,
    seedQuestions: [
      "Why does each method take self (not &self) to transition states?",
      "What is PhantomData and why is it needed here?",
      "What compile error would you get if you tried to call query() on a Connected (not Authenticated) connection?",
      "How is this pattern zero-cost at runtime if there are different types?",
    ],
  },

  {
    id: "rust-associated-types",
    title: "Associated Types",
    difficulty: "Advanced",
    icon: "🔗",
    description:
      "Associated types let a trait declare a placeholder type that implementors fill in. Unlike generic parameters (where a type can have many implementations), associated types enforce exactly one implementation per type. Iterator is the canonical example: a Vec<i32> always yields i32 items, never anything else.",
    concepts: [
      "Associated types in traits",
      "type keyword in trait definition",
      "Associated types vs generic parameters",
      "One implementation per type rule",
      "Iterator as canonical example",
    ],
    bridges: {
      "C++":
        "Similar to dependent types in templates (like typename Container::value_type). C++20 concepts can constrain them.",
      Python:
        "No direct equivalent. Python's protocols and ABCs don't have associated type members — you'd use generic type hints.",
      Java:
        "No direct equivalent. Java generics on interfaces (Comparable<T>) are the closest, but the type is a parameter, not associated.",
    },
    code: `// --- The Iterator trait uses an associated type ---
// trait Iterator {
//     type Item;                        // associated type
//     fn next(&mut self) -> Option<Self::Item>;
// }

// --- Custom trait with associated type ---
trait Converter {
    type Input;
    type Output;
    fn convert(&self, input: Self::Input) -> Self::Output;
}

struct CelsiusToFahrenheit;

impl Converter for CelsiusToFahrenheit {
    type Input = f64;
    type Output = f64;
    fn convert(&self, celsius: Self::Input) -> Self::Output {
        celsius * 9.0 / 5.0 + 32.0
    }
}

struct WordCounter;

impl Converter for WordCounter {
    type Input = String;
    type Output = usize;
    fn convert(&self, text: Self::Input) -> Self::Output {
        text.split_whitespace().count()
    }
}

// --- Using associated types in function bounds ---
fn convert_and_print<C: Converter>(c: &C, input: C::Input)
where
    C::Output: std::fmt::Display,
{
    println!("Result: {}", c.convert(input));
}

// --- Implementing Iterator for a custom type ---
struct Countdown(i32);

impl Iterator for Countdown {
    type Item = i32; // this Countdown always yields i32
    fn next(&mut self) -> Option<Self::Item> {
        if self.0 <= 0 {
            None
        } else {
            self.0 -= 1;
            Some(self.0 + 1)
        }
    }
}

fn main() {
    let temp = CelsiusToFahrenheit;
    convert_and_print(&temp, 100.0);

    let wc = WordCounter;
    convert_and_print(&wc, "hello world from rust".to_string());

    let countdown = Countdown(5);
    let nums: Vec<i32> = countdown.collect();
    println!("Countdown: {nums:?}");
}`,
    seedQuestions: [
      "Why does Iterator use an associated type (type Item) instead of being generic (Iterator<T>)?",
      "What would go wrong if Iterator were generic — like Iterator<T> — instead of using an associated type?",
      "How does the compiler know what type Countdown::next() returns?",
      "When should you choose an associated type over a generic type parameter in your own trait?",
    ],
  },
] };
