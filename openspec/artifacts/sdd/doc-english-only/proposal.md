# SDD Proposal: doc-english-only

**Change ID:** `doc-english-only`  
**Author:** Rodrigo Peralta  
**Date:** 2026-05-30  
**Status:** Proposed

---

## 1. Problem Statement

`extensions/stack-detector.ts` contains mixed-language code comments:
- Spanish section headers: `// ─── Detección de stack ───`
- Spanish inline comments: `// Mínimo de downloads para considerar...`
- Spanish logic comments: `// config inválido — ignorar`

The codebase is a Pi extension package published to npm. Code reviewers, contributors, and AI agents from other locales will encounter this mixed content. English-only code comments are a standard convention in professional TypeScript projects.

This rule also applies to all `.ts` files in `extensions/`, `skills/`, and any new code added to the project.

---

## 2. Scope

### What changes
- All `//` single-line comments in `extensions/stack-detector.ts`
- Section header comments (`// ─── ... ───`) → English
- Inline JSDoc comments in `extensions/types/*.ts`
- Any future code added to the repository

### What doesn't change
- **SDD artifacts** (proposal, spec, design, tasks) → may follow project language
- **User-facing output** (strings displayed to user by `ctx.ui.notify`) → keep Spanish for natural UX
- **SKILL.md files** → follow agentskills.io convention (English)
- **README.md, AGENTS.md** → English (already English)
- **Variable/function names** → keep as-is (they're identifiers, not comments)

---

## 3. Goals and Non-Goals

### Goals
- All code comments in English
- Section headers in English
- JSDoc descriptions in English
- No mixed-language comments in `.ts` files

### Non-Goals
- Rename variables or functions (that's a separate refactor)
- Change user-facing strings (those stay Spanish)
- Update SDD artifacts to English
- Refactor logic or add tests (separate changes)

---

## 4. Acceptance Criteria

- [ ] `extensions/stack-detector.ts`: all `//` comments converted to English
- [ ] `extensions/types/*.ts`: all JSDoc `@see`/`@description` comments in English
- [ ] Section headers: `// ─── Detection ───` not `// ─── Detección ───`
- [ ] No Spanish words in code comments (allowed: technical terms like "config", "lockfile")
- [ ] User-facing strings in `ctx.ui.notify` remain Spanish
- [ ] `npx tsc --noEmit` passes after changes

---

## 5. Implementation Approach

### Manual approach (this change)
Scan `extensions/stack-detector.ts` and `extensions/types/*.ts` for non-English comments and translate them inline.

### Automated enforcement (future)
Add `@eslint-plugin/eslint-comments` rule or custom ESLint rule:
```yaml
# .eslintrc or eslint.config.js
rules:
  eslint-comments/no-untranslated: error
```

Or add a `lint:doc` npm script that runs a check.

### Non-goal for this change
No ESLint config added — manual fix for existing code. Automated enforcement tracked as separate issue.

---

## 6. Files Affected

| File | Changes |
|------|---------|
| `extensions/stack-detector.ts` | ~12 Spanish comments → English |
| `extensions/types/stack.ts` | JSDoc comments → English |
| `extensions/types/skills.ts` | JSDoc comments → English |
| `extensions/types/mcp.ts` | JSDoc comments → English |
| `extensions/types/setup.ts` | JSDoc comments → English |
| `extensions/types/index.ts` | No comments — skip |
| `openspec/config.yaml` | No comments — skip |

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Changing comment accidentally changes behavior | Low | Low | Comments don't affect runtime; verify with tsc |
| User-facing strings changed by mistake | Medium | Medium | Scan for `ctx.ui.notify` strings — keep intact |
| SDD artifacts translated unintentionally | Low | Low | Scope excludes SDD files |

---

## 8. Timeline Estimate

| Phase | Time | Deliverable |
|-------|------|-------------|
| Proposal | 5 min | `proposal.md` |
| Spec | 5 min | List of exact comments to translate |
| Apply | 15 min | All comments in English |
| Verify | 5 min | tsc pass + grep for Spanish |
| **Total** | **~30 min** | |

---

## 9. Next Step

Proceed to **spec** phase to enumerate all Spanish comments that need translation.