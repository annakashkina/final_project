/* @codeprobe-track
{"title": "codeprobe \u2014 C", "section": "Programming concepts", "order": 5, "icon": "\u2699\ufe0f", "name": "C Programming", "description": "From variables and pointers to linked lists, trees, and binary I/O \u2014 everything you need for Arc 01 and Arc 02.", "meta": ["32 lessons", "10 series", "Beginner \u2192 Advanced"]}
*/
import { cFoundations, pointersMemory, stringWork, dataStructures, buildingPrograms, unixShell, advancedConcepts } from "./lessons/s01_arc01.js";
import { recursionTrees, systemsProgramming, advancedPatterns } from "./lessons/s01_arc02.js";

export const series = [
  cFoundations,
  pointersMemory,
  stringWork,
  dataStructures,
  buildingPrograms,
  unixShell,
  advancedConcepts,
  recursionTrees,
  systemsProgramming,
  advancedPatterns,
];

export const lessons = series.flatMap(s => {
  for (const l of s.lessons) l.series = s.name;
  return s.lessons;
});
