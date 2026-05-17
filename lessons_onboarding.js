/* @codeprobe-track
{"title": "codeprobe \u2014 onboarding", "section": "Onboarding", "order": 50, "icon": "\ud83d\udd27", "name": "How codeprobe works", "description": "Learn the codeprobe codebase itself \u2014 architecture, AI tutoring, privacy, analytics, deployment, and the ML line-reference validator.", "meta": ["29 lessons", "9 series"]}
*/
import { overviewLessons, metaLessons } from "./lessons/meta.js?v=4";
import { mlLessons } from "./lessons/ml.js?v=4";

const meta = metaLessons.lessons;
const ml = mlLessons.lessons;
const pick = (src, ...ids) => ids.map(id => src.find(l => l.id === id));

export const series = [
  overviewLessons,
  { name: "Content & navigation", lessons: pick(meta,
    "meta-lessons", "meta-flow", "meta-routing", "meta-tracks",
  )},
  { name: "Code display & UI", lessons: pick(meta,
    "meta-code-display", "meta-layout",
  )},
  { name: "AI tutoring", lessons: pick(meta,
    "meta-prompt", "meta-chat", "meta-llm", "meta-scaffolding",
  )},
  { name: "Privacy & persistence", lessons: pick(meta,
    "meta-privacy", "meta-auth", "meta-session", "meta-progress",
  )},
  { name: "Analytics & ops", lessons: pick(meta,
    "meta-events", "meta-feedback", "meta-dashboard",
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
