# SDD Proposal: Refactor Types Extraction — `@easii/pi`

**Change ID:** `refactor-types-extraction`  
**Author:** Gentle AI (el Gentleman Harness)  
**Date:** 2026-05-30  
**Status:** Proposed

---

## 1. Problem Statement

`extensions/stack-detector.ts` is a 1,260-line file where **87% of the code is inline type definitions**. This creates three concrete problems:

1. **Readability friction** — Logic functions are buried under ~1,100 lines of type declarations, making navigation tedious.
2. **Reusability barrier** — Types like `ProjectProfile` and `DetectedStack` cannot be imported by other extensions or skills without pulling in the entire file.
3. **Testing gap** — No test files exist today. Adding unit tests for types requires either duplicating declarations or importing the entire extension bundle.

The refactor is timely because the codebase is stable (v0.2.0, ready to validate), no active feature work is in progress, and the type dependency graph is acyclic — making extraction mechanically safe.

---

## 2. Goals and Non-Goals

### Goals
- Extract 16 type/interface definitions into `extensions/types/` with clean grouping.
- Achieve zero behavioral change — same runtime output, same Pi extension behavior.
- Maintain TypeScript strict mode compliance throughout.
- Produce a barrel export at `extensions/types/index.ts` for clean imports.

### Non-Goals
- Refactor any functions, helpers, or runtime logic.
- Add new tests (Vitest is present but no tests exist; that is a separate change).
- Add a build step, change `tsconfig.json`, or alter `moduleResolution`.
- Change the single-file extension entry point (`extensions/stack-detector.ts`) — it stays as the Pi runtime entry.

---

## 3. Scope

### What Changes

| File | Action |
|---|---|
| `extensions/types/stack.ts` | Create — `ProjectProfile`, `DetectedStack`, `InferredProjectCommands` + named aliases for unnamed type bounds |
| `extensions/types/skills.ts` | Create — `MarketplaceSkill`, `LocalSkill`, `SkillSuggestion`, `MarketplaceResult` |
| `extensions/types/mcp.ts` | Create — `McpServerConfig`, `McpSuggestion` |
| `extensions/types/capabilities.ts` | Create — `CapabilityStatus`, `ProjectCapability`, `ProjectCapabilities` |
| `extensions/types/setup.ts` | Create — `SetupPreferences`, `SetupUi` |
| `extensions/types/index.ts` | Create — barrel export for all types + re-export `ExtensionAPI` from Pi |
| `extensions/stack-detector.ts` | Refactor — replace inline type blocks with `import type` from `./types/index.ts` |

### What Doesn't Change

- Function implementations (all handler, detector, inference logic)
- Runtime behavior
- Pi extension manifest (`package.json` `pi.extensions`)
- `tsconfig.json`
- Skills and schemas

---

## 4. Acceptance Criteria

- [ ] **`npx tsc --noEmit`** passes with no errors after refactor.
- [ ] `pi dev` or `pi install .` (dry-run) loads the extension without import errors.
- [ ] All 16 original types are present in `extensions/types/` and re-exported via barrel.
- [ ] `extensions/stack-detector.ts` no longer contains any `type`, `interface`, or `type X =` declarations at the top level (only in function bodies where needed).
- [ ] Named aliases replace the two previously unnamed type bounds (`PackageManager`, `ProfileName`).
- [ ] No circular imports introduced (verifiable via `npx tsc --noEmit --noCheck` / module graph inspection).
- [ ] Diff is ≤300 changed lines (counting deletions + additions).

---

## 5. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Breaking type inference for Pi runtime | Low | High | Keep all extracted types as `export type`; no value-level code moves. Verify with `npx tsc --noEmit`. |
| Import path mismatch with Pi bundler | Low | High | Use relative paths (`./types/`) — no path aliases. Pi uses `moduleResolution: bundler`. |
| Accidentally changing function signatures | Low | High | No function code is touched; only `import type` statements are added and type blocks removed. |
| Accidentally removing a type used in only one place | Low | Medium | All types must appear in the barrel export; compile check catches any dangling exports. |
| Test gap remains unaddressed | Medium | Low | Document in `apply-progress.md` that Vitest is present but unused; separate change to add tests. |

---

## 6. Timeline Estimate

| Phase | Estimated Time | Deliverable |
|---|---|---|
| **Proposal** | 15 min | `proposal.md` (this file) |
| **Spec** | 15 min | `spec.md` — exact file structure, import plan, and naming conventions |
| **Design** | 10 min | `design.md` — diff sketch, import graph |
| **Tasks** | 10 min | `tasks.md` — step-by-step extraction checklist |
| **Apply** | 45 min | 5 new type files + edited `stack-detector.ts` |
| **Verify** | 15 min | `verify-report.md` — tsc pass, functional smoke, diff ≤300 lines |
| **Total** | **~1h 50min** | |

This is a low-risk, mechanical refactor. The acyclic type graph and absence of circular import risk make it a safe single-PR change.

---

## 7. Next Step

Proceed to **spec** phase to nail down exact file boundaries and import conventions before implementation.