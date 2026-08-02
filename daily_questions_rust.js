// Rust daily-quiz question pool. 10 questions per level.
// Each question's `concept` names the base-level idea it tests; the framing aims
// to be non-trivial even for a senior Rust dev (predict the error, choose the
// idiomatic alternative, or spot the subtle gotcha).

export const meta = { id: "rust", title: "Rust Daily", language: "rust" };

export const levels = ["beginner", "novice", "intermediate", "advanced", "expert"];

export const questions = {
  beginner: [
    {
      id: "rb-1",
      concept: "let bindings are immutable by default",
      code: `fn main() {
    let x = 5;
    x = 6;
    println!("{}", x);
}`,
      question: "Why does this fail to compile, and what minimal change makes it work?",
    },
    {
      id: "rb-2",
      concept: "shadowing vs mutation",
      code: `fn main() {
    let x = 5;
    let x = x + 1;
    let x = x * 2;
    println!("{}", x);
}`,
      question: "This compiles without `mut`. Why? What is being created on each `let x`?",
    },
    {
      id: "rb-3",
      concept: "expressions vs statements (trailing semicolon)",
      code: `fn add(a: i32, b: i32) -> i32 {
    a + b;
}`,
      question: "This does not compile. What does the trailing `;` change about the function body, and how do you fix it?",
    },
    {
      id: "rb-4",
      concept: "if is an expression",
      code: `fn main() {
    let n = 7;
    let label = if n % 2 == 0 { "even" } else { 3 };
    println!("{}", label);
}`,
      question: "What is the compile error, and what rule about `if` expressions does it reveal?",
    },
    {
      id: "rb-5",
      concept: "integer overflow behavior",
      code: `fn main() {
    let x: u8 = 255;
    let y = x + 1;
    println!("{}", y);
}`,
      question: "What happens when you run this in debug mode vs release mode? Why does Rust differ from C here?",
    },
    {
      id: "rb-6",
      concept: "type inference needs a constraint",
      code: `fn main() {
    let v = Vec::new();
    println!("{:?}", v);
}`,
      question: "Why does this fail to compile, and what are two distinct minimal changes that fix it?",
    },
    {
      id: "rb-7",
      concept: "tuple destructuring and the unit type",
      code: `fn main() {
    let pair = (1, "one");
    let (n, s) = pair;
    let unit = println!("{} {}", n, s);
    println!("{:?}", unit);
}`,
      question: "What is the type and value of `unit`? Why does `println!` return that?",
    },
    {
      id: "rb-8",
      concept: "match exhaustiveness",
      code: `fn describe(n: i32) -> &'static str {
    match n {
        0 => "zero",
        1 => "one",
    }
}`,
      question: "Why does the compiler reject this match? What is the minimal fix that satisfies it?",
    },
    {
      id: "rb-9",
      concept: "array vs Vec, fixed size in the type",
      code: `fn main() {
    let a = [1, 2, 3];
    let b = [1, 2, 3, 4];
    let same: bool = a == b;
    println!("{}", same);
}`,
      question: "Why does this fail to compile? What's different about `[i32; 3]` and `[i32; 4]` from the compiler's view?",
    },
    {
      id: "rb-10",
      concept: "loop returns a value via break",
      code: `fn main() {
    let mut i = 0;
    let result = loop {
        i += 1;
        if i == 10 { break i * i; }
    };
    println!("{}", result);
}`,
      question: "What does `result` hold, and why is `loop` unique among Rust's loop constructs in allowing this?",
    },
  ],

  novice: [
    {
      id: "rn-1",
      concept: "ownership move on assignment",
      code: `fn main() {
    let s1 = String::from("hi");
    let s2 = s1;
    println!("{} {}", s1, s2);
}`,
      question: "Which line causes the error and why? Why does the same pattern with `let x = 5; let y = x;` compile fine?",
    },
    {
      id: "rn-2",
      concept: "borrowing avoids moves",
      code: `fn len(s: &String) -> usize { s.len() }

fn main() {
    let name = String::from("Ada");
    let n = len(&name);
    println!("{} = {}", name, n);
}`,
      question: "Why can `main` still use `name` after the call? What changes if `len` takes `s: String` by value?",
    },
    {
      id: "rn-3",
      concept: "&str vs String",
      code: `fn greet(name: &str) {
    println!("hi {}", name);
}

fn main() {
    let owned = String::from("Ada");
    greet(&owned);
    greet("Bob");
}`,
      question: "Both calls compile. What conversion happens at `greet(&owned)`, and why is `&str` the idiomatic parameter type here?",
    },
    {
      id: "rn-4",
      concept: "mutable and immutable borrows cannot coexist",
      code: `fn main() {
    let mut v = vec![1, 2, 3];
    let first = &v[0];
    v.push(4);
    println!("{}", first);
}`,
      question: "Why does the borrow checker reject this even though `first` only reads? What concrete bug is this rule preventing?",
    },
    {
      id: "rn-5",
      concept: "iter vs into_iter vs iter_mut",
      code: `fn main() {
    let v = vec![1, 2, 3];
    let sum: i32 = v.into_iter().sum();
    println!("{} {:?}", sum, v);
}`,
      question: "Why does the second `println!` fail to compile? Which of `iter()` / `into_iter()` / `iter_mut()` would let you keep using `v`?",
    },
    {
      id: "rn-6",
      concept: "? operator on Result",
      code: `use std::num::ParseIntError;
fn double(s: &str) -> Result<i32, ParseIntError> {
    let n = s.parse::<i32>()?;
    Ok(n * 2)
}`,
      question: "Desugar the `?` operator into an explicit `match`. What trait makes `?` work across different error types?",
    },
    {
      id: "rn-7",
      concept: "Option::unwrap_or vs unwrap",
      code: `fn first_word_len(s: &str) -> usize {
    s.split_whitespace().next().unwrap().len()
}`,
      question: "On what input does this panic, and what is the smallest change that returns `0` instead?",
    },
    {
      id: "rn-8",
      concept: "String + takes ownership of lhs",
      code: `fn main() {
    let a = String::from("Hello, ");
    let b = String::from("world");
    let c = a + &b;
    println!("{} {}", a, c);
}`,
      question: "Why is `a` unusable after `a + &b`? What is the signature of `+` for `String` that explains this?",
    },
    {
      id: "rn-9",
      concept: "Copy trait",
      code: `#[derive(Clone)]
struct Point { x: i32, y: i32 }

fn main() {
    let p = Point { x: 1, y: 2 };
    let q = p;
    println!("{}", p.x);
}`,
      question: "Why doesn't `Clone` alone make this compile? What additional derive would, and what changes about assignment semantics?",
    },
    {
      id: "rn-10",
      concept: "slices borrow from their source",
      code: `fn first_word(s: &String) -> &str {
    &s[..s.find(' ').unwrap_or(s.len())]
}

fn main() {
    let mut s = String::from("hello world");
    let word = first_word(&s);
    s.clear();
    println!("{}", word);
}`,
      question: "Why does `s.clear()` cause a compile error here? What invariant about the returned slice is the borrow checker enforcing?",
    },
  ],

  intermediate: [
    {
      id: "ri-1",
      concept: "lifetime elision rules",
      code: `fn longest(x: &str, y: &str) -> &str {
    if x.len() > y.len() { x } else { y }
}`,
      question: "Why does this fail to compile despite elision? Which elision rule does NOT apply here, and what annotation fixes it?",
    },
    {
      id: "ri-2",
      concept: "trait default methods",
      code: `trait Greet {
    fn name(&self) -> &str;
    fn greet(&self) -> String {
        format!("Hello, {}!", self.name())
    }
}

struct Cat;
impl Greet for Cat {
    fn name(&self) -> &str { "Cat" }
}`,
      question: "What does `Cat` get for free? How would an implementor override `greet` without re-declaring `name`?",
    },
    {
      id: "ri-3",
      concept: "From / Into are linked",
      code: `struct Celsius(f64);
struct Fahrenheit(f64);

impl From<Celsius> for Fahrenheit {
    fn from(c: Celsius) -> Self { Fahrenheit(c.0 * 9.0 / 5.0 + 32.0) }
}

fn main() {
    let f: Fahrenheit = Celsius(100.0).into();
    println!("{}", f.0);
}`,
      question: "We never implemented `Into<Fahrenheit> for Celsius`, yet `.into()` works. Why? What's the blanket impl that connects them?",
    },
    {
      id: "ri-4",
      concept: "impl Trait return vs trait object",
      code: `fn make_adder(x: i32) -> impl Fn(i32) -> i32 {
    move |y| x + y
}

fn make_either(b: bool) -> impl Fn(i32) -> i32 {
    if b { |y| y + 1 } else { |y| y * 2 }
}`,
      question: "The first function compiles; the second does not. Why? What return type would make `make_either` work, and what's the runtime cost?",
    },
    {
      id: "ri-5",
      concept: "trait objects require dyn-compatibility",
      code: `trait Shape {
    fn area(&self) -> f64;
    fn make_default() -> Self;
}

fn print_area(s: &dyn Shape) {
    println!("{}", s.area());
}`,
      question: "Why does `&dyn Shape` fail to compile? Which method violates dyn-compatibility and what's the minimal fix that keeps both methods?",
    },
    {
      id: "ri-6",
      concept: "Eq vs PartialEq",
      code: `#[derive(PartialEq, Eq)]
struct Measurement { value: f64 }`,
      question: "Why does this fail to compile? What property of `f64` makes it `PartialEq` but not `Eq`?",
    },
    {
      id: "ri-7",
      concept: "orphan rule",
      code: `impl std::fmt::Display for Vec<u8> {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "<{} bytes>", self.len())
    }
}`,
      question: "Why is this impl rejected? What workaround pattern would let you achieve the same printing behavior in your crate?",
    },
    {
      id: "ri-8",
      concept: "Drop order in a block",
      code: `struct Loud(&'static str);
impl Drop for Loud {
    fn drop(&mut self) { println!("drop {}", self.0); }
}

fn main() {
    let a = Loud("a");
    let b = Loud("b");
    let c = Loud("c");
}`,
      question: "What order are `drop` messages printed, and why? How does this differ from struct field drop order?",
    },
    {
      id: "ri-9",
      concept: "Result combinators: map vs and_then",
      code: `fn parse_and_double(s: &str) -> Result<i32, std::num::ParseIntError> {
    s.parse::<i32>().map(|n| n * 2)
}

fn parse_and_recurse(s: &str) -> Result<i32, std::num::ParseIntError> {
    s.parse::<i32>().map(|n| format!("{}", n).parse::<i32>())
}`,
      question: "What is the return type of `parse_and_recurse`'s expression, and why is that wrong? Which combinator should replace `map`?",
    },
    {
      id: "ri-10",
      concept: "Self type vs the implementing type",
      code: `trait Doubler {
    fn doubled(self) -> Self;
}

impl Doubler for i32 {
    fn doubled(self) -> Self { self * 2 }
}

impl Doubler for String {
    fn doubled(self) -> Self { self.clone() + &self }
}`,
      question: "Both impls compile. What does `Self` resolve to in each? Why can't you write `fn doubled(self) -> i32` in the trait and have both work?",
    },
  ],

  advanced: [
    {
      id: "ra-1",
      concept: "RefCell moves borrow check to runtime",
      code: `use std::cell::RefCell;

fn main() {
    let c = RefCell::new(vec![1, 2, 3]);
    let r1 = c.borrow();
    let r2 = c.borrow_mut();
    println!("{} {}", r1.len(), r2.len());
}`,
      question: "This compiles. What happens at runtime, and why is RefCell's tradeoff still useful given that risk?",
    },
    {
      id: "ra-2",
      concept: "Closure traits Fn / FnMut / FnOnce",
      code: `fn call_twice<F: Fn()>(f: F) { f(); f(); }

fn main() {
    let s = String::from("hi");
    call_twice(move || { drop(s); });
}`,
      question: "Why does this fail to compile? Which closure trait does the closure actually satisfy, and what determines that?",
    },
    {
      id: "ra-3",
      concept: "move keyword forces capture by value",
      code: `fn make_counter() -> impl FnMut() -> i32 {
    let mut n = 0;
    || { n += 1; n }
}`,
      question: "Why does this fail to compile, and how does adding `move` fix it? What would happen without `move` if `n` were `&mut i32` from an outer scope?",
    },
    {
      id: "ra-4",
      concept: "iterators are lazy",
      code: `fn main() {
    let v = vec![1, 2, 3];
    v.iter().map(|x| { println!("seen {}", x); x * 2 });
    println!("done");
}`,
      question: "What does this print, and why? What single method call would make the side effects fire?",
    },
    {
      id: "ra-5",
      concept: "trait objects vs generics",
      code: `trait Shape { fn area(&self) -> f64; }

fn total_static<S: Shape>(shapes: &[S]) -> f64 {
    shapes.iter().map(|s| s.area()).sum()
}

fn total_dynamic(shapes: &[Box<dyn Shape>]) -> f64 {
    shapes.iter().map(|s| s.area()).sum()
}`,
      question: "Both compute the same result. Compare them on: dispatch cost, code size, heterogeneity of the collection, and binary monomorphization.",
    },
    {
      id: "ra-6",
      concept: "Rc<RefCell<T>> for shared mutable state",
      code: `use std::rc::Rc;
use std::cell::RefCell;

fn main() {
    let shared = Rc::new(RefCell::new(vec![1, 2, 3]));
    let a = shared.clone();
    let b = shared.clone();
    a.borrow_mut().push(4);
    println!("{:?}", b.borrow());
}`,
      question: "Walk through what each of `Rc` and `RefCell` is providing here. Why can't `Rc<Vec<i32>>` alone allow the mutation? Why can't `RefCell<Vec<i32>>` alone allow the sharing?",
    },
    {
      id: "ra-7",
      concept: "what unsafe actually unlocks",
      code: `fn main() {
    let mut x = 5;
    let r1 = &x as *const i32;
    let r2 = &mut x as *mut i32;
    unsafe {
        println!("{} {}", *r1, *r2);
    }
}`,
      question: "Name the 4 (or 5) extra abilities `unsafe` grants. Which one is being used here, and what guarantees does the compiler still uphold?",
    },
    {
      id: "ra-8",
      concept: "PhantomData and unused type parameters",
      code: `struct TypedId<T> {
    id: u64,
}

impl<T> TypedId<T> {
    fn new(id: u64) -> Self { TypedId { id } }
}`,
      question: "Why does the compiler reject this struct? What is `PhantomData<T>` and what does adding it communicate beyond just satisfying the checker?",
    },
    {
      id: "ra-9",
      concept: "interior mutability via Cell",
      code: `use std::cell::Cell;

struct Counter { count: Cell<u32> }

impl Counter {
    fn bump(&self) { self.count.set(self.count.get() + 1); }
}`,
      question: "How does `bump(&self)` mutate state through a shared reference without `unsafe`? Why is `Cell` cheaper than `RefCell` and what does it require of `T`?",
    },
    {
      id: "ra-10",
      concept: "?Sized and the default Sized bound",
      code: `fn print_it<T: std::fmt::Debug>(t: &T) {
    println!("{:?}", t);
}

fn main() {
    let s: &str = "hello";
    print_it(s);
    let arr: &[i32] = &[1, 2, 3];
    print_it(arr);
}`,
      question: "Why does this work, given that `str` and `[i32]` are unsized? What implicit bound does `T` carry, and when would you write `T: ?Sized`?",
    },
  ],

  expert: [
    {
      id: "re-1",
      concept: "Send vs Sync",
      code: `use std::rc::Rc;
use std::thread;

fn main() {
    let r = Rc::new(5);
    let r2 = r.clone();
    thread::spawn(move || { println!("{}", r2); });
}`,
      question: "Why does this fail to compile? Define Send and Sync precisely. Which of the two does `Rc<T>` lack, and what would `Arc` change?",
    },
    {
      id: "re-2",
      concept: "Pin and self-referential futures",
      code: `async fn foo() {
    let s = String::from("hi");
    let r = &s;
    some_await().await;
    println!("{}", r);
}
async fn some_await() {}`,
      question: "Why is `Pin` necessary in the async machinery for code like this? What concrete problem arises if the future is moved while `r` is live across the await?",
    },
    {
      id: "re-3",
      concept: "dyn Trait fat pointer layout",
      code: `trait Animal { fn speak(&self); }
struct Cat;
impl Animal for Cat { fn speak(&self) { println!("meow"); } }

fn main() {
    let c = Cat;
    let d: &dyn Animal = &c;
    println!("{} {}", std::mem::size_of_val(&d), std::mem::size_of::<&Cat>());
}`,
      question: "What two sizes does this print and why? Describe the layout of `&dyn Animal` and the cost of `d.speak()` vs `c.speak()`.",
    },
    {
      id: "re-4",
      concept: "variance",
      code: `struct Covariant<'a, T>(std::marker::PhantomData<&'a T>);
struct Invariant<'a, T>(std::marker::PhantomData<fn(&'a T)>);`,
      question: "What variance does each struct have in `'a` and `T`? Why does wrapping in `fn(...)` flip co/contra-variance? Give one bug variance prevents.",
    },
    {
      id: "re-5",
      concept: "GATs solve lifetime in associated types",
      code: `trait Iterable {
    type Item<'a> where Self: 'a;
    fn next<'a>(&'a mut self) -> Option<Self::Item<'a>>;
}`,
      question: "What problem with the standard `Iterator` trait do GATs solve? Give an example (like a windowing iterator) that needs `Item<'a>` and cannot be expressed with plain associated types.",
    },
    {
      id: "re-6",
      concept: "Drop order: locals vs struct fields",
      code: `struct Loud(&'static str);
impl Drop for Loud {
    fn drop(&mut self) { println!("{}", self.0); }
}

struct Pair { a: Loud, b: Loud }

fn main() {
    let _p = Pair { a: Loud("Pa"), b: Loud("Pb") };
    let _x = Loud("X");
    let _y = Loud("Y");
}`,
      question: "Print the exact drop order. State the rule for local variables vs struct fields and why this matters for `MutexGuard` ordering.",
    },
    {
      id: "re-7",
      concept: "manual Send implementation",
      code: `struct MyHandle { ptr: *mut u8 }

unsafe impl Send for MyHandle {}`,
      question: "Raw pointers are `!Send` by default. When is it sound to manually `unsafe impl Send`? What invariants must you uphold, and what's an example where doing this is wrong?",
    },
    {
      id: "re-8",
      concept: "NLL: non-lexical lifetimes",
      code: `fn main() {
    let mut v = vec![1, 2, 3];
    let r = &v[0];
    println!("{}", r);
    v.push(4);
    println!("{:?}", v);
}`,
      question: "Pre-NLL Rust rejected this; modern Rust accepts it. What changed about how borrow scopes are computed, and what does that imply for `r`'s lifetime here?",
    },
    {
      id: "re-9",
      concept: "let-else and divergence",
      code: `fn first_token(s: &str) -> &str {
    let Some(tok) = s.split_whitespace().next() else {
        return "";
    };
    tok
}`,
      question: "What is the type requirement for the `else` block? Why is `let-else` strictly more powerful than `if let Some(...) = ... else { ... }`? Show a case the latter cannot express cleanly.",
    },
    {
      id: "re-10",
      concept: "async fn in trait, hidden Send bound",
      code: `trait Fetcher {
    async fn fetch(&self, url: &str) -> String;
}

async fn run<F: Fetcher>(f: F) {
    tokio::spawn(async move {
        let _ = f.fetch("https://example.com").await;
    });
}`,
      question: "This may fail to compile even on Rust 1.75+. What's the missing bound on the returned future from `fetch`, and what's the current ergonomic workaround (think `trait-variant` or RTN syntax)?",
    },
  ],
};
