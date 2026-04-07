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
