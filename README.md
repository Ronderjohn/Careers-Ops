# Career-Ops

<p align="center">
  <img src="docs/hero-banner.jpg" alt="Career-Ops — AI-assisted job search" width="800">
</p>

<p align="center">
  <strong>Evaluate roles against your CV, tailor ATS PDFs, scan boards, and track applications</strong> — with Claude Code, Gemini CLI, or headless Node scripts.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code-000?style=flat&logo=anthropic&logoColor=white" alt="Claude Code">
  <img src="https://img.shields.io/badge/OpenCode-111827?style=flat&logo=terminal&logoColor=white" alt="OpenCode">
  <img src="https://img.shields.io/badge/Gemini_CLI-4285F4?style=flat&logo=google&logoColor=white" alt="Gemini CLI">
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js">
  <img src="https://img.shields.io/badge/Go-00ADD8?style=flat&logo=go&logoColor=white" alt="Go">
  <img src="https://img.shields.io/badge/Playwright-2EAD33?style=flat&logo=playwright&logoColor=white" alt="Playwright">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT">
</p>

---

<p align="center">
  <img src="docs/demo.gif" alt="Career-Ops demo" width="800">
</p>

## What this is

Career-Ops is a **local** toolkit that turns an AI coding environment into a job-search workspace:

- **Evaluates offers** using structured blocks (role fit, CV match, level, comp notes, interview prep, legitimacy).
- **Generates tailored ATS PDFs** from your CV and the job description (Playwright + HTML template; optional second Gemini pass in the Node pipeline).
- **Scans portals** (Greenhouse, Ashby, Lever APIs where available).
- **Tracks applications** in `data/applications.md` with merge helpers and integrity scripts.

> **Not spray-and-pray.** Use scores and notes as a filter; review anything before you apply. The defaults discourage chasing roles below ~4.0/5 fit.

Early runs improve as you add context (`cv.md`, `config/profile.yml`, optional `modes/_profile.md` and proof points).

## Features

| Feature | Description |
|---------|-------------|
| **Auto-pipeline** | Paste a URL or JD → evaluation + (optional) PDF + tracker row |
| **Structured evaluation** | Role summary, CV match, strategy, comp estimates, personalization, STAR-style prep |
| **ATS PDF** | Keyword-aware layout (Space Grotesk + DM Sans), `generate-pdf.mjs` |
| **Portal scanner** | `scan.mjs` + `portals.yml` (copy from `templates/portals.example.yml`) |
| **Batch / dashboard** | Batch runner prompt, Go TUI under `dashboard/` |
| **Human-in-the-loop** | Nothing submits an application for you — you approve every send |

## Quick start

```bash
git clone <your-repo-url>
cd Career-Ops && npm install
npx playwright install chromium   # needed for PDF generation

npm run doctor

cp config/profile.example.yml config/profile.yml   # edit with your details
cp templates/portals.example.yml portals.yml      # optional: scanner targets

# Add cv.md (markdown) in the repo root

# Optional: open Claude Code or Gemini CLI in this directory and use /career-ops
```

See [docs/SETUP.md](docs/SETUP.md) for a fuller setup walkthrough.

## Gemini CLI

Install [Gemini CLI](https://github.com/google-gemini/gemini-cli), run `gemini auth`, then from this repo:

```bash
gemini
/career-ops
/career-ops-evaluate --file ./jds/example.txt
/career-ops-scan
/career-ops-pdf
/career-ops-tracker
```

Slash commands live in `.gemini/commands/*.toml`; context loads from `GEMINI.md`.

## Node API path (no Gemini CLI install)

```bash
cp .env.example .env
# set GEMINI_API_KEY

npm install
node gemini-eval.mjs --file ./jds/my-job.txt
npm run gemini:eval -- "JD text…"
```

Evaluations follow **`modes/gemini-eval-oferta-en.md`** (English reports under `reports/` by default).

> **Quotas:** tune `GEMINI_EVAL_MODEL` / `GEMINI_MODEL` in `.env`; use `npm run gemini:pipeline` with a small `--limit` and `GEMINI_PIPELINE_SLEEP_MS` if you hit rate limits.

### Node “full pipeline” (eval + tracker + optional PDF)

Headless equivalent of **report + tracker (+ PDF)**. Needs `GEMINI_API_KEY`, `cv.md`, `config/profile.yml`, `fonts/`, and Playwright Chromium (`npm run doctor`).

| Goal | Command |
|------|---------|
| First pending URL in `data/pipeline.md`: eval + inbox + merge tracker | `npm run gemini:pipeline -- --limit 1` |
| Same + tailored PDF under `output/` | `npm run gemini:pipeline:full -- --limit 1` |
| Single URL (no inbox edit) | `npm run gemini:pipeline:spawn -- --url "https://…" --company "Co" --title "Role"` — add `--full` for PDF |
| Skip tracker merge | `--no-merge-tracker` or `GEMINI_PIPELINE_NO_MERGE=1` |
| SPA / Oracle (fetch fails) | `--jd-file jds/pasted.md` with `--url` |

**PDF model:** optional `GEMINI_PDF_MODEL` (e.g. `gemini-2.0-flash`) in `.env` — see `.env.example`.

**Windows paths with apostrophes:** map a drive (`subst Z: "…\Career-Ops"`) or run `npm run gemini:pipeline:spawn -- …` from a clean cwd.

## Slash commands (Claude / Gemini / OpenCode)

```
/career-ops                → list commands
/career-ops {paste JD/URL} → full auto-pipeline (agent-driven)
/career-ops scan           → portal scan
/career-ops pdf            → ATS CV PDF
/career-ops batch          → batch evaluate
/career-ops tracker        → application status
/career-ops apply          → draft application answers (review before submit)
/career-ops pipeline       → process pending URLs
/career-ops contacto       → LinkedIn outreach draft
/career-ops deep           → company research
/career-ops training       → course / cert evaluation
/career-ops project        → portfolio project evaluation
```

## How it works

```
Job URL or JD text
        │
        ▼
┌──────────────────┐
│ Archetype / role │
│ framing          │
└────────┬─────────┘
         │
┌────────▼─────────┐
│ Evaluation       │  (reads cv.md + modes)
│ (A–G blocks)     │
└────────┬─────────┘
         │
    ┌────┼────┐
    ▼    ▼    ▼
 Report  PDF  Tracker
 .md    .pdf  (data/applications.md + TSV merge)
```

## Pre-configured portals

Copy `templates/portals.example.yml` → `portals.yml`. The template lists sample companies and board search patterns (AI labs, voice, automation, etc.). Edit `title_filter` and companies for your targets.

## Dashboard (Go TUI)

```bash
cd dashboard
go build -o career-dashboard .
./career-dashboard --path ..
```

## Project layout

```
Career-Ops/
├── CLAUDE.md / GEMINI.md     # Agent context
├── cv.md                     # Your CV (you create)
├── gemini-eval.mjs           # API evaluation
├── gemini-pipeline.mjs       # Inbox + eval + optional PDF + tracker merge
├── gemini-tailor-html-pdf.mjs
├── generate-pdf.mjs
├── merge-tracker.mjs
├── scan.mjs
├── config/profile.example.yml
├── modes/                    # Evaluation, PDF, scan, pipeline modes
├── templates/                # CV HTML, portals example, states
├── batch/                    # Tracker TSV queue + batch prompt
├── dashboard/                # Go TUI
├── data/                     # applications, pipeline (usually gitignored)
├── reports/                  # Eval reports (usually gitignored)
├── output/                   # PDFs (usually gitignored)
└── docs/
```

## Tech stack

- **Agents:** Claude Code / Gemini CLI / OpenCode with repo-local modes  
- **PDF:** Playwright + `templates/cv-template.html`  
- **Scanner:** Node + Greenhouse / Ashby / Lever HTTP APIs  
- **Dashboard:** Go + Bubble Tea  

## Disclaimer

**Career-Ops is local open-source software, not a hosted service.**

1. **Your data stays on your machine** (unless you choose to send it to an AI provider).  
2. **You review all outputs** before applications or outreach; models can be wrong.  
3. **Respect each portal’s terms** — no spam or abuse.  
4. **No employment guarantees** — scores are guidance, not fact.

See [LEGAL_DISCLAIMER.md](LEGAL_DISCLAIMER.md) and [LICENSE](LICENSE).
