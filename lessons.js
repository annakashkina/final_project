import { cLessons } from "./lessons/c.js";
import { rustLessons } from "./lessons/rust.js";
import { pythonLessons } from "./lessons/python.js";
import { typescriptLessons } from "./lessons/typescript.js";
import { rubyLessons } from "./lessons/ruby.js";
import { cppLessons } from "./lessons/cpp.js";
import { metaLessons } from "./lessons/meta.js";

export const series = [
  cLessons,
  rustLessons,
  pythonLessons,
  typescriptLessons,
  rubyLessons,
  cppLessons,
  metaLessons,
];

export const lessons = series.flatMap(s => {
  for (const l of s.lessons) l.series = s.name;
  return s.lessons;
});
