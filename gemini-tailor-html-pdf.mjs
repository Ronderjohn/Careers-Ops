#!/usr/bin/env node
/**
 * gemini-tailor-html-pdf.mjs — One-shot: JD + cv.md → tailored HTML → ATS PDF (Playwright).
 * Used by gemini-pipeline.mjs --full. Heavier than eval alone; needs GEMINI_API_KEY + Playwright.
 *
 * Usage:
 *   node gemini-tailor-html-pdf.mjs --jd-file <path> --company "Acme" --role "Engineer" [--out-pdf output/cv-x.pdf]
 *
 * Model: GEMINI_PDF_MODEL > GEMINI_MODEL > gemini-2.0-flash
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import yaml from 'js-yaml';
import { GoogleGenerativeAI } from '@google/generative-ai';

const ROOT = dirname(fileURLToPath(import.meta.url));

try {
  const { config } = await import('dotenv');
  config({ path: join(ROOT, '.env') });
} catch {
  /* optional */
}

function slug(s) {
  return String(s || 'company')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'company';
}

function inferPageFormat(profile) {
  const loc = (profile?.candidate?.location || '').toLowerCase();
  if (/\b(united states|usa|u\.s\.|canada)\b/i.test(loc)) return 'letter';
  return 'a4';
}

function extractHtml(raw) {
  let t = String(raw).trim();
  const fence = t.match(/```(?:html)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  if (!/<html[\s>]/i.test(t) && !/<!DOCTYPE/i.test(t)) return null;
  return t;
}

function parseArgs() {
  const a = process.argv.slice(2);
  const j = a.indexOf('--jd-file');
  const c = a.indexOf('--company');
  const r = a.indexOf('--role');
  const o = a.indexOf('--out-pdf');
  if (j === -1 || !a[j + 1]) {
    console.error('Usage: node gemini-tailor-html-pdf.mjs --jd-file <path> --company "Co" --role "Title" [--out-pdf output/x.pdf]');
    process.exit(1);
  }
  let jdPath = a[j + 1].trim();
  jdPath = isAbsolute(jdPath) ? jdPath : resolve(ROOT, jdPath);
  const company = c !== -1 && a[c + 1] ? a[c + 1].trim() : 'Company';
  const role = r !== -1 && a[r + 1] ? a[r + 1].trim() : 'Role';
  let outPdf = o !== -1 && a[o + 1] ? a[o + 1].trim() : null;
  if (outPdf && !isAbsolute(outPdf)) outPdf = resolve(ROOT, outPdf);
  return { jdPath, company, role, outPdf };
}

const { jdPath, company, role, outPdf: outPdfArg } = parseArgs();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('Missing GEMINI_API_KEY in .env');
  process.exit(1);
}

if (!existsSync(jdPath)) {
  console.error(`JD file not found: ${jdPath}`);
  process.exit(1);
}

const cvPath = join(ROOT, 'cv.md');
const templatePath = join(ROOT, 'templates', 'cv-template.html');
const pdfModePath = join(ROOT, 'modes', 'pdf.md');
if (!existsSync(cvPath) || !existsSync(templatePath)) {
  console.error('Requires cv.md and templates/cv-template.html in repo root.');
  process.exit(1);
}

let profile = {};
const profFile = join(ROOT, 'config', 'profile.yml');
if (existsSync(profFile)) {
  try {
    profile = yaml.load(readFileSync(profFile, 'utf-8')) || {};
  } catch (e) {
    console.warn('profile.yml parse warning:', e.message);
  }
}

const candidateName = profile?.candidate?.full_name || 'Candidate';
const candSlug = slug(candidateName);
const coSlug = slug(company);
const today = new Date().toISOString().slice(0, 10);
const pageFmt = inferPageFormat(profile);

const jdText = readFileSync(jdPath, 'utf-8').slice(0, 45_000);
const cvText = readFileSync(cvPath, 'utf-8').slice(0, 28_000);
const template = readFileSync(templatePath, 'utf-8');
const pdfRules = existsSync(pdfModePath)
  ? readFileSync(pdfModePath, 'utf-8').slice(0, 10_000)
  : '';

const modelName =
  process.env.GEMINI_PDF_MODEL ||
  process.env.GEMINI_MODEL ||
  'gemini-2.0-flash';

const systemInstruction = `You are career-ops CV tailoring for ATS PDF export.
Output ONE complete HTML document only (no markdown, no commentary before or after).
Rules:
- Preserve the same document structure, linked fonts, and CSS approach as the provided TEMPLATE (Space Grotesk + DM Sans, single-column, semantic sections).
- Never invent employers, degrees, dates, or skills not present in the CV markdown.
- Rewrite summary and reorder/emphasize bullets to align with the job description keywords where truthfully supported by the CV.
- Fill every major section from the CV; use the TEMPLATE as layout shell.
- Start with <!DOCTYPE html> or <html`;

const userBlob = `TEMPLATE (replicate layout and class names; replace body content with tailored content from CV):\n${template}\n\n---\nPDF MODE RULES (excerpt):\n${pdfRules}\n\n---\nCV (markdown):\n${cvText}\n\n---\nJOB DESCRIPTION / CONTEXT:\n${jdText}\n\n---\nTarget role title for header context: ${role} at ${company}.\nCandidate display name: ${candidateName}.\nPage format hint: ${pageFmt}.\n`;

console.log(`\n📄  Tailoring HTML for PDF via ${modelName} (this can take 1–3 minutes)…\n`);

const genAI = new GoogleGenerativeAI(apiKey);
const useGemma = /^gemma-/i.test(modelName);
const model = genAI.getGenerativeModel({
  model: modelName,
  ...(useGemma ? { systemInstruction } : {}),
  generationConfig: {
    temperature: 0.35,
    maxOutputTokens: 24_576,
  },
});

let html;
try {
  const result = useGemma
    ? await model.generateContent(userBlob)
    : await model.generateContent([
        { text: systemInstruction },
        { text: userBlob },
      ]);
  html = extractHtml(result.response.text());
} catch (e) {
  console.error('Gemini tailoring failed:', e.message);
  process.exit(1);
}

if (!html) {
  console.error('Model did not return valid HTML.');
  process.exit(1);
}

mkdirSync(join(ROOT, '.cache'), { recursive: true });
const htmlTmp = join(ROOT, '.cache', `cv-tailored-${Date.now()}.html`);
writeFileSync(htmlTmp, html, 'utf-8');

const pdfOut =
  outPdfArg || join(ROOT, 'output', `cv-${candSlug}-${coSlug}-${today}.pdf`);
mkdirSync(dirname(pdfOut), { recursive: true });

const gp = spawnSync(
  process.execPath,
  ['generate-pdf.mjs', htmlTmp, pdfOut, `--format=${pageFmt}`],
  {
    cwd: ROOT,
    encoding: 'utf-8',
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  }
);
try {
  unlinkSync(htmlTmp);
} catch {
  /* ignore */
}

if (gp.status !== 0) {
  console.error(gp.stderr || gp.stdout || 'generate-pdf.mjs failed');
  process.exit(1);
}

const rel = pdfOut.startsWith(ROOT + '\\') || pdfOut.startsWith(ROOT + '/')
  ? pdfOut.slice(ROOT.length + 1).replace(/\\/g, '/')
  : pdfOut;
console.log(`\n✅  PDF ready: ${rel}\n`);
console.log(`PDF_PATH:${pdfOut}`);
process.exit(0);
