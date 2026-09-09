#!/usr/bin/env node
/**
 * Extract lesson data from prototype JS files and output as JSON.
 * Used by generate_training_data.py to load lesson content.
 *
 * Usage: node extract_lessons.js [--pretty]
 */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const lessonsDir = path.join(__dirname, "..", "prototype", "lessons");
const files = ["c.js", "cpp.js", "python.js", "ruby.js", "rust.js", "typescript.js"];
// meta.js excluded: those lessons teach about codeprobe itself, not programming

const allLessons = [];

for (const f of files) {
  let code = fs.readFileSync(path.join(lessonsDir, f), "utf8");
  // Convert ES module export to context assignment
  code = code.replace(/^export\s+const\s+(\w+)\s*=/gm, "this.$1 =");

  const ctx = {};
  try {
    vm.runInNewContext(code, ctx);
  } catch (e) {
    process.stderr.write(`Error parsing ${f}: ${e.message}\n`);
    continue;
  }

  for (const k of Object.keys(ctx)) {
    const obj = ctx[k];
    if (obj && Array.isArray(obj.lessons)) {
      for (const lesson of obj.lessons) {
        lesson.series = obj.name;
        allLessons.push(lesson);
      }
    }
  }
}

const pretty = process.argv.includes("--pretty");
process.stdout.write(JSON.stringify(allLessons, null, pretty ? 2 : 0) + "\n");
process.stderr.write(`Extracted ${allLessons.length} lessons\n`);
