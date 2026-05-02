#!/usr/bin/env node
/**
 * run-gemini-agent-cycle.mjs — Run Career-Ops through Gemini CLI in YOLO (agent) mode.
 *
 * Usage:
 *   node run-gemini-agent-cycle.mjs           # /career-ops-full-cycle (scan + pipeline)
 *   node run-gemini-agent-cycle.mjs scan      # /career-ops-scan only
 *   node run-gemini-agent-cycle.mjs pipeline  # /career-ops-pipeline only
 *   node run-gemini-agent-cycle.mjs pipeline-once  # pipeline: first pending URL only (safer for quotas)
 *
 * Requires: gemini on PATH, repo configured (GEMINI.md, .gemini/commands).
 * Uses --approval-mode yolo so the agent can run shell and file tools without prompts.
 * CLI model: GEMINI_CLI_MODEL > GEMINI_MODEL > gemma-4-26b-a4b-it (gemini -m). Job evals use GEMINI_EVAL_MODEL (see .env.example).
 */
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const mode = (process.argv[2] || 'full').toLowerCase();

const PROMPTS = {
  full: '/career-ops-full-cycle',
  scan: '/career-ops-scan',
  pipeline: '/career-ops-pipeline',
  'pipeline-once': `/career-ops-pipeline
Process only the **first** pending job URL under "## Pendientes" in data/pipeline.md (single line starting with "- [ ]"), then stop.
Prefer Greenhouse boards-api JSON for job-boards.greenhouse.io URLs.`,
};

const prompt = PROMPTS[mode] || PROMPTS.full;

const model =
  process.env.GEMINI_CLI_MODEL ||
  process.env.GEMINI_MODEL ||
  'gemma-4-26b-a4b-it';

const args = [
  '-m',
  model,
  '-p',
  prompt,
  '--skip-trust',
  '--approval-mode',
  'yolo',
  '-o',
  'text',
];

const r = spawnSync('gemini', args, {
  cwd: ROOT,
  stdio: 'inherit',
  env: { ...process.env },
  shell: process.platform === 'win32',
});

process.exit(r.status === null ? 1 : r.status);
