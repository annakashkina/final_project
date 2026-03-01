export const typescriptLessons = { name: "TypeScript", lessons: [
  {
    id: "ts-types",
    title: "Type System Deep Dive",
    difficulty: "Core",
    icon: "🔷",
    description:
      "Unions, narrowing, generics, utility types. The TypeScript type system is more powerful than most people use.",
    concepts: [
      "Discriminated unions and type narrowing",
      "Generic functions with constraints",
      "Utility types (Omit, Partial, Pick, Readonly)",
      "Result pattern for error handling",
    ],
    bridges: {
      Rust: "Rust enums ≈ TS discriminated unions. Rust generics with trait bounds ≈ TS generics with extends.",
      Python: "Python has typing module but it's optional. TS enforces types at compile time — closer to Rust.",
      Java: "Java generics are erased at runtime. TS types are also erased, but the type system is more expressive.",
    },
    code: `// Result type — no exceptions, explicit error handling
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return { ok: false, error: "division by zero" };
  return { ok: true, value: a / b };
}

// Discriminated unions — the "kind" field lets TS narrow the type
interface Circle    { kind: "circle"; radius: number }
interface Rectangle { kind: "rect"; width: number; height: number }
interface Triangle  { kind: "tri"; base: number; height: number }

type Shape = Circle | Rectangle | Triangle;

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle": return Math.PI * shape.radius ** 2;
    case "rect":   return shape.width * shape.height;
    case "tri":    return 0.5 * shape.base * shape.height;
  }
}

// Generics with constraints
interface HasId { id: string }

function findById<T extends HasId>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}

function sortBy<T, K extends keyof T>(items: T[], key: K): T[] {
  return [...items].sort((a, b) =>
    a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0
  );
}

// Utility types in practice
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "guest";
  prefs: { theme: "light" | "dark"; lang: string };
}

type CreateInput  = Omit<User, "id">;
type UpdateInput  = Partial<Pick<User, "name" | "email" | "prefs">>;
type PublicUser    = Readonly<Pick<User, "id" | "name" | "role">>;

function createUser(input: CreateInput): User {
  return { ...input, id: crypto.randomUUID() };
}

function updateUser(user: User, changes: UpdateInput): User {
  return { ...user, ...changes };
}

// Usage
const r = divide(10, 3);
if (r.ok) {
  console.log(r.value.toFixed(2));  // TS knows r.value exists
} else {
  console.error(r.error);           // TS knows r.error exists
}

const shapes: Shape[] = [
  { kind: "circle", radius: 5 },
  { kind: "rect", width: 4, height: 6 },
  { kind: "tri", base: 3, height: 8 },
];
shapes.forEach(s => console.log(\`\${s.kind}: \${area(s).toFixed(2)}\`));`,
    seedQuestions: [
      "How does TypeScript know that r.value exists inside the if(r.ok) block?",
      "What happens if I add a new Shape variant but forget to add it to area()?",
      "What does `K extends keyof T` actually mean?",
      "Why use Omit<User, 'id'> instead of just writing a new interface?",
    ],
  },
] };
