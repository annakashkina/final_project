/* @codeprobe-track
{"title": "codeprobe", "section": "Programming concepts", "order": 10, "icon": "\ud83d\udcbb", "name": "Language Concepts", "description": "C, Rust, Python, TypeScript, Ruby, C++ \u2014 learn programming concepts through real code snippets across languages.", "meta": ["Multiple languages", "Beginner \u2192 Advanced"]}
*/
import { cLessons } from "./lessons/c.js";
import { rustLessons } from "./lessons/rust.js";
import { pythonLessons } from "./lessons/python.js";
import { typescriptLessons } from "./lessons/typescript.js";
import { rubyLessons } from "./lessons/ruby.js";
import { cppLessons } from "./lessons/cpp.js";

export const series = [
  cLessons,
  rustLessons,
  pythonLessons,
  typescriptLessons,
  rubyLessons,
  cppLessons,
];

export const lessons = series.flatMap(s => {
  for (const l of s.lessons) l.series = s.name;
  return s.lessons;
});
