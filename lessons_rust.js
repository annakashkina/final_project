/* @codeprobe-track
{"title": "codeprobe — Rust: Zero to Hero", "section": "Programming concepts", "order": 1, "icon": "🦀", "name": "Rust: Zero to Hero", "description": "A comprehensive Rust programming course. From hello world to async, unsafe, and real project architecture — ace every lesson and become a ready Rust programmer.", "meta": ["59 lessons", "17 series", "Beginner → Expert"]}
*/
import { rustFoundations } from "./lessons/rust_foundations.js";
import { rustOwnership } from "./lessons/rust_ownership.js";
import { rustTypes } from "./lessons/rust_types.js";
import { rustCollections } from "./lessons/rust_collections.js";
import { rustErrors } from "./lessons/rust_errors.js";
import { rustTraits } from "./lessons/rust_traits.js";
import { rustLifetimes } from "./lessons/rust_lifetimes.js";
import { rustModules } from "./lessons/rust_modules.js";
import { rustSmartPtrs } from "./lessons/rust_smart_ptrs.js";
import { rustConcurrency } from "./lessons/rust_concurrency.js";
import { rustFunctional } from "./lessons/rust_functional.js";
import { rustIo } from "./lessons/rust_io.js";
import { rustTesting } from "./lessons/rust_testing.js";
import { rustUnsafe } from "./lessons/rust_unsafe.js";
import { rustTypeSystem } from "./lessons/rust_type_system.js";
import { rustAsync } from "./lessons/rust_async.js";
import { rustProjects } from "./lessons/rust_projects.js";

export const series = [
  rustFoundations,
  rustOwnership,
  rustTypes,
  rustCollections,
  rustErrors,
  rustTraits,
  rustLifetimes,
  rustModules,
  rustSmartPtrs,
  rustConcurrency,
  rustFunctional,
  rustIo,
  rustTesting,
  rustUnsafe,
  rustTypeSystem,
  rustAsync,
  rustProjects,
];

export const lessons = series.flatMap(s => {
  for (const l of s.lessons) { l.series = s.name; l.extension = "rs"; }
  return s.lessons;
});
