export const rustUnsafe = { name: "Unsafe & FFI", lessons: [
  {
    id: "rust-unsafe",
    title: "Unsafe Rust",
    difficulty: "Advanced",
    icon: "⚠️",
    description:
      "Rust's safety guarantees come from compile-time checks. Sometimes you need to opt out for low-level control — unsafe lets you do specific things the compiler can't verify, but the rest of your code stays safe. There are exactly five things unsafe unlocks: dereferencing raw pointers, calling unsafe functions, accessing mutable statics, implementing unsafe traits, and accessing union fields. Everything else is still checked.",
    concepts: [
      "unsafe blocks and functions",
      "Raw pointers (*const T, *mut T)",
      "Five unsafe superpowers",
      "Safety invariants and contracts",
      "Minimizing unsafe surface area",
    ],
    bridges: {
      "C++":
        "In C++ everything is 'unsafe' by default — you can dereference any pointer anytime. Rust flips this: safe by default, opt-in to dangerous operations.",
      Python:
        "Python's ctypes module lets you do raw memory manipulation. In Rust, unsafe is the equivalent escape hatch — but scoped and auditable.",
      Java:
        "Java has sun.misc.Unsafe and JNI for low-level operations. Rust's unsafe is similar in purpose but integrated into the language with clear boundaries.",
    },
    code: `use std::slice;

// --- Raw pointers: created safely, dereferenced unsafely ---
fn raw_pointer_demo() {
    let mut value = 42;
    let r1 = &value as *const i32;     // immutable raw pointer
    let r2 = &mut value as *mut i32;   // mutable raw pointer

    // Creating raw pointers is safe; dereferencing is not
    unsafe {
        println!("r1 = {}", *r1);
        *r2 = 99;
        println!("r2 = {}", *r2);
    }
}

// --- Unsafe function: caller must uphold invariants ---
unsafe fn dangerous_from_parts(ptr: *const u8, len: usize) -> &'static str {
    // Caller guarantees: ptr is valid, len is correct, bytes are UTF-8
    std::str::from_utf8_unchecked(slice::from_raw_parts(ptr, len))
}

// --- Safe wrapper around unsafe code (the common pattern) ---
fn split_at_mut(values: &mut [i32], mid: usize) -> (&mut [i32], &mut [i32]) {
    let len = values.len();
    let ptr = values.as_mut_ptr();
    assert!(mid <= len); // enforce the safety invariant

    unsafe {
        // We know these two slices don't overlap — the compiler can't
        (
            slice::from_raw_parts_mut(ptr, mid),
            slice::from_raw_parts_mut(ptr.add(mid), len - mid),
        )
    }
}

// --- Mutable static: globally shared, must synchronize access ---
static mut REQUEST_COUNT: u64 = 0;

fn increment_requests() {
    unsafe { REQUEST_COUNT += 1; }
}

fn main() {
    raw_pointer_demo();

    let mut data = [1, 2, 3, 4, 5, 6];
    let (left, right) = split_at_mut(&mut data, 3);
    println!("left: {left:?}, right: {right:?}");

    increment_requests();
    unsafe { println!("requests: {REQUEST_COUNT}"); }
}`,
    seedQuestions: [
      "Why is creating a raw pointer safe, but dereferencing it requires unsafe?",
      "What makes split_at_mut a good example of a safe wrapper around unsafe code?",
      "Why are mutable statics unsafe to access?",
      "How does Rust's approach to unsafe compare to C++ where everything is unchecked by default?",
    ],
  },

  {
    id: "rust-ffi",
    title: "FFI & Calling C",
    difficulty: "Advanced",
    icon: "🌉",
    description:
      "Foreign Function Interface (FFI) lets Rust call C code and vice versa. This is how Rust integrates with operating systems, existing libraries, and other languages. extern \"C\" adopts the C calling convention, #[no_mangle] preserves function names for C to find, and #[repr(C)] ensures struct layouts match what C expects.",
    concepts: [
      "extern \"C\" for C calling convention",
      "#[no_mangle] for symbol names",
      "#[repr(C)] for C-compatible layout",
      "Calling C from Rust",
      "Safety wrappers around unsafe FFI",
    ],
    bridges: {
      "C++":
        "C++ uses extern \"C\" the same way to prevent name mangling. Rust's FFI is very similar but wraps everything in unsafe.",
      Python:
        "Python uses ctypes or cffi to call C libraries. Rust's extern blocks serve the same purpose but are checked at link time.",
      Java:
        "Java uses JNI (or the newer Panama API) to call native code. Rust's FFI is more lightweight — no JVM bridging layer needed.",
    },
    code: `use std::ffi::{CStr, CString};
use std::os::raw::c_char;

// --- Declare C functions we want to call ---
extern "C" {
    fn abs(input: i32) -> i32;
    fn strlen(s: *const c_char) -> usize;
}

// --- Safe wrappers: hide the unsafe behind a clean API ---
fn safe_abs(n: i32) -> i32 {
    unsafe { abs(n) }
}

fn safe_strlen(s: &str) -> usize {
    let c_string = CString::new(s).expect("string contains null byte");
    unsafe { strlen(c_string.as_ptr()) }
}

// --- C-compatible struct layout ---
#[repr(C)]
struct Point {
    x: f64,
    y: f64,
}

impl Point {
    fn distance(&self) -> f64 {
        (self.x * self.x + self.y * self.y).sqrt()
    }
}

// --- Expose Rust function for C to call ---
#[no_mangle]
pub extern "C" fn rust_add(a: i32, b: i32) -> i32 {
    a + b
}

// --- Receiving a C string from C code ---
#[no_mangle]
pub extern "C" fn greet(name: *const c_char) {
    let name_str = unsafe {
        assert!(!name.is_null());
        CStr::from_ptr(name)
    };
    println!("Hello, {}!", name_str.to_str().unwrap_or("???"));
}

fn main() {
    println!("|−7| = {}", safe_abs(-7));
    println!("strlen(\"hello\") = {}", safe_strlen("hello"));

    let p = Point { x: 3.0, y: 4.0 };
    println!("distance = {}", p.distance());
}`,
    seedQuestions: [
      "Why do all calls to C functions require an unsafe block?",
      "What does #[repr(C)] do, and why is it necessary for FFI?",
      "What is the difference between CStr and CString, and when do you use each?",
      "Why does #[no_mangle] need to be used on functions exposed to C?",
    ],
  },
] };
