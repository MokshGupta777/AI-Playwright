# Playwright Clean Architecture Framework

Playwright + TypeScript automation framework using clean architecture, page objects, flows, fixtures, assertions, environment-based config, and GitHub Actions CI.

## Tech Stack

- Playwright
- TypeScript
- GitHub Actions

## Framework Highlights

- Clean folder structure
- Page Object Model
- Flow layer for reusable business actions
- Fixtures for test setup
- Assertions layer
- Environment-based configuration
- CI-ready with GitHub Actions

## Run Locally

```bash
npm install
npx playwright install
npm run test:ui

## Reports

This framework generates:
- Playwright HTML Report
- Allure Report

Both reports are uploaded as GitHub Actions artifacts after every workflow run.

## AI-Driven Testing (Playwright MCP)

On top of the deterministic Page Object suite above, this repo has a second,
AI-driven test layer under `src/ai/`, `scripts/`, and `tests/ai/specs/`.

**How it works:** each test is a plain-English spec (`tests/ai/specs/*.ai.json`)
— a title, ordered steps, and a success criterion. At runtime, Claude is
handed the real Playwright MCP browser tools (navigate, click, type,
snapshot, etc.) and decides, step by step, what to actually do in a live
browser. There are no selectors baked into the spec — the model finds
elements itself from what it currently sees on the page.

```bash
npm run test:ai              # execute every spec in tests/ai/specs/
npm run generate:ai-tests     # explore the app live and propose new specs
```

Required env var beyond the existing ones: `ANTHROPIC_API_KEY`.

**Two GitHub Actions workflows:**
- `ai-test-generation.yml` — runs weekly (and on demand), has Claude explore
  the app through the MCP browser tools, and opens a PR with any new
  `*.ai.json` specs it proposes. Nothing lands on `main` without review.
- `ai-test-execution.yml` — runs the existing specs on PRs and nightly,
  uploads full transcripts/results as an artifact. It runs with
  `continue-on-error: true` — see the trade-off below.

**Why this is *not* a replacement for the Page Object suite, and why the
execution job doesn't block merges by default:**
- Each run makes real, non-deterministic LLM calls — the same spec can pass
  today and take a different (or wrong) path tomorrow.
- It's slower and has a real per-run API cost, unlike the free, ~seconds-long
  selector-based tests.
- If it fails, the transcript in `ai-test-results/` tells you what the agent
  actually saw and clicked — useful for catching drift or exploring unknown
  areas of the app, but it's evidence for a human to read, not a hard gate.

A sensible split: keep the Page Object suite (`tests/ui/`) as your real CI
gate, and use the AI layer for exploratory coverage and for discovering new
flows worth turning into proper deterministic tests later.

Set `AI_TESTS_BLOCKING=true` in the workflow env if you'd rather have the
execution job fail the check run when an AI test fails.