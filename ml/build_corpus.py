#!/usr/bin/env python3
"""
Build a diverse code corpus for training the line reference validator.

Combines:
1. Code from MIT/Apache-licensed repos in samples/
2. Synthetic code snippets covering gaps (Rust, C++, more patterns)

Outputs synthetic_lessons.json — same format as extract_lessons.js output,
ready for generate_training_data.py.

Usage:
    python build_corpus.py
"""

import json
import os
from pathlib import Path

SAMPLES_DIR = Path(__file__).parent.parent / "samples"
OUTPUT = Path(__file__).parent / "data" / "synthetic_lessons.json"

# ── Code from sample repos (MIT/Apache licensed) ────────────────────────

SAMPLE_FILES = [
    # Gilded Rose — business logic with complex conditionals
    ("gilded-rose/python/gilded_rose.py", "Python", "Gilded Rose: Inventory Quality Update",
     ["Nested conditionals for business rules", "Decrement and boundary checking",
      "Special item handling (Aged Brie, Sulfuras, Backstage passes)"]),
    ("gilded-rose/ruby/gilded_rose.rb", "Ruby", "Gilded Rose in Ruby",
     ["Ruby class with update method", "Iterator patterns with each",
      "Conditional branching with unless/if"]),
    ("gilded-rose/js-jasmine/src/gilded_rose.js", "JavaScript", "Gilded Rose in JavaScript",
     ["Class-based implementation", "Nested if/else chains",
      "Property mutation within loops"]),
    ("gilded-rose/C/GildedRose.c", "C", "Gilded Rose in C",
     ["Struct-based item management", "String comparison with strcmp",
      "Pointer manipulation for arrays"]),

    # Tennis — different algorithm approaches
    ("tennis/python/tennis1.py", "Python", "Tennis Scoring: Dictionary Lookup",
     ["Dictionary-based score mapping", "Class with state tracking",
      "Conditional logic for deuce/advantage"]),
    ("tennis/python/tennis3.py", "Python", "Tennis Scoring: Compact Functional",
     ["List-based lookups", "Ternary conditional expressions",
      "Minimal class design"]),
    ("tennis/javascript/TennisGame3.js", "JavaScript", "Tennis Scoring: Prototype Pattern",
     ["Prototype-based OOP in JS", "Compact ternary logic",
      "String interpolation for score display"]),
    ("tennis/c/TennisGame3.c", "C", "Tennis Scoring in C",
     ["Struct for game state", "String buffer handling",
      "Function pointers and callbacks"]),
    ("tennis/typescript-jest/src/TennisGame1.ts", "TypeScript", "Tennis Scoring in TypeScript",
     ["TypeScript interfaces and classes", "Switch statement patterns",
      "Private members and encapsulation"]),

    # RealWorld API — REST patterns
    ("realworld/apps/api/server/utils/auth.ts", "TypeScript", "JWT Authentication Utility",
     ["Token extraction from headers", "JWT verification with error handling",
      "Async/await patterns"]),
    ("realworld/apps/api/server/routes/api/articles/[slug]/comments/index.post.ts",
     "TypeScript", "REST API: Create Comment",
     ["Route handler with request validation", "Prisma ORM nested create",
      "Error response patterns"]),

    # Etherpad — utilities
    ("etherpad/src/node/utils/sanitizePathname.ts", "TypeScript", "Path Sanitization",
     ["Security validation", "Regex-based path cleaning",
      "Edge case handling for directory traversal"]),
]


def load_sample(rel_path, series, title, concepts):
    """Load a code file from samples/ and format as a lesson."""
    path = SAMPLES_DIR / rel_path
    if not path.exists():
        print(f"  Warning: {rel_path} not found, skipping")
        return None

    code = path.read_text()
    lines = code.split("\n")

    # Trim to ≤80 lines (take the most interesting part)
    if len(lines) > 80:
        # Skip imports/headers, take the core
        start = 0
        for i, line in enumerate(lines):
            if i > 10:
                break
            if line.strip() and not line.strip().startswith(("import ", "from ", "#include", "require", "//", "/*", "*")):
                start = max(0, i - 1)
                break
        code = "\n".join(lines[start:start + 80])

    lesson_id = rel_path.replace("/", "-").replace(".", "-").replace(" ", "-").lower()
    return {
        "id": f"corpus-{lesson_id}",
        "title": title,
        "series": series,
        "difficulty": "Project",
        "concepts": concepts,
        "bridges": {},
        "code": code,
        "seedQuestions": [
            f"What happens on the first few lines of this code?",
            f"Walk me through the main logic in this file.",
            f"What's the most important function here and why?",
        ],
    }


# ── Synthetic code snippets (written to cover language/pattern gaps) ─────

SYNTHETIC = [
    {
        "id": "corpus-rust-linked-list",
        "title": "Linked List in Rust",
        "series": "Rust",
        "concepts": ["Enum-based data structures", "Box for heap allocation",
                     "Pattern matching on recursive types", "impl blocks and methods"],
        "code": """use std::fmt;

enum List<T> {
    Cons(T, Box<List<T>>),
    Nil,
}

impl<T: fmt::Display> List<T> {
    fn new() -> Self {
        List::Nil
    }

    fn push(self, val: T) -> Self {
        List::Cons(val, Box::new(self))
    }

    fn len(&self) -> usize {
        match self {
            List::Nil => 0,
            List::Cons(_, next) => 1 + next.len(),
        }
    }

    fn to_vec(&self) -> Vec<&T> {
        let mut result = Vec::new();
        let mut current = self;
        while let List::Cons(val, next) = current {
            result.push(val);
            current = next;
        }
        result
    }
}

impl<T: fmt::Display> fmt::Display for List<T> {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        let items = self.to_vec();
        write!(f, "[{}]", items.iter()
            .map(|x| x.to_string())
            .collect::<Vec<_>>()
            .join(" -> "))
    }
}

fn main() {
    let list = List::new()
        .push(3)
        .push(2)
        .push(1);
    println!("{} (length: {})", list, list.len());
}""",
    },
    {
        "id": "corpus-cpp-smart-ptr",
        "title": "Custom Smart Pointer in C++",
        "series": "C++",
        "concepts": ["RAII and resource management", "Move semantics",
                     "Operator overloading (*,  ->)", "Delete copy constructor"],
        "code": """#include <iostream>
#include <utility>

template<typename T>
class UniquePtr {
    T* ptr_;
public:
    explicit UniquePtr(T* p = nullptr) : ptr_(p) {}
    ~UniquePtr() { delete ptr_; }

    // No copying
    UniquePtr(const UniquePtr&) = delete;
    UniquePtr& operator=(const UniquePtr&) = delete;

    // Move only
    UniquePtr(UniquePtr&& other) noexcept : ptr_(other.ptr_) {
        other.ptr_ = nullptr;
    }
    UniquePtr& operator=(UniquePtr&& other) noexcept {
        if (this != &other) {
            delete ptr_;
            ptr_ = other.ptr_;
            other.ptr_ = nullptr;
        }
        return *this;
    }

    T& operator*() const { return *ptr_; }
    T* operator->() const { return ptr_; }
    T* get() const { return ptr_; }
    explicit operator bool() const { return ptr_ != nullptr; }

    T* release() {
        T* tmp = ptr_;
        ptr_ = nullptr;
        return tmp;
    }

    void reset(T* p = nullptr) {
        delete ptr_;
        ptr_ = p;
    }
};

struct Sensor {
    int id;
    double reading;
    void print() const {
        std::cout << "Sensor " << id << ": " << reading << std::endl;
    }
};

int main() {
    UniquePtr<Sensor> s1(new Sensor{1, 23.5});
    s1->print();

    UniquePtr<Sensor> s2 = std::move(s1);
    if (!s1) std::cout << "s1 is empty after move" << std::endl;
    s2->print();
}""",
    },
    {
        "id": "corpus-python-decorator-cache",
        "title": "Memoization Decorator",
        "series": "Python",
        "concepts": ["Closures and decorators", "Dictionary as cache",
                     "functools.wraps for metadata", "Recursive Fibonacci with memoization"],
        "code": """import functools
import time

def memoize(func):
    cache = {}

    @functools.wraps(func)
    def wrapper(*args):
        if args in cache:
            return cache[args]
        result = func(*args)
        cache[args] = result
        return result

    wrapper.cache = cache
    wrapper.clear = lambda: cache.clear()
    return wrapper

@memoize
def fibonacci(n):
    if n < 2:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)

@memoize
def grid_paths(rows, cols):
    if rows == 1 or cols == 1:
        return 1
    return grid_paths(rows - 1, cols) + grid_paths(rows, cols - 1)

if __name__ == "__main__":
    start = time.time()
    print(f"fib(40) = {fibonacci(40)}")
    print(f"Computed in {time.time() - start:.4f}s")
    print(f"Cache size: {len(fibonacci.cache)} entries")

    print(f"Grid paths 10x10 = {grid_paths(10, 10)}")
    fibonacci.clear()
    print(f"Cache cleared: {len(fibonacci.cache)} entries")""",
    },
    {
        "id": "corpus-c-hash-table",
        "title": "Simple Hash Table in C",
        "series": "C",
        "concepts": ["Hash function (djb2)", "Chaining with linked lists",
                     "malloc/free for dynamic allocation", "String key/value storage"],
        "code": """#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define TABLE_SIZE 64

typedef struct Entry {
    char* key;
    char* value;
    struct Entry* next;
} Entry;

typedef struct {
    Entry* buckets[TABLE_SIZE];
} HashTable;

unsigned long hash(const char* str) {
    unsigned long h = 5381;
    int c;
    while ((c = *str++))
        h = ((h << 5) + h) + c;   // h * 33 + c
    return h % TABLE_SIZE;
}

void ht_set(HashTable* ht, const char* key, const char* value) {
    unsigned long idx = hash(key);
    Entry* e = ht->buckets[idx];
    while (e) {
        if (strcmp(e->key, key) == 0) {
            free(e->value);
            e->value = strdup(value);
            return;
        }
        e = e->next;
    }
    Entry* new_entry = malloc(sizeof(Entry));
    new_entry->key = strdup(key);
    new_entry->value = strdup(value);
    new_entry->next = ht->buckets[idx];
    ht->buckets[idx] = new_entry;
}

char* ht_get(HashTable* ht, const char* key) {
    unsigned long idx = hash(key);
    Entry* e = ht->buckets[idx];
    while (e) {
        if (strcmp(e->key, key) == 0)
            return e->value;
        e = e->next;
    }
    return NULL;
}

void ht_free(HashTable* ht) {
    for (int i = 0; i < TABLE_SIZE; i++) {
        Entry* e = ht->buckets[i];
        while (e) {
            Entry* next = e->next;
            free(e->key);
            free(e->value);
            free(e);
            e = next;
        }
    }
}

int main(void) {
    HashTable ht = {0};
    ht_set(&ht, "name", "Alice");
    ht_set(&ht, "city", "Amsterdam");
    ht_set(&ht, "name", "Bob");       // overwrite
    printf("name: %s\\n", ht_get(&ht, "name"));
    printf("city: %s\\n", ht_get(&ht, "city"));
    printf("missing: %s\\n", ht_get(&ht, "age") ? ht_get(&ht, "age") : "(null)");
    ht_free(&ht);
}""",
    },
    {
        "id": "corpus-rust-error-handling",
        "title": "Config File Parser with Error Handling",
        "series": "Rust",
        "concepts": ["Custom error types with thiserror", "Result chaining with ?",
                     "File I/O with std::fs", "HashMap for key-value storage"],
        "code": """use std::collections::HashMap;
use std::fs;

#[derive(Debug)]
enum ConfigError {
    IoError(std::io::Error),
    ParseError { line: usize, message: String },
}

impl From<std::io::Error> for ConfigError {
    fn from(e: std::io::Error) -> Self {
        ConfigError::IoError(e)
    }
}

fn parse_config(path: &str) -> Result<HashMap<String, String>, ConfigError> {
    let content = fs::read_to_string(path)?;
    let mut config = HashMap::new();

    for (i, line) in content.lines().enumerate() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        let parts: Vec<&str> = line.splitn(2, '=').collect();
        if parts.len() != 2 {
            return Err(ConfigError::ParseError {
                line: i + 1,
                message: format!("expected KEY=VALUE, got: {}", line),
            });
        }

        let key = parts[0].trim().to_string();
        let value = parts[1].trim().to_string();
        config.insert(key, value);
    }

    Ok(config)
}

fn get_or_default(config: &HashMap<String, String>, key: &str, default: &str) -> String {
    config.get(key).cloned().unwrap_or_else(|| default.to_string())
}

fn main() {
    match parse_config("app.conf") {
        Ok(config) => {
            let host = get_or_default(&config, "host", "localhost");
            let port = get_or_default(&config, "port", "8080");
            println!("Server: {}:{}", host, port);
            println!("Loaded {} settings", config.len());
        }
        Err(ConfigError::IoError(e)) => {
            eprintln!("Cannot read config: {}", e);
        }
        Err(ConfigError::ParseError { line, message }) => {
            eprintln!("Config error on line {}: {}", line, message);
        }
    }
}""",
    },
    {
        "id": "corpus-python-iterator",
        "title": "Custom Iterator: Chunked Reader",
        "series": "Python",
        "concepts": ["__iter__ and __next__ protocol", "StopIteration exception",
                     "Generator functions with yield", "Context manager with __enter__/__exit__"],
        "code": """class ChunkedReader:
    \"\"\"Read a sequence in fixed-size chunks.\"\"\"

    def __init__(self, data, chunk_size=3):
        self.data = data
        self.chunk_size = chunk_size
        self.index = 0

    def __iter__(self):
        self.index = 0
        return self

    def __next__(self):
        if self.index >= len(self.data):
            raise StopIteration
        chunk = self.data[self.index:self.index + self.chunk_size]
        self.index += self.chunk_size
        return chunk


def sliding_window(data, window_size=3):
    \"\"\"Generator that yields overlapping windows.\"\"\"
    for i in range(len(data) - window_size + 1):
        yield data[i:i + window_size]


def batch_process(items, batch_size=5):
    \"\"\"Process items in batches, yielding (batch_num, batch).\"\"\"
    for i in range(0, len(items), batch_size):
        batch = items[i:i + batch_size]
        yield (i // batch_size + 1, batch)


if __name__ == "__main__":
    numbers = list(range(1, 11))

    print("Chunks of 3:")
    for chunk in ChunkedReader(numbers, 3):
        print(f"  {chunk}")

    print("Sliding window of 4:")
    for window in sliding_window(numbers, 4):
        print(f"  {window}")

    print("Batches of 3:")
    for batch_num, batch in batch_process(numbers, 3):
        total = sum(batch)
        print(f"  Batch {batch_num}: {batch} (sum={total})")""",
    },
    {
        "id": "corpus-cpp-template-stack",
        "title": "Template Stack with Compile-Time Checks",
        "series": "C++",
        "concepts": ["Class templates with type parameter", "Static assertions",
                     "Exception safety (noexcept)", "Initializer list construction"],
        "code": """#include <iostream>
#include <stdexcept>
#include <initializer_list>

template<typename T, int MaxSize = 100>
class Stack {
    static_assert(MaxSize > 0, "Stack must have positive capacity");

    T data_[MaxSize];
    int top_ = 0;

public:
    Stack() = default;

    Stack(std::initializer_list<T> init) {
        for (const auto& item : init) {
            push(item);
        }
    }

    void push(const T& val) {
        if (top_ >= MaxSize)
            throw std::overflow_error("stack full");
        data_[top_++] = val;
    }

    T pop() {
        if (top_ <= 0)
            throw std::underflow_error("stack empty");
        return data_[--top_];
    }

    const T& peek() const {
        if (top_ <= 0)
            throw std::underflow_error("stack empty");
        return data_[top_ - 1];
    }

    bool empty() const noexcept { return top_ == 0; }
    int size() const noexcept { return top_; }

    void print() const {
        std::cout << "[";
        for (int i = 0; i < top_; i++) {
            if (i > 0) std::cout << ", ";
            std::cout << data_[i];
        }
        std::cout << "]" << std::endl;
    }
};

int main() {
    Stack<int, 5> s = {10, 20, 30};
    s.print();

    s.push(40);
    std::cout << "peek: " << s.peek() << std::endl;
    std::cout << "pop: " << s.pop() << std::endl;
    s.print();

    // This would fail at compile time:
    // Stack<int, 0> bad;   // static_assert fires
}""",
    },
    {
        "id": "corpus-ruby-dsl",
        "title": "DSL Builder Pattern in Ruby",
        "series": "Ruby",
        "concepts": ["method_missing for dynamic methods", "Blocks and instance_eval",
                     "Builder pattern", "Symbol to proc conversion"],
        "code": """class HtmlBuilder
  def initialize
    @elements = []
  end

  def method_missing(tag, content = nil, **attrs, &block)
    attr_str = attrs.map { |k, v| " #{k}=\\"#{v}\\"" }.join
    if block
      @elements << "<#{tag}#{attr_str}>"
      nested = HtmlBuilder.new
      nested.instance_eval(&block)
      @elements << nested.to_s
      @elements << "</#{tag}>"
    elsif content
      @elements << "<#{tag}#{attr_str}>#{content}</#{tag}>"
    else
      @elements << "<#{tag}#{attr_str} />"
    end
  end

  def text(str)
    @elements << str
  end

  def to_s
    @elements.join("\\n")
  end
end

def html(&block)
  builder = HtmlBuilder.new
  builder.instance_eval(&block)
  builder.to_s
end

page = html do
  h1 "My Page", class: "title"
  div class: "content" do
    p "Hello, world!"
    ul do
      ["Ruby", "Python", "Rust"].each do |lang|
        li lang
      end
    end
  end
  hr
  footer "Built with Ruby DSL"
end

puts page""",
    },
    # ── Multi-file lessons (global line numbering is the key challenge) ──
    {
        "id": "corpus-rust-multifile-cli",
        "title": "CLI App: Module Split",
        "series": "Rust",
        "concepts": ["Module system (mod, use)", "Struct across files",
                     "Error propagation between modules", "main delegates to lib"],
        "files": [
            {"name": "main.rs", "code": """use std::env;
use std::process;

mod config;
mod run;

fn main() {
    let args: Vec<String> = env::args().collect();

    let cfg = config::Config::parse(&args).unwrap_or_else(|e| {
        eprintln!("Error: {}", e);
        process::exit(1);
    });

    if let Err(e) = run::execute(&cfg) {
        eprintln!("Failed: {}", e);
        process::exit(1);
    }
}"""},
            {"name": "config.rs", "code": """pub struct Config {
    pub input: String,
    pub verbose: bool,
}

impl Config {
    pub fn parse(args: &[String]) -> Result<Config, String> {
        if args.len() < 2 {
            return Err("Usage: tool <input> [--verbose]".into());
        }
        let input = args[1].clone();
        let verbose = args.iter().any(|a| a == "--verbose");
        Ok(Config { input, verbose })
    }
}"""},
            {"name": "run.rs", "code": """use crate::config::Config;
use std::fs;

pub fn execute(cfg: &Config) -> Result<(), Box<dyn std::error::Error>> {
    let content = fs::read_to_string(&cfg.input)?;
    let lines: Vec<&str> = content.lines().collect();

    if cfg.verbose {
        println!("Read {} lines from {}", lines.len(), cfg.input);
    }

    let non_empty: Vec<&&str> = lines.iter().filter(|l| !l.trim().is_empty()).collect();
    println!("{} non-empty lines out of {}", non_empty.len(), lines.len());
    Ok(())
}"""},
        ],
    },
    {
        "id": "corpus-python-multifile-app",
        "title": "Flask-like Request Handler",
        "series": "Python",
        "concepts": ["Module imports across files", "Decorator-based routing",
                     "JSON response handling", "Error middleware pattern"],
        "files": [
            {"name": "app.py", "code": """from router import Router
from middleware import error_handler

app = Router()

@app.route("/users")
def list_users(request):
    users = [
        {"id": 1, "name": "Alice"},
        {"id": 2, "name": "Bob"},
    ]
    return {"status": 200, "body": users}

@app.route("/users/<id>")
def get_user(request, id):
    if int(id) > 2:
        raise ValueError(f"User {id} not found")
    return {"status": 200, "body": {"id": int(id), "name": "Alice"}}

if __name__ == "__main__":
    wrapped = error_handler(app)
    print(wrapped.handle({"path": "/users", "method": "GET"}))
    print(wrapped.handle({"path": "/users/1", "method": "GET"}))
    print(wrapped.handle({"path": "/users/99", "method": "GET"}))"""},
            {"name": "router.py", "code": """import re

class Router:
    def __init__(self):
        self.routes = []

    def route(self, pattern):
        def decorator(func):
            regex = re.sub(r"<(\\w+)>", r"(?P<\\1>[^/]+)", pattern)
            self.routes.append((re.compile(f"^{regex}$"), func))
            return func
        return decorator

    def handle(self, request):
        path = request["path"]
        for pattern, handler in self.routes:
            match = pattern.match(path)
            if match:
                return handler(request, **match.groupdict())
        return {"status": 404, "body": "Not found"}"""},
            {"name": "middleware.py", "code": """class error_handler:
    def __init__(self, app):
        self.app = app

    def handle(self, request):
        try:
            return self.app.handle(request)
        except ValueError as e:
            return {"status": 404, "body": str(e)}
        except Exception as e:
            return {"status": 500, "body": f"Internal error: {e}"}"""},
        ],
    },
    {
        "id": "corpus-c-multifile-calc",
        "title": "Expression Calculator in C",
        "series": "C",
        "concepts": ["Header files and declarations", "Function pointers for operations",
                     "Enum for token types", "Multi-file compilation"],
        "files": [
            {"name": "calc.h", "code": """#ifndef CALC_H
#define CALC_H

typedef enum { NUM, ADD, SUB, MUL, DIV } TokenType;

typedef struct {
    TokenType type;
    double value;
} Token;

double evaluate(const char* expr);
Token next_token(const char** input);

#endif"""},
            {"name": "calc.c", "code": """#include "calc.h"
#include <stdio.h>
#include <stdlib.h>
#include <ctype.h>

Token next_token(const char** input) {
    while (isspace(**input)) (*input)++;

    if (isdigit(**input) || **input == '.') {
        char* end;
        double val = strtod(*input, &end);
        *input = end;
        return (Token){NUM, val};
    }

    char c = *(*input)++;
    switch (c) {
        case '+': return (Token){ADD, 0};
        case '-': return (Token){SUB, 0};
        case '*': return (Token){MUL, 0};
        case '/': return (Token){DIV, 0};
        default:
            fprintf(stderr, "Unknown char: %c\\n", c);
            exit(1);
    }
}

double evaluate(const char* expr) {
    Token left = next_token(&expr);
    double result = left.value;

    while (*expr) {
        Token op = next_token(&expr);
        Token right = next_token(&expr);

        switch (op.type) {
            case ADD: result += right.value; break;
            case SUB: result -= right.value; break;
            case MUL: result *= right.value; break;
            case DIV:
                if (right.value == 0.0) {
                    fprintf(stderr, "Division by zero\\n");
                    exit(1);
                }
                result /= right.value;
                break;
            default: break;
        }
    }
    return result;
}"""},
            {"name": "main.c", "code": """#include "calc.h"
#include <stdio.h>

int main(int argc, char* argv[]) {
    if (argc < 2) {
        printf("Usage: calc \\"1 + 2 * 3\\"\\n");
        return 1;
    }

    double result = evaluate(argv[1]);
    printf("= %.2f\\n", result);
    return 0;
}"""},
        ],
    },
]


def build_corpus():
    lessons = []

    # Load from sample repos
    print("Loading from samples/...")
    for rel_path, series, title, concepts in SAMPLE_FILES:
        lesson = load_sample(rel_path, series, title, concepts)
        if lesson:
            lines = lesson["code"].split("\n")
            print(f"  {lesson['id'][:45]:45s} {series:12s} {len(lines):3d} lines")
            lessons.append(lesson)

    # Add synthetic code
    print(f"\nAdding {len(SYNTHETIC)} synthetic snippets...")
    for s in SYNTHETIC:
        s.setdefault("difficulty", "Project")
        s.setdefault("bridges", {})
        s.setdefault("seedQuestions", [
            "What's the main data structure here?",
            "Walk me through the core logic.",
            "What error cases does this handle?",
        ])
        if "files" in s:
            total = sum(len(f["code"].split("\n")) for f in s["files"])
            names = "+".join(f["name"] for f in s["files"])
            print(f"  {s['id'][:45]:45s} {s['series']:12s} {total:3d} lines  MULTI-FILE ({names})")
        else:
            total = len(s["code"].split("\n"))
            print(f"  {s['id'][:45]:45s} {s['series']:12s} {total:3d} lines")
        lessons.append(s)

    # Write output
    OUTPUT.parent.mkdir(exist_ok=True)
    with open(OUTPUT, "w") as f:
        json.dump(lessons, f, indent=2)

    print(f"\nTotal: {len(lessons)} lessons")
    print(f"Output: {OUTPUT}")


if __name__ == "__main__":
    build_corpus()
