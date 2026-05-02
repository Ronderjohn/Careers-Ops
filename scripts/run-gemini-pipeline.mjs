#!/usr/bin/env node
/**
 * Forwards argv to gemini-pipeline.mjs with cwd = repo root.
 * Use when `node gemini-pipeline.mjs …` fails due to shell cwd / path quirks
 * (e.g. npm run from a directory without .env). On Windows with apostrophes
 * in the path, prefer `subst` + `Z: && node …` or run this script by absolute path.
 */
import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const forwarded = process.argv.slice(2);
const r = spawnSync(process.execPath, ['gemini-pipeline.mjs', ...forwarded], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
process.exit(r.status === null ? 1 : r.status);
