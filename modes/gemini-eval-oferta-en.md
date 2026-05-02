# Mode: offer evaluation (A–G) — English output for `gemini-eval.mjs`

When the candidate provides a job description (text or URL-derived text), deliver **all seven blocks (A–G)**. **Write every block, table, header, and narrative in English** (US professional tone). If the JD is not in English, you may quote short phrases from the JD in the original language inside quotation marks; all analysis stays in English.

## Step 0 — Archetype detection

Classify the role into one of the six archetypes (see `_shared.md`). If hybrid, name the two closest. This drives proof points in B, rewrite focus in E, and STAR stories in F.

## Block A — Role summary

Table with: detected archetype, domain, function (build/consult/manage/deploy), seniority, remote (full/hybrid/onsite), team size if stated, one-sentence TL;DR.

## Block B — CV match

Read `cv.md`. Table mapping each JD requirement to **exact CV lines** where possible.

**Archetype-specific emphasis:** (same logic as main oferta: FDE → delivery + client-facing; SA → systems + integrations; PM → discovery + metrics; LLMOps → evals, observability, pipelines; Agentic → multi-agent, HITL, orchestration; Transformation → adoption + scaling.)

**Gaps:** For each gap: hard blocker vs nice-to-have, adjacent experience, portfolio mitigation, concrete mitigation (cover-letter line, small project, etc.).

## Block C — Level and strategy

1. Level implied by JD vs natural level for this archetype  
2. “Sell senior without lying”: specific phrases, concrete wins, founder experience as leverage  
3. If down-leveled: accept if comp is fair, negotiate 6-month review, clear promotion criteria  

## Block D — Compensation and demand

You do **not** have WebSearch in this CLI session. Give **clearly labeled estimates** from general market knowledge for this role, geography, and seniority. Short table is fine; say when data is thin.

## Block E — Personalization plan

| # | Section | Current state | Proposed change | Why |
|---|---------|---------------|-----------------|-----|

Top 5 CV tweaks + Top 5 LinkedIn tweaks to maximize match.

## Block F — Interview plan

6–10 STAR+R stories mapped to JD requirements:

| # | JD requirement | STAR+R story | S | T | A | R | Reflection |

**Reflection** = lesson learned or what you would do differently (signals seniority).

**Story bank:** If `interview-prep/story-bank.md` exists, note whether stories should be appended (the host script may not write files; still recommend additions in text).

Pick stories by archetype (FDE → speed + client-facing; SA → architecture; PM → discovery + trade-offs; LLMOps → metrics + production; Agentic → orchestration + errors + HITL; Transformation → adoption).

Include: one recommended case study to lead with; red-flag questions and how to answer them.

## Block G — Posting legitimacy

Assess whether the posting looks like a real, active opening. **Ethical framing:** observations, not accusations.

Use **only the JD text** provided (no live URL checks in this session).

### Signals (in order)

1. **Posting freshness** — Note if dates or “rolling hire” appear in the text; otherwise “unknown from text alone”.  
2. **Description quality** — Specific tech, team context, realistic requirements, contradictions, salary mention, boilerplate ratio.  
3. **Company hiring signals** — Qualitative only unless evidence appears in the JD text.  
4. **Reposting** — Unknown without external data; skip or say N/A.  
5. **Role–market fit** — Does the role make sense for the company/stage described?

### Output format

**Assessment:** High Confidence | Proceed with Caution | Suspicious  

**Signals table:** each signal, finding, weight (Positive / Neutral / Concerning).  

**Context notes:** caveats (evergreen, niche role, etc.).

Edge cases: government/academic longer timelines; evergreen postings; niche/executive roles; vague startup JDs; no date → default Proceed with Caution with note; never Suspicious without evidence.

---

## After blocks A–G

### Keywords for ATS

List 15–20 keywords from the JD for ATS optimization.

### Machine-readable summary (required)

End with **exactly**:

---SCORE_SUMMARY---
COMPANY: <name or Unknown>
ROLE: <title>
SCORE: <decimal e.g. 3.8>
ARCHETYPE: <archetype>
LEGITIMACY: <High Confidence | Proceed with Caution | Suspicious>
---END_SUMMARY---
