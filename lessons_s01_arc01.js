/* @codeprobe-track
{"title": "codeprobe \u2014 C Fundamentals", "section": "Programming concepts", "order": 20, "icon": "\u2699\ufe0f", "name": "C Fundamentals", "description": "Variables, pointers, strings, structs, malloc, file I/O, Makefiles, and building printf from scratch.", "meta": ["23 lessons", "7 series", "Beginner \u2192 Advanced"]}
*/
import { cFoundations, pointersMemory, stringWork, dataStructures, buildingPrograms, unixShell, advancedConcepts } from "./lessons/s01_arc01.js";

export const series = [
  cFoundations,
  pointersMemory,
  stringWork,
  dataStructures,
  buildingPrograms,
  unixShell,
  advancedConcepts,
];

export const lessons = series.flatMap(s => {
  for (const l of s.lessons) l.series = s.name;
  return s.lessons;
});
