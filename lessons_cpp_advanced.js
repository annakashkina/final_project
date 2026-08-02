/* @codeprobe-track
{"title": "codeprobe — Advanced C++: From Advanced-Zero to Advanced-Hero", "section": "Programming concepts", "order": 2, "icon": "⚙️", "name": "Advanced C++: Advanced-Zero to Advanced-Hero", "description": "A staff-engineer-level deep dive into modern C++. Value categories, perfect forwarding, templates, concepts, coroutines, the memory model, ranges, allocators — the machinery you need to lead a C++ codebase.", "meta": ["76 lessons", "23 series", "Core → Staff-level"]}
*/
import { cppValueCategories } from "./lessons/cpp_value_categories.js";
import { cppMoveForward } from "./lessons/cpp_move_forward.js";
import { cppOwnership } from "./lessons/cpp_ownership.js";
import { cppMemory } from "./lessons/cpp_memory.js";
import { cppTemplates } from "./lessons/cpp_templates.js";
import { cppVariadic } from "./lessons/cpp_variadic.js";
import { cppConcepts } from "./lessons/cpp_concepts.js";
import { cppTraits } from "./lessons/cpp_traits.js";
import { cppErasure } from "./lessons/cpp_erasure.js";
import { cppDeduction } from "./lessons/cpp_deduction.js";
import { cppCrtp } from "./lessons/cpp_crtp.js";
import { cppLambdas } from "./lessons/cpp_lambdas.js";
import { cppExceptions } from "./lessons/cpp_exceptions.js";
import { cppMemoryModel } from "./lessons/cpp_memory_model.js";
import { cppConcurrency } from "./lessons/cpp_concurrency.js";
import { cppCoroutines } from "./lessons/cpp_coroutines.js";
import { cppRanges } from "./lessons/cpp_ranges.js";
import { cppConstexpr } from "./lessons/cpp_constexpr.js";
import { cppModules } from "./lessons/cpp_modules.js";
import { cppPerf } from "./lessons/cpp_perf.js";
import { cppAbi } from "./lessons/cpp_abi.js";
import { cppProjectSmallVec } from "./lessons/cpp_project_smallvec.js";
import { cppProjectThreadpool } from "./lessons/cpp_project_threadpool.js";

export const series = [
  cppValueCategories,
  cppMoveForward,
  cppOwnership,
  cppMemory,
  cppTemplates,
  cppVariadic,
  cppConcepts,
  cppTraits,
  cppErasure,
  cppDeduction,
  cppCrtp,
  cppLambdas,
  cppExceptions,
  cppMemoryModel,
  cppConcurrency,
  cppCoroutines,
  cppRanges,
  cppConstexpr,
  cppModules,
  cppPerf,
  cppAbi,
  cppProjectSmallVec,
  cppProjectThreadpool,
];

export const lessons = series.flatMap(s => {
  for (const l of s.lessons) { l.series = s.name; l.extension = "cpp"; }
  return s.lessons;
});
