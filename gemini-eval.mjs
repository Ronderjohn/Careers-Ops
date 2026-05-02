#!/usr/bin/env node
/**
 * gemini-eval.mjs — Gemini-powered Job Offer Evaluator for career-ops
 *
 * A free-tier alternative to the Claude-based pipeline.
 * Reads evaluation logic from modes/oferta.md + modes/_shared.md,
 * reads the user's resume from cv.md, and evaluates a Job Description
 * passed as a command-line argument.
 *
 * Usage:
 *   node gemini-eval.mjs "Paste full JD text here"
 *   node gemini-eval.mjs --file ./jds/my-job.txt
 *
 * Requires:
 *   GEMINI_API_KEY in .env (or environment variable)
 *
 * Default model: gemma-4-26b-a4b-it (Gemma 4 on Gemini API — AI Studio key).
 * Model resolution: --model flag > GEMINI_EVAL_MODEL > GEMINI_MODEL > default (Gemma 4 26B).
 * Use GEMINI_EVAL_MODEL in .env when Gemini CLI should use a different model than job evals.
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Bootstrap: load .env from repo root (not process.cwd())
// ---------------------------------------------------------------------------
try {
  const { config } = await import('dotenv');
  config({ path: join(ROOT, '.env') });
} catch {
  // dotenv is optional — fall back to process.env if not installed
}

import { GoogleGenerativeAI } from '@google/generative-ai';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const OFERTA_EN = join(ROOT, 'modes', 'gemini-eval-oferta-en.md');
const OFERTA_ES = join(ROOT, 'modes', 'oferta.md');

const PATHS = {
  shared:   join(ROOT, 'modes', '_shared.md'),
  // Canonical skill path referenced in Issue #344
  evaluate: join(ROOT, '.claude', 'skills', 'career-ops', 'SKILL.md'),
  cv:       join(ROOT, 'cv.md'),
  reports:  join(ROOT, 'reports'),
  tracker:  join(ROOT, 'data', 'applications.md'),
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║           career-ops — Gemini Evaluator (free-tier)             ║
╚══════════════════════════════════════════════════════════════════╝

  Evaluate a job offer using Google Gemini instead of Claude.

  USAGE
    node gemini-eval.mjs "<JD text>"
    node gemini-eval.mjs --file ./jds/my-job.txt
    node gemini-eval.mjs --model gemini-1.5-flash "<JD text>"

  OPTIONS
    --file <path>    Read JD from a file instead of inline text
    --model <name>   Model id (overrides GEMINI_EVAL_MODEL / GEMINI_MODEL; try gemma-4-31b-it)
    --no-save        Do not save report to reports/ directory
    --help           Show this help

  SETUP
    1. Get a free API key at https://aistudio.google.com/apikey
    2. Add GEMINI_API_KEY=<your-key> to .env
    3. Run: npm install   (installs @google/generative-ai + dotenv)

  EXAMPLES
    node gemini-eval.mjs "We are looking for a Senior AI Engineer..."
    node gemini-eval.mjs --file ./jds/openai-swe.txt
`);
  process.exit(0);
}

// Parse flags
let jdText = '';
const DEFAULT_MODEL = 'gemma-4-26b-a4b-it';
let modelName =
  process.env.GEMINI_EVAL_MODEL || process.env.GEMINI_MODEL || DEFAULT_MODEL;
let saveReport = true;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--file' && args[i + 1]) {
    const filePath = args[++i];
    if (!existsSync(filePath)) {
      console.error(`❌  File not found: ${filePath}`);
      process.exit(1);
    }
    jdText = readFileSync(filePath, 'utf-8').trim();
  } else if (args[i] === '--model' && args[i + 1]) {
    modelName = args[++i];
  } else if (args[i] === '--no-save') {
    saveReport = false;
  } else if (!args[i].startsWith('--')) {
    jdText += (jdText ? '\n' : '') + args[i];
  }
}

if (!jdText) {
  console.error('❌  No Job Description provided. Run with --help for usage.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Validate environment
// ---------------------------------------------------------------------------
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(`
❌  GEMINI_API_KEY not found.

   1. Get a free key at https://aistudio.google.com/apikey
   2. Add it to .env:   GEMINI_API_KEY=your_key_here
   3. Or export it:     export GEMINI_API_KEY=your_key_here
`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------
function readFile(path, label) {
  if (!existsSync(path)) {
    console.warn(`⚠️   ${label} not found at: ${path}`);
    return `[${label} not found — skipping]`;
  }
  return readFileSync(path, 'utf-8').trim();
}

function nextReportNumber() {
  if (!existsSync(PATHS.reports)) return '001';
  const files = readdirSync(PATHS.reports)
    .filter(f => /^\d{3}-/.test(f))
    .map(f => parseInt(f.slice(0, 3)))
    .filter(n => !isNaN(n));
  if (files.length === 0) return '001';
  return String(Math.max(...files) + 1).padStart(3, '0');
}

// Lazy import — only used when saving
let readdirSync;
try {
  ({ readdirSync } = await import('fs'));
} catch { /* already imported above via named exports */ }
// Use named import fallback
if (!readdirSync) {
  readdirSync = (await import('fs')).readdirSync;
}

// ---------------------------------------------------------------------------
// Load context files
// ---------------------------------------------------------------------------
console.log('\n📂  Loading context files...');

const sharedContext  = readFile(PATHS.shared,   'modes/_shared.md');
const ofertaPath = existsSync(OFERTA_EN) ? OFERTA_EN : OFERTA_ES;
const ofertaLogic  = readFile(ofertaPath, 'modes/gemini-eval-oferta-en.md (or oferta.md fallback)');
const cvContent      = readFile(PATHS.cv,       'cv.md');

// ---------------------------------------------------------------------------
// Build the system prompt (mirrors the Claude skill router logic)
// ---------------------------------------------------------------------------
const systemPrompt = `You are career-ops, an AI-powered job search assistant.
You evaluate job offers against the user's CV using a structured A-G scoring system.

Your evaluation methodology is defined below. Follow it exactly.

═══════════════════════════════════════════════════════
SYSTEM CONTEXT (_shared.md)
═══════════════════════════════════════════════════════
${sharedContext}

═══════════════════════════════════════════════════════
EVALUATION MODE (oferta.md)
═══════════════════════════════════════════════════════
${ofertaLogic}

═══════════════════════════════════════════════════════
CANDIDATE RESUME (cv.md)
═══════════════════════════════════════════════════════
${cvContent}

═══════════════════════════════════════════════════════
IMPORTANT OPERATING RULES FOR THIS CLI SESSION
═══════════════════════════════════════════════════════
1. You do NOT have access to WebSearch, Playwright, or file writing tools.
   - For Block D (Comp research): provide salary estimates based on your training data, clearly noted as estimates.
   - For Block G (Legitimacy): analyze the JD text only; skip URL/page freshness checks.
   - Post-evaluation file saving is handled by the script, not by you.
2. **Language:** Write Blocks A–G, all tables, headers, gap strategies, and keywords in **English** only. Do not use Spanish or other languages for section prose (mode files may contain Spanish examples — ignore their language for your output).
3. At the very end, output a machine-readable summary block in this exact format:

---SCORE_SUMMARY---
COMPANY: <company name or "Unknown">
ROLE: <role title>
SCORE: <global score as decimal, e.g. 3.8>
ARCHETYPE: <detected archetype>
LEGITIMACY: <High Confidence | Proceed with Caution | Suspicious>
---END_SUMMARY---
`;

// ---------------------------------------------------------------------------
// Call Gemini API
// ---------------------------------------------------------------------------
console.log(`🤖  Calling Gemini (${modelName})... this may take 30-60 seconds.\n`);

const genAI = new GoogleGenerativeAI(apiKey);
// Gemma 4 on the Gemini API expects system text via systemInstruction (see
// https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api). A two-part
// user payload can return 400 "unexpected model name format" for some requests.
const useGemmaLayout = /^gemma-/i.test(modelName);

const model = genAI.getGenerativeModel({
  model: modelName,
  ...(useGemmaLayout ? { systemInstruction: systemPrompt } : {}),
  generationConfig: {
    temperature: 0.4,      // deterministic enough for structured evaluation
    maxOutputTokens: 8192, // full 7-block evaluation
  },
});

let evaluationText;
try {
  const result = useGemmaLayout
    ? await model.generateContent(`JOB DESCRIPTION TO EVALUATE:\n\n${jdText}`)
    : await model.generateContent([
        { text: systemPrompt },
        { text: `\n\nJOB DESCRIPTION TO EVALUATE:\n\n${jdText}` },
      ]);
  evaluationText = result.response.text();
} catch (err) {
  console.error('❌  Gemini API error:', err.message);
  if (err.message?.includes('API_KEY')) {
    console.error('    Check your GEMINI_API_KEY in .env');
  } else if (err.message?.includes('quota') || err.message?.includes('rate')) {
    console.error('    You may have hit the free-tier rate limit. Wait 60s and retry.');
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Display evaluation
// ---------------------------------------------------------------------------
console.log('\n' + '═'.repeat(66));
console.log('  CAREER-OPS EVALUATION — powered by Google Gemini');
console.log('═'.repeat(66) + '\n');
console.log(evaluationText);

// ---------------------------------------------------------------------------
// Parse score summary
// ---------------------------------------------------------------------------
function extractScoreSummaryBlock(text) {
  const strict = text.match(
    /---SCORE_SUMMARY---\s*([\s\S]*?)---END_SUMMARY---/
  );
  if (strict) return strict[1];
  // Gemma (and some models) omit exact delimiters; accept a loose block.
  const loose = text.match(
    /\bSCORE_SUMMARY\b\s*([\s\S]*?)\bEND_SUMMARY\b/i
  );
  return loose ? loose[1] : null;
}

const summaryBlock = extractScoreSummaryBlock(evaluationText);

let company    = 'unknown';
let role       = 'unknown';
let score      = '?';
let archetype  = 'unknown';
let legitimacy = 'unknown';

if (summaryBlock) {
  const block = summaryBlock;
  const extract = (key) => {
    const m = block.match(new RegExp(`${key}:\\s*(.+)`));
    return m ? m[1].trim() : 'unknown';
  };
  company    = extract('COMPANY');
  role       = extract('ROLE');
  score      = extract('SCORE');
  archetype  = extract('ARCHETYPE');
  legitimacy = extract('LEGITIMACY');
}

// ---------------------------------------------------------------------------
// Save report
// ---------------------------------------------------------------------------
if (saveReport) {
  try {
    if (!existsSync(PATHS.reports)) {
      mkdirSync(PATHS.reports, { recursive: true });
    }

    const num         = nextReportNumber();
    const today       = new Date().toISOString().split('T')[0];
    const companySlug = company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const filename    = `${num}-${companySlug}-${today}.md`;
    const reportPath  = join(PATHS.reports, filename);

    const reportContent = `# Evaluation: ${company} — ${role}

**Date:** ${today}
**Archetype:** ${archetype}
**Score:** ${score}/5
**Legitimacy:** ${legitimacy}
**PDF:** pending
**Tool:** Gemini (${modelName})

---

${evaluationText
      .replace(/---SCORE_SUMMARY---[\s\S]*?---END_SUMMARY---/, '')
      .replace(/\bSCORE_SUMMARY\b[\s\S]*?\bEND_SUMMARY\b/gi, '')
      .trim()}
`;

    writeFileSync(reportPath, reportContent, 'utf-8');
    console.log(`\n✅  Report saved: reports/${filename}`);

    // Append tracker entry reminder
    console.log(`\n📊  Tracker entry (add to data/applications.md):`);
    console.log(`    | ${num} | ${today} | ${company} | ${role} | ${score} | Evaluada | ❌ | [${num}](reports/${filename}) |`);
  } catch (err) {
    console.warn(`⚠️   Could not save report: ${err.message}`);
  }
}

console.log('\n' + '─'.repeat(66));
console.log(`  Score: ${score}/5  |  Archetype: ${archetype}  |  Legitimacy: ${legitimacy}`);
console.log('─'.repeat(66) + '\n');
