export const pythonLessons = [
  {
    id: "py-lists-comprehensions",
    lang: "python",
    title: "Lists, Slicing & Comprehensions",
    difficulty: "Essential",
    icon: "🐍",
    description:
      "Lists are Python's workhorse. Slicing and comprehensions are what make Python code feel short and expressive.",
    concepts: [
      "List slicing (start:stop:step)",
      "List comprehensions",
      "Nested comprehensions",
      "Unpacking with *",
    ],
    bridges: {
      Java: "Like ArrayList but with built-in slicing syntax. Comprehensions replace Stream.map().filter().collect() in one line.",
      JavaScript: "Like arrays with .map()/.filter(), but comprehensions do it in a single expression. Slicing replaces .slice().",
      "C++": "Like std::vector but with slice syntax built into the language. No iterators needed for basic transforms.",
    },
    code: `nums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

# Slicing: [start:stop:step]
first_three = nums[:3]       # [1, 2, 3]
last_three  = nums[-3:]      # [8, 9, 10]
reversed_l  = nums[::-1]     # [10, 9, ..., 1]

# List comprehension: [expr for item in list if cond]
squares = [x ** 2 for x in nums if x % 2 == 0]
# [4, 16, 36, 64, 100]

# Unpacking with *
first, *middle, last = [1, 2, 3, 4, 5]
# first=1, middle=[2,3,4], last=5

# Combine lists
a = [1, 2, 3]
b = [4, 5, 6]
combined = [*a, *b]        # [1, 2, 3, 4, 5, 6]`,
    seedQuestions: [
      "How does nums[::-1] reverse the list?",
      "What's the difference between a list comprehension and a for loop?",
      "What does the * do in first, *middle, last?",
    ],
  },

  {
    id: "py-dicts-sets",
    lang: "python",
    title: "Dicts, Sets & Unpacking",
    difficulty: "Essential",
    icon: "🐍",
    description:
      "Dicts and sets are everywhere in Python. Master them and you'll write cleaner code than 90% of beginners.",
    concepts: [
      "Dict operations and .get()",
      "defaultdict and Counter",
      "Set operations (union, intersection)",
      "** unpacking and merging",
    ],
    bridges: {
      Java: "Like HashMap/HashSet but with cleaner syntax. Dict comprehensions replace Streams. ** unpacking has no Java equivalent.",
      JavaScript: "Like objects/Maps and Sets. Python dicts preserve insertion order (like Map). ** is like JS spread {...obj}.",
      "C++": "Like std::unordered_map and std::unordered_set, but with built-in literals and comprehension syntax.",
    },
    code: `user = {"name": "Alice", "age": 30, "role": "engineer"}

print(user["name"])              # Alice
print(user.get("email", "n/a")) # n/a — no KeyError

# Merge dicts: ** unpacking (later overrides earlier)
defaults = {"theme": "dark", "lang": "en"}
prefs = {"theme": "light"}
merged = {**defaults, **prefs}   # {'theme': 'light', 'lang': 'en'}

# Sets: unique items, fast membership
a = {1, 2, 3, 4}
b = {3, 4, 5, 6}
print(a & b)   # {3, 4}     — intersection
print(a | b)   # {1,2,3,4,5,6} — union
print(a - b)   # {1, 2}     — difference

# Counter — count anything
from collections import Counter
words = "the cat sat on the mat the cat".split()
print(Counter(words).most_common(2))  # [('the', 3), ('cat', 2)]`,
    seedQuestions: [
      "Why use .get() instead of square brackets?",
      "How does {**defaults, **prefs} handle duplicate keys?",
      "When would you use a set instead of a list?",
    ],
  },

  {
    id: "py-functions",
    lang: "python",
    title: "Functions: Flexible & First-Class",
    difficulty: "Essential",
    icon: "🐍",
    description:
      "Python functions are objects. You can store them, pass them, return them. This plus *args/**kwargs makes Python functions uniquely flexible.",
    concepts: [
      "*args and **kwargs",
      "Functions as first-class objects",
      "Lambda expressions",
      "Default argument gotcha (mutable defaults)",
    ],
    bridges: {
      Java: "Java methods aren't objects — you need functional interfaces. Python functions are values you can assign to variables and pass around freely.",
      JavaScript: "Very similar to JS — functions as values, closures, rest params (...args). Python adds **kwargs for named rest params.",
      "C++": "Like function pointers or std::function, but much simpler. *args is like variadic templates without the template syntax.",
    },
    code: `# *args = tuple of positional, **kwargs = dict of keyword
def log(msg, *tags, **meta):
    print(f"{tags} {msg} {meta}")

log("deploy", "prod", "v2", region="us-east")
# ('prod', 'v2') deploy {'region': 'us-east'}

# Functions are objects — store and pass them
def shout(t): return t.upper() + "!"
def whisper(t): return t.lower() + "..."

fmt = {"loud": shout, "quiet": whisper}
print(fmt["loud"]("hello"))   # HELLO!

# Lambda: anonymous one-liners
nums = [3, 1, 4, 1, 5]
print(sorted(nums, key=lambda x: -x))  # [5, 4, 3, 1, 1]

# GOTCHA: mutable default args
def add(item, items=[]):   # BUG: shared across calls!
    items.append(item)
    return items
print(add("a"))  # ['a']
print(add("b"))  # ['a', 'b'] — same list!`,
    seedQuestions: [
      "What's the difference between *args and **kwargs?",
      "Why does the mutable default argument bug happen?",
      "How is passing a function different from calling it?",
      "When would you use lambda vs a named function?",
    ],
  },

  {
    id: "py-classes",
    lang: "python",
    title: "Classes & Magic Methods",
    difficulty: "Core",
    icon: "🐍",
    description:
      "Python classes use 'dunder' (double underscore) methods to integrate with the language. Define __repr__ and your objects print nicely. Define __eq__ and == works.",
    concepts: [
      "__init__, __repr__, __str__",
      "__eq__ and __lt__ for comparisons",
      "@property for computed attributes",
      "dataclasses for less boilerplate",
    ],
    bridges: {
      Java: "Like Java classes but lighter. __repr__ = toString(), __eq__ = equals(), @property = getters without Java's ceremony. dataclass = Lombok's @Data.",
      JavaScript: "Like ES6 classes but with operator overloading via dunders. __repr__ ≈ toString(). No equivalent to @property in JS.",
      "C++": "Like operator overloading (operator==, operator<) but using named methods. @property is like a getter without parentheses.",
    },
    code: `class Money:
    def __init__(self, amount, currency="USD"):
        self.amount = amount
        self.currency = currency

    def __repr__(self):       # for developers
        return f"Money({self.amount}, '{self.currency}')"

    def __add__(self, other):  # enables: a + b
        return Money(self.amount + other.amount, self.currency)

    def __lt__(self, other):   # enables: a < b, sorted()
        return self.amount < other.amount

    @property
    def is_negative(self):     # access like attribute, no ()
        return self.amount < 0

a = Money(10.50)
b = Money(3.75)
print(a + b)         # Money(14.25, 'USD')
print(a > b)         # True — __lt__ gives > for free
print(a.is_negative) # False

# dataclass: auto-generates __init__, __repr__, __eq__
from dataclasses import dataclass

@dataclass
class Point:
    x: float
    y: float

p = Point(3, 4)
print(p)                  # Point(x=3, y=4)
print(p == Point(3, 4))  # True — auto __eq__`,
    seedQuestions: [
      "What's the difference between __repr__ and __str__?",
      "How does defining __lt__ also give us > and sorted()?",
      "Why use @property instead of just a method?",
      "What does @dataclass auto-generate compared to a regular class?",
    ],
  },

  {
    id: "py-error-context",
    lang: "python",
    title: "Error Handling & Context Managers",
    difficulty: "Core",
    icon: "🐍",
    description:
      "Python's 'with' statement guarantees cleanup even when things crash. Combined with try/except/else/finally, it makes robust code easy to write.",
    concepts: [
      "try / except / else / finally",
      "with statement and context managers",
      "Writing your own context manager",
      "EAFP vs LBYL",
    ],
    bridges: {
      Java: "try/catch/finally is almost identical. 'with' is like try-with-resources. Python's EAFP style (ask forgiveness) is the opposite of Java's defensive checks.",
      JavaScript: "Like try/catch/finally. No built-in equivalent to Python's 'with' — you'd use .finally() on promises. Python's else clause has no JS equivalent.",
      "C++": "Like RAII (Resource Acquisition Is Initialization) — 'with' guarantees cleanup like destructors. But explicit instead of implicit.",
    },
    code: `# try / except / else / finally
def parse_config(text):
    try:
        key, value = text.split("=", 1)
    except ValueError:
        return None              # bad format
    else:
        return {key.strip(): value.strip()}  # only if no exception
    finally:
        print("done")           # ALWAYS runs, even after return

parse_config("host = localhost")  # {'host': 'localhost'}
parse_config("bad data")          # None

# Context manager: guaranteed cleanup with 'with'
with open("data.txt", "w") as f:
    f.write("hello\\n")
# f is ALWAYS closed here, even if write() crashes

# Write your own with @contextmanager
from contextlib import contextmanager
import time

@contextmanager
def timer(label):
    start = time.perf_counter()
    yield   # code inside 'with' runs here
    print(f"{label}: {time.perf_counter() - start:.4f}s")

with timer("sum"):
    total = sum(range(1_000_000))`,
    seedQuestions: [
      "When does the 'else' clause run vs the 'finally' clause?",
      "What does EAFP mean and why does Python prefer it?",
      "What happens if the code inside a 'with' block raises an exception?",
      "In the timer context manager, what does 'yield' do?",
    ],
  },

  {
    id: "py-decorators",
    lang: "python",
    title: "Decorators & Closures",
    difficulty: "Core",
    icon: "🐍",
    description:
      "Functions that wrap functions. Decorators are everywhere in Python — understand how they actually work.",
    concepts: [
      "Closures and captured variables",
      "Decorator pattern (function → function)",
      "Decorators with arguments",
      "@wraps preserving metadata",
    ],
    bridges: {
      Rust: "Rust has no decorators — you'd use macros or trait impls. Python closures are GC'd, no lifetime issues.",
      Java: "Like annotations + proxy pattern, but Python does it with plain functions. Much less ceremony.",
      JavaScript: "JS has closures too, and TC39 decorators. Python's are simpler — just function composition.",
    },
    code: `from functools import wraps
import time

def timer(func):
    @wraps(func)    # preserves func.__name__
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        print(f"{func.__name__}: {time.perf_counter()-start:.4f}s")
        return result
    return wrapper

def retry(max_attempts=3):
    """Decorator WITH arguments → three nested functions."""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts: raise
                    print(f"Attempt {attempt} failed: {e}")
        return wrapper
    return decorator

@timer
@retry(max_attempts=3)
def fetch(url):
    import random
    if random.random() < 0.5:
        raise ConnectionError("timeout")
    return {"status": "ok"}

print(fetch("https://api.example.com"))`,
    seedQuestions: [
      "What does @wraps(func) do and why is it needed?",
      "Why does retry() have THREE nested functions but timer only has two?",
      "In what order do stacked decorators (@timer then @retry) execute?",
      "How does wrapper(*args, **kwargs) handle any function signature?",
    ],
  },

  // ===== CODEBASE LESSON: Flask =====
  {
    id: "py-flask-api",
    lang: "python",
    title: "Flask: Build a REST API",
    difficulty: "Project",
    icon: "📦",
    description:
      "Flask is the most popular lightweight Python web framework. See how decorators, dicts, and functions come together to build a real API in ~50 lines.",
    concepts: [
      "Route decorators (@app.route)",
      "HTTP methods and request parsing",
      "JSON responses",
      "Error handling in web apps",
    ],
    bridges: {
      Java: "Like Spring Boot @GetMapping/@PostMapping but with zero config. Flask routes are just decorated functions — no classes needed.",
      JavaScript: "Like Express.js (app.get, app.post) — almost identical pattern. Flask uses decorators where Express uses method calls.",
      "C++": "No direct equivalent. Flask shows why Python dominates web APIs — this would be hundreds of lines in C++.",
    },
    files: [
      {
        name: "app.py",
        code: `from flask import Flask, request, jsonify

app = Flask(__name__)
books = {
    1: {"id": 1, "title": "Dune", "author": "Frank Herbert"},
    2: {"id": 2, "title": "Neuromancer", "author": "William Gibson"},
}
next_id = 3

@app.route("/books")
def list_books():
    return jsonify(list(books.values()))

@app.route("/books/<int:book_id>")
def get_book(book_id):
    book = books.get(book_id)
    if not book:
        return jsonify({"error": "Not found"}), 404
    return jsonify(book)

@app.route("/books", methods=["POST"])
def add_book():
    global next_id
    data = request.get_json()
    if not data or "title" not in data:
        return jsonify({"error": "title required"}), 400
    book = {"id": next_id, "title": data["title"],
            "author": data.get("author", "Unknown")}
    books[next_id] = book
    next_id += 1
    return jsonify(book), 201`,
      },
      {
        name: "test_it.sh",
        code: `# flask run  (or: python app.py)

curl http://localhost:5000/books           # list all
curl http://localhost:5000/books/1         # get one

curl -X POST http://localhost:5000/books \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Snow Crash", "author": "Neal Stephenson"}'`,
      },
    ],
    seedQuestions: [
      "How does @app.route connect a URL to a function?",
      "What does <int:book_id> do in the route?",
      "Why return a tuple like jsonify(...), 404 instead of just jsonify(...)?",
      "How would you add a DELETE endpoint?",
    ],
  },

  {
    id: "py-numpy",
    lang: "python",
    title: "NumPy: Arrays & Vectorization",
    difficulty: "Core",
    icon: "🐍",
    description:
      "NumPy arrays replace loops with fast vectorized operations. One line of NumPy often replaces ten lines of plain Python — and runs 50x faster.",
    concepts: [
      "ndarray vs Python lists",
      "Vectorized operations (no loops)",
      "Slicing and boolean indexing",
      "Broadcasting",
    ],
    bridges: {
      Java: "No equivalent — Java arrays don't support math ops. NumPy is closer to MATLAB than to Java.",
      JavaScript: "Like typed arrays on steroids. a + b adds element-wise — no .map() needed.",
      "C++": "Like Eigen or std::valarray. Same idea — SIMD-friendly contiguous memory with operator overloading.",
    },
    code: `import numpy as np

a = np.array([1, 2, 3, 4, 5])

# Vectorized math — no loops!
print(a * 2)         # [2, 4, 6, 8, 10]
print(a ** 2)        # [1, 4, 9, 16, 25]
print(a + a)         # [2, 4, 6, 8, 10]

# Boolean indexing — filter without loops
print(a[a > 3])      # [4, 5]

# 2D array (matrix)
m = np.array([[1, 2, 3],
              [4, 5, 6]])
print(m.shape)       # (2, 3)
print(m[:, 0])       # [1, 4] — first column
print(m.sum(axis=1)) # [6, 15] — sum each row

# Broadcasting: scalar applies to every element
print(m > 3)         # [[F, F, F], [T, T, T]]

# 50x faster than Python loops for large arrays
big = np.arange(1_000_000)
total = big.sum()    # one C call, not 1M Python iterations`,
    seedQuestions: [
      "Why is a * 2 different from a Python list times 2?",
      "How does a[a > 3] work — what does a > 3 return?",
      "What does axis=1 mean in m.sum(axis=1)?",
      "Why is NumPy so much faster than a Python loop?",
    ],
  },

  {
    id: "py-pandas",
    lang: "python",
    title: "Pandas: DataFrames in 5 Minutes",
    difficulty: "Core",
    icon: "🐍",
    description:
      "Pandas is how Python handles tabular data. A DataFrame is like a spreadsheet you can code against — filter, group, and transform with one-liners.",
    concepts: [
      "DataFrame creation and indexing",
      "Filtering rows",
      "groupby and aggregation",
      "Method chaining",
    ],
    bridges: {
      Java: "No real equivalent. Imagine if a HashMap<String, List> had built-in SQL-like queries.",
      JavaScript: "Like Lodash/D3 for data, but built into the language ecosystem. df.groupby() ≈ d3.group().",
      "C++": "No standard equivalent. Pandas is why data scientists choose Python over C++.",
    },
    code: `import pandas as pd

df = pd.DataFrame({
    "name":  ["Alice", "Bob", "Carol", "Dave"],
    "dept":  ["eng", "eng", "sales", "sales"],
    "salary": [95, 110, 80, 85],
})

print(df)
#     name   dept  salary
# 0  Alice    eng      95
# 1    Bob    eng     110
# 2  Carol  sales      80
# 3   Dave  sales      85

# Filter rows
senior = df[df["salary"] > 90]
eng = df[df["dept"] == "eng"]

# Groupby + aggregate
print(df.groupby("dept")["salary"].mean())
# eng      102.5
# sales     82.5

# Add a column
df["bonus"] = df["salary"] * 0.1

# Sort
print(df.sort_values("salary", ascending=False))

# Chain it all
result = (df
    .query("dept == 'eng'")
    .assign(total=lambda x: x.salary + x.bonus)
    .sort_values("total"))`,
    seedQuestions: [
      "How does df[df['salary'] > 90] filter rows — what's inside the brackets?",
      "What does groupby actually return before you call .mean()?",
      "Why use .query() instead of bracket filtering?",
      "How does method chaining work with the parentheses style?",
    ],
  },
];
