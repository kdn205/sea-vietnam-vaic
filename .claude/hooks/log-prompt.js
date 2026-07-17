#!/usr/bin/env node
// UserPromptSubmit hook: append each submitted prompt to a per-author log
// under docs/ai-log/<git-user>.md. Splitting by author (instead of one
// shared file) avoids merge conflicts when multiple teammates commit their
// logs. Node is used (rather than python/jq) because it is guaranteed
// present wherever Claude Code itself runs (CLI and VS Code extension,
// Windows or WSL).
"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

function authorSlug(projectDir) {
  let name;
  try {
    name = execFileSync("git", ["config", "user.name"], {
      cwd: projectDir,
      encoding: "utf8",
    }).trim();
  } catch {
    name = "";
  }
  if (!name) name = os.userInfo().username || "unknown";
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "unknown";
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(raw);
    const prompt = payload.prompt || "";
    if (!prompt.trim()) return;

    const sessionId = (payload.session_id || "unknown").slice(0, 8);
    const timestamp = new Date().toString().replace(/ \(.+\)$/, "");

    const projectDir = path.resolve(__dirname, "..", "..");
    const logDir = path.join(projectDir, "docs", "ai-log");
    fs.mkdirSync(logDir, { recursive: true });

    const slug = authorSlug(projectDir);
    const logPath = path.join(logDir, `${slug}.md`);

    let entry = "";
    if (!fs.existsSync(logPath)) {
      entry += `# AI prompt log — ${slug}\n\nAuto-appended by .claude/hooks/log-prompt.js. See docs/AI_LOG.md for details.\n`;
    }
    entry += `\n## ${timestamp} · session ${sessionId}\n\n${prompt}\n`;
    fs.appendFileSync(logPath, entry, "utf8");
  } catch {
    // Never block the prompt on a logging failure.
  }
});
