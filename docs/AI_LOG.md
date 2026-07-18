# AI Collaboration Log

Every prompt submitted to Claude Code (CLI or VS Code extension) is
auto-logged by a `UserPromptSubmit` hook (`.claude/hooks/log-prompt.js`,
configured in `.claude/settings.json`).

Each teammate's prompts are appended to their own file under
[`docs/ai-log/`](ai-log/), named after their `git config user.name`
(e.g. `docs/ai-log/quan-hoang.md`). This is deliberate: everyone writing
to one shared file would conflict constantly as the team commits in
parallel. Per-author files never collide.

Full raw session transcripts (including Claude's responses and tool
calls, not just prompts) remain available at
`~/.claude/projects/<project>/*.jsonl` per session, per the submission
requirements.
