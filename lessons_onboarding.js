/* @codeprobe-track
{"title": "codeprobe \u2014 onboarding", "section": "Onboarding", "order": 1, "icon": "\ud83d\udd27", "name": "How codeprobe works", "description": "Learn the codeprobe codebase itself \u2014 the server, auth model, prompt engineering, privacy architecture, deployment, and the ML line-reference validator.", "meta": ["22 lessons", "7 series"]}
*/
import { overviewLessons, metaLessons } from "./lessons/meta.js?v=3";
import { mlLessons } from "./lessons/ml.js?v=3";

const meta = metaLessons.lessons;
const ml = mlLessons.lessons;
const pick = (src, ...ids) => ids.map(id => src.find(l => l.id === id));

export const series = [
  overviewLessons,
  { name: "Content & navigation", lessons: pick(meta,
    "meta-lessons", "meta-flow", "meta-routing",
  )},
  { name: "AI tutoring", lessons: pick(meta,
    "meta-prompt", "meta-chat", "meta-llm",
  )},
  { name: "Privacy & persistence", lessons: pick(meta,
    "meta-privacy", "meta-session", "meta-progress", "meta-auth",
  )},
  { name: "Server & hardening", lessons: pick(meta,
    "meta-server", "meta-security", "meta-deploy",
  )},
  { name: "Detecting wrong line numbers", lessons: pick(ml,
    "ml-problem", "ml-extraction", "ml-verification",
  )},
  { name: "Training the validator", lessons: pick(ml,
    "ml-datagen", "ml-realdata", "ml-features", "ml-training",
  )},
];

export const lessons = series.flatMap(s => {
  for (const l of s.lessons) l.series = s.name;
  return s.lessons;
});
