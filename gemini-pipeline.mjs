#!/usr/bin/env node
/**
 * gemini-pipeline.mjs — Process pending URLs in data/pipeline.md via gemini-eval.mjs
 *
 * Fetches JD text (Greenhouse / Ashby / Lever JSON APIs when possible; else HTML strip),
 * runs node gemini-eval.mjs --file, then moves the checkbox line to ## Procesadas.
 *
 * Usage:
 *   node gemini-pipeline.mjs [--limit N] [--dry-run]
 *   node gemini-pipeline.mjs --url "<job-url>" [--company "Name"] [--title "Role"]
 *     (evaluates one URL; appends to ## Procesadas without matching a Pendientes line)
 *   node gemini-pipeline.mjs --url "<job-url>" --jd-file jds/pasted.md [--company …] [--title …]
 *     (Oracle / SPA sites: skip fetch; use local JD text; --jd-file requires --url)
 *   node gemini-pipeline.mjs --full …   (after eval: tailored HTML+PDF via gemini-tailor-html-pdf.mjs, then tracker merge)
 *   node gemini-pipeline.mjs --no-merge-tracker …  (skip batch/tracker-additions + merge-tracker.mjs)
 *
 * Env (optional):
 *   GEMINI_PIPELINE_LIMIT   — default batch size when --limit omitted (default: 5)
 *   GEMINI_PIPELINE_SLEEP_MS — pause between successful evals in ms (default: 2500; 0 to disable)
 *
 * Windows: if your repo path contains an apostrophe and the shell breaks, map a drive letter:
 *   subst Z: "C:\\Users\\you\\...\\Career-Ops"
 *   Z: && node gemini-pipeline.mjs --url "https://..."
 *   subst /d Z:
 * Or: npm run gemini:pipeline:spawn -- --url "https://..."
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));

try {
  const { config } = await import('dotenv');
  config({ path: join(ROOT, '.env') });
} catch { /* optional */ }
const PIPELINE_PATH = join(ROOT, 'data', 'pipeline.md');
const APPLICATIONS_PATH = join(ROOT, 'data', 'applications.md');
const TRACKER_ADDITIONS_DIR = join(ROOT, 'batch', 'tracker-additions');
const CACHE_DIR = join(ROOT, '.cache');
const FETCH_TIMEOUT_MS = 15_000;
/** Ashby board JSON can be very large (e.g. OpenAI); allow slow downloads. */
const ASHBY_BOARD_FETCH_TIMEOUT_MS = 120_000;
/** Must match gemini-eval.mjs resolution: GEMINI_EVAL_MODEL > GEMINI_MODEL > default */
const DEFAULT_EVAL_MODEL = 'gemma-4-26b-a4b-it';

function ensurePipelineTemplate() {
  if (existsSync(PIPELINE_PATH)) return;
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  writeFileSync(
    PIPELINE_PATH,
    `# Job URL inbox (Career-Ops)

## Pendientes

## Procesadas

`,
    'utf-8'
  );
}

function stripHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchWithTimeout(url, init = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        ...(init.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

async function fetchJdText(url) {
  const gh = url.match(
    /(?:job-boards(?:\.eu)?|boards)\.greenhouse\.io\/([^/]+)\/jobs\/(\d+)/i
  );
  if (gh) {
    const token = gh[1];
    const id = gh[2];
    const apiUrl = `https://boards-api.greenhouse.io/v1/boards/${token}/jobs/${id}`;
    const res = await fetchWithTimeout(apiUrl);
    if (!res.ok) throw new Error(`Greenhouse API HTTP ${res.status}`);
    const j = await res.json();
    const title = j.title || '';
    const company = (j.company && j.company.name) || j.company_name || token;
    const body = stripHtml(j.content || j.content_rendered || '');
    return `Title: ${title}\nCompany: ${company}\nURL: ${url}\n\n${body}`.slice(0, 120_000);
  }

  const ashby = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)\/([0-9a-f-]{36})/i);
  if (ashby) {
    const boardSlug = ashby[1];
    const postingId = ashby[2].toLowerCase();
    const apiUrl = `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(
      boardSlug
    )}?includeCompensation=false`;
    const res = await fetchWithTimeout(apiUrl, {}, ASHBY_BOARD_FETCH_TIMEOUT_MS);
    if (!res.ok) throw new Error(`Ashby job board API HTTP ${res.status}`);
    const j = await res.json();
    const jobs = j.jobs || [];
    const job = jobs.find(
      (x) =>
        String(x.id || '').toLowerCase() === postingId ||
        String(x.jobUrl || '')
          .toLowerCase()
          .includes(postingId)
    );
    if (!job) {
      throw new Error(`Ashby posting ${postingId} not found on board ${boardSlug}`);
    }
    const title = job.title || '';
    const body =
      (typeof job.descriptionPlain === 'string' && job.descriptionPlain.trim()) ||
      stripHtml(job.descriptionHtml || '');
    if (body.length < 50) {
      throw new Error('Ashby job had very little description text');
    }
    return `Title: ${title}\nCompany: ${boardSlug}\nURL: ${url}\n\n${body}`.slice(0, 120_000);
  }

  const lever = url.match(/jobs\.lever\.co\/([^/]+)\/([^/?#]+)/i);
  if (lever) {
    const company = lever[1];
    const postingId = lever[2];
    const apiUrl = `https://api.lever.co/v0/postings/${company}/${postingId}`;
    const res = await fetchWithTimeout(apiUrl);
    if (!res.ok) throw new Error(`Lever API HTTP ${res.status}`);
    const j = await res.json();
    const title = j.text || '';
    const host = j.host || company;
    const desc =
      j.descriptionPlain || stripHtml(j.description || '') || stripHtml(j.lists || '');
    return `Title: ${title}\nCompany: ${host}\nURL: ${url}\n\n${desc}`.slice(0, 120_000);
  }

  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const text = stripHtml(html);
  if (text.length < 200) throw new Error('Fetched page had very little text (login wall?)');
  return `URL: ${url}\n\n${text}`.slice(0, 120_000);
}

function parsePendingLines(content) {
  const lines = [];
  const re = /^- \[ \]\s+(https?:\/\/\S+)(?:\s*\|\s*([^|]*?)\s*\|\s*(.*))?$/;
  for (const line of content.split('\n')) {
    const m = line.match(re);
    if (m) {
      lines.push({
        fullLine: line,
        url: m[1].replace(/[)\],.]+$/, ''),
        company: (m[2] || '').trim(),
        title: (m[3] || '').trim(),
      });
    }
  }
  return lines;
}

function moveLineToProcesadas(content, oldLine, newLine) {
  const without = content.split('\n').filter((l) => l !== oldLine).join('\n');
  return appendUnderProcesadas(without, newLine);
}

/** Insert a processed checkbox line under ## Procesadas (no removal). */
function appendUnderProcesadas(content, newLine) {
  const marker = '## Procesadas';
  const idx = content.indexOf(marker);
  if (idx === -1) {
    return `${content.trimEnd()}\n\n${marker}\n\n${newLine}\n`;
  }
  const after = idx + marker.length;
  const insertAt = content.indexOf('\n', after);
  const pos = insertAt === -1 ? after : insertAt + 1;
  return content.slice(0, pos) + `${newLine}\n` + content.slice(pos);
}

function parseEvalOutput(stdout) {
  const reportM = stdout.match(/Report saved:\s*reports\/(\S+)/);
  const reportFile = reportM ? reportM[1] : null;
  const numM = reportFile?.match(/^(\d{3})-/);
  const reportNum = numM ? numM[1] : '???';
  const scoreM = stdout.match(/Score:\s*([\d.]+|N\/A)\s*\/5/);
  const score = scoreM ? scoreM[1] : '?';
  return { reportFile, reportNum, score };
}

function ensureApplicationsTracker() {
  mkdirSync(join(ROOT, 'data'), { recursive: true });
  if (existsSync(APPLICATIONS_PATH)) return;
  writeFileSync(
    APPLICATIONS_PATH,
    `# Applications Tracker

| # | Date | Company | Role | Score | Status | PDF | Report | Notes |
|---|------|---------|------|-------|--------|-----|--------|-------|
`,
    'utf-8'
  );
  console.log('Created data/applications.md (empty tracker).\n');
}

function formatScoreForTracker(score) {
  const t = String(score ?? '').trim();
  if (!t || t === '?') return 'N/A';
  if (/\/5\s*$/i.test(t)) return t;
  return `${t}/5`;
}

function writeTrackerTsv({
  reportNum,
  reportFile,
  score,
  company,
  role,
  dateStr,
  pdfOk,
}) {
  mkdirSync(TRACKER_ADDITIONS_DIR, { recursive: true });
  const reportCell = reportFile
    ? `[${reportNum}](reports/${reportFile})`
    : `[${reportNum}](reports/)`;
  const line = `${reportNum}\t${dateStr}\t${company}\t${role}\tEvaluated\t${formatScoreForTracker(
    score
  )}\t${pdfOk ? '✅' : '❌'}\t${reportCell}\tgemini-pipeline\n`;
  const fname = `auto-${reportNum}-${Date.now()}.tsv`;
  writeFileSync(join(TRACKER_ADDITIONS_DIR, fname), line, 'utf-8');
  return fname;
}

function parseSingleUrlJob(args) {
  const ui = args.indexOf('--url');
  if (ui === -1 || !args[ui + 1]) return null;
  const url = args[ui + 1].trim();
  let company = 'Unknown';
  let title = 'Job posting';
  const ci = args.indexOf('--company');
  if (ci !== -1 && args[ci + 1]) company = args[ci + 1].trim();
  const ti = args.indexOf('--title');
  if (ti !== -1 && args[ti + 1]) title = args[ti + 1].trim();
  return { fullLine: null, url, company, title };
}

function parseJdFileArg(args) {
  const j = args.indexOf('--jd-file');
  if (j === -1 || !args[j + 1]) return null;
  const raw = args[j + 1].trim();
  return isAbsolute(raw) ? raw : resolve(ROOT, raw);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const runFull = args.includes('--full');
  const mergeTracker =
    !args.includes('--no-merge-tracker') && process.env.GEMINI_PIPELINE_NO_MERGE !== '1';
  const singleJob = parseSingleUrlJob(args);
  const jdFilePath = parseJdFileArg(args);
  if (jdFilePath && !singleJob) {
    console.error('--jd-file requires --url (single-job mode).');
    process.exit(1);
  }
  if (jdFilePath && !existsSync(jdFilePath)) {
    console.error(`JD file not found: ${jdFilePath}`);
    process.exit(1);
  }
  let limit = Math.max(1, parseInt(process.env.GEMINI_PIPELINE_LIMIT || '5', 10) || 5);
  const li = args.indexOf('--limit');
  if (li !== -1 && args[li + 1]) {
    const n = parseInt(args[li + 1], 10);
    if (!Number.isNaN(n)) limit = Math.max(1, n);
  }
  const sleepMs = Math.max(0, parseInt(process.env.GEMINI_PIPELINE_SLEEP_MS || '2500', 10));

  ensurePipelineTemplate();
  if (!existsSync(PIPELINE_PATH)) {
    console.error('No pipeline file at data/pipeline.md');
    process.exit(1);
  }
  if (mergeTracker && !dryRun) {
    ensureApplicationsTracker();
  }

  let content = readFileSync(PIPELINE_PATH, 'utf-8');
  let batch;
  if (singleJob) {
    batch = [singleJob];
    console.log(
      `Single-URL mode (--url)${jdFilePath ? `; JD from ${jdFilePath}` : ''}\n`
    );
  } else {
    const pending = parsePendingLines(content);
    if (pending.length === 0) {
      console.log('No pending URLs (- [ ] lines) in data/pipeline.md. Run npm run scan first.');
      process.exit(0);
    }
    batch = pending.slice(0, limit);
  }
  console.log(
    `Processing ${batch.length} pending URL(s) (limit ${limit})${dryRun ? ' [dry-run]' : ''}` +
      (runFull ? ' [+PDF --full]' : '') +
      (mergeTracker && !dryRun ? ' [+tracker merge]' : '') +
      (sleepMs > 0 && !dryRun ? `; ${sleepMs}ms pause between evals` : '') +
      `\n`
  );

  mkdirSync(CACHE_DIR, { recursive: true });

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i];
    console.log('━'.repeat(60));
    console.log(`URL: ${item.url}`);
    if (item.company) console.log(`     ${item.company} — ${item.title}`);

    let jdText;
    try {
      if (jdFilePath) {
        const body = readFileSync(jdFilePath, 'utf-8').trim();
        if (body.length < 80) {
          throw new Error('JD file is empty or too short (paste full description)');
        }
        jdText = `URL: ${item.url}\n\n${body}`.slice(0, 120_000);
      } else {
        jdText = await fetchJdText(item.url);
      }
    } catch (e) {
      console.error(`  ✗ ${jdFilePath ? 'JD file' : 'Fetch'} failed: ${e.message}\n`);
      continue;
    }

    const tmp = join(CACHE_DIR, `jd-${Date.now()}.txt`);
    writeFileSync(tmp, jdText, 'utf-8');
    let jdForPdf = null;
    if (runFull && !dryRun) {
      jdForPdf = join(CACHE_DIR, `jd-pdf-${Date.now()}.txt`);
      writeFileSync(jdForPdf, jdText, 'utf-8');
    }

    if (dryRun) {
      console.log(`  (dry-run) Would run gemini-eval on ${jdText.length} chars\n`);
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
      if (jdForPdf) {
        try {
          unlinkSync(jdForPdf);
        } catch {
          /* ignore */
        }
      }
      continue;
    }

    const evalModel =
      process.env.GEMINI_EVAL_MODEL ||
      process.env.GEMINI_MODEL ||
      DEFAULT_EVAL_MODEL;
    const r = spawnSync(
      process.execPath,
      ['gemini-eval.mjs', '--model', evalModel, '--file', tmp],
      {
        cwd: ROOT,
        encoding: 'utf-8',
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }

    if (r.status !== 0) {
      console.error(r.stderr || r.stdout || 'gemini-eval failed');
      if (jdForPdf) {
        try {
          unlinkSync(jdForPdf);
        } catch {
          /* ignore */
        }
      }
      continue;
    }

    console.log(r.stdout);
    const { reportFile, reportNum, score } = parseEvalOutput(r.stdout);
    const company = item.company || 'Unknown';
    const title = item.title || 'Role';

    let pdfOk = false;
    if (runFull && jdForPdf) {
      console.log('  → Tailored PDF (gemini-tailor-html-pdf.mjs)…\n');
      const pr = spawnSync(
        process.execPath,
        [
          'gemini-tailor-html-pdf.mjs',
          '--jd-file',
          jdForPdf,
          '--company',
          company,
          '--role',
          title,
        ],
        {
          cwd: ROOT,
          encoding: 'utf-8',
          env: { ...process.env },
          stdio: ['ignore', 'pipe', 'inherit'],
        }
      );
      const out = pr.stdout || '';
      const pathM = out.match(/PDF_PATH:([^\r\n]+)/);
      if (pr.status === 0 && pathM) {
        const abs = pathM[1].trim();
        if (existsSync(abs)) pdfOk = true;
      }
      if (!pdfOk) {
        console.error('  ⚠ PDF step failed or missing output (--full). See logs above.\n');
      }
      try {
        unlinkSync(jdForPdf);
      } catch {
        /* ignore */
      }
    }

    const dateStr = new Date().toISOString().slice(0, 10);
    const pdfLabel = pdfOk ? 'PDF ✅' : 'PDF ❌';
    const processed = `- [x] #${reportNum} | ${item.url} | ${company} | ${title} | ${score}/5 | ${pdfLabel}`;
    content = item.fullLine
      ? moveLineToProcesadas(content, item.fullLine, processed)
      : appendUnderProcesadas(content, processed);
    writeFileSync(PIPELINE_PATH, content, 'utf-8');
    console.log(`  ✓ Pipeline updated (${reportFile || 'report unknown'})\n`);

    if (mergeTracker) {
      const tsvName = writeTrackerTsv({
        reportNum,
        reportFile,
        score,
        company,
        role: title,
        dateStr,
        pdfOk,
      });
      console.log(`  ✓ Tracker TSV queued (${tsvName})\n`);
      const mr = spawnSync(process.execPath, ['merge-tracker.mjs'], {
        cwd: ROOT,
        encoding: 'utf-8',
        env: { ...process.env },
        stdio: 'inherit',
      });
      if (mr.status !== 0) {
        console.error('  ⚠ merge-tracker.mjs exited non-zero; fix data/applications.md or TSV and run: node merge-tracker.mjs\n');
      }
    }

    if (sleepMs > 0 && i < batch.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, sleepMs));
    }
  }

  console.log(
    'Done. Review reports/, output/*.pdf (if --full), and data/applications.md after merge.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
