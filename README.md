# Tea Tax - Thesis and Build Hub

This repository is the source of truth for Tea Tax strategy, research, and execution.

## Start Here - Core Thesis

- Read `THESIS.md` first for the quickest entry point.
- Full working document: `docs/vision/tea-tax-thesis.md`
- Reference logs (optional background): `docs/vision/tea-tax-thesis-chat-transcript.md` and `docs/vision/tea-tax-thesis-review-session.md`

## Purpose

- Keep thesis, strategy, research, and product concepts in one place.
- Keep organizational visibility into the latest thinking and decisions.
- Keep planning and implementation aligned across all workstreams.

## How to Use This Repo

- Start with the thesis in `THESIS.md` and then go deeper in `docs/vision`.
- Read `docs/strategy` for go-to-market and distribution thinking.
- Use `docs/research` for supporting tax and regulatory research.
- Review `docs/product-concepts` for concept blueprints and scoped plans.
- Use `docs/requirements/current-priorities.md` as the current working focus.
- Use `docs/requirements/users-tax-objects-ownership-access-spec.md` for launch data model and access rules.

## Current Structure

- `docs/vision` - thesis and thesis review materials
- `docs/strategy` - distribution and strategic planning docs
- `docs/research/irs-circular-230` - Circular 230 notes plus source materials
- `docs/product-concepts/calypso-blueprint` - concept blueprint and feature/userflow docs
- `docs/product-concepts/superuman-cpa` - related concept design and planning artifacts

## Collaboration Notes

- Keep key decisions documented as markdown files.
- Prefer small, frequent updates so documentation stays current.
- If a doc changes expected behavior or scope, call it out in the commit message.

## Safe Commit Command

- This repo includes `scripts/commit-safe.sh` to force anonymized author and committer identity.
- To use `git safe-commit` without editing git config, add the repo bin folder to PATH in your shell session:
  - `export PATH="$PWD/bin:$PATH"`
- Then run:
  - `git safe-commit "Docs: your message" [optional paths...]`
