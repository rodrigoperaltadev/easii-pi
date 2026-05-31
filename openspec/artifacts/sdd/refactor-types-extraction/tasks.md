# SDD Tasks: Refactor Types Extraction — `@easii/pi`

**Change ID:** `refactor-types-extraction`
**Phase:** tasks
**Date:** 2026-05-30
**Status:** Tasks Written

---

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~275 net (~1,100 deletions + ~325 additions across 7 files) |
| 400-line budget risk | **Low** |
| Chained PRs recommended | **No** |
| Suggested split | Single PR: `extensions/types/` (5 new files) + `extensions/types/index.ts` (1 new) + `extensions/stack-detector.ts` (1 edited) |
| Delivery strategy | single-pr |
| Chain strategy | stacked-to-main |

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: stacked-to-main
400-line budget risk: Low
```

**Rationale:** This is a pure mechanical refactor. Acyclic type graph, zero behavioral changes, clear file boundaries, and verified import paths. No reason to chain PRs. The diff is well within the 300-line review budget.

---

## Pre-flight Checks

Before starting, confirm:

- [ ] `npx tsc --noEmit` passes on the current codebase (baseline)
- [ ] `extensions/stack-detector.ts` is clean (no uncommitted changes that might conflict with the import surgery)
- [ ] No other files import from `extensions/types/` (it doesn't exist yet — verify nothing hardcodes this path)
- [ ] `git status` shows a clean working tree

---

## Task List

### Phase 1 — Create type files (in dependency order)

> Create each file as a standalone `export type` / `export interface` block. No runtime code. Copy verbatim from the spec's section 5 definitions. All file contents are already defined in `spec.md` — copy from there.

---

**Task 1.1** — Create `extensions/types/stack.ts`

```
Target: extensions/types/stack.ts
Action: Create the file with the following 5 exports:
  - ProjectProfile (union type)
  - DetectedStack (interface, 13 fields)
  - InferredProjectCommands (interface, 8 fields)
  - PackageManager (named alias — replaces the unnamed `type X` bound)
  - ProfileName (named alias — replaces the unnamed `type Y` bound)
Source: spec.md §5, `extensions/types/stack.ts` block
Verify: npx tsc extensions/types/stack.ts --noEmit (should pass in isolation)
```

```typescript
// extensions/types/stack.ts — verbatim from spec.md §5
export type ProjectProfile =
  | "react-native-expo"
  | "react-native-bare"
  | "nextjs"
  | "react-web"
  | "node-backend"
  | "npm-library"
  | "gamedev-phaser"
  | "gamedev-pixi"
  | "unknown";

export interface DetectedStack {
  profile: ProjectProfile;
  deps: string[];
  hasTypeScript: boolean;
  hasExpoRouter: boolean;
  hasEAS: boolean;
  testFramework: "jest" | "vitest" | "none";
  e2eFramework: "maestro" | "detox" | "playwright" | "none";
  stateManagement: string[];
}

export interface InferredProjectCommands {
  packageManager: "npm" | "pnpm" | "yarn" | "bun";
  testCommand: string;
  unitCommand: string;
  e2eCommand: string;
  typecheckCommand: string;
  lintCommand: string;
  formatCommand: string;
}

/** Bounded type for package manager values. */
export type PackageManager = InferredProjectCommands["packageManager"];

/** Bounded type for project profile names. */
export type ProfileName = ProjectProfile;
```

---

**Task 1.2** — Create `extensions/types/skills.ts`

```
Target: extensions/types/skills.ts
Action: Create the file with the following 4 exports:
  - MarketplaceSkill (interface, 7 fields + source literal)
  - LocalSkill (interface, 3 fields + source literal)
  - SkillSuggestion (union)
  - MarketplaceResult (interface — handles snake_case/camelCase variants from API)
Source: spec.md §5, `extensions/types/skills.ts` block
Verify: npx tsc extensions/types/skills.ts --noEmit (should pass in isolation)
```

---

**Task 1.3** — Create `extensions/types/mcp.ts`

```
Target: extensions/types/mcp.ts
Action: Create the file with the following 2 exports:
  - McpServerConfig (interface, 5 optional fields)
  - McpSuggestion (interface, 5 fields + McpServerConfig + optional setupHint)
Source: spec.md §5, `extensions/types/mcp.ts` block
Verify: npx tsc extensions/types/mcp.ts --noEmit
```

---

**Task 1.4** — Create `extensions/types/capabilities.ts`

```
Target: extensions/types/capabilities.ts
Action: Create the file with the following 3 exports:
  - CapabilityStatus (union of 4 string literals)
  - ProjectCapability (interface, 3 fields)
  - ProjectCapabilities (interface, 6 ProjectCapability fields)
Source: spec.md §5, `extensions/types/capabilities.ts` block
Verify: npx tsc extensions/types/capabilities.ts --noEmit
```

---

**Task 1.5** — Create `extensions/types/setup.ts`

```
Target: extensions/types/setup.ts
Action: Create the file with the following 2 exports:
  - SetupPreferences (interface, 5 fields with long union value types)
  - SetupUi (interface, 3 fields — injected dependency for confirmOrAbort)
Source: spec.md §5, `extensions/types/setup.ts` block
Verify: npx tsc extensions/types/setup.ts --noEmit
```

---

**Task 1.6** — Create `extensions/types/index.ts` (barrel export)

```
Target: extensions/types/index.ts
Action: Create the barrel export that:
  1. Re-exports ExtensionAPI from @earendil-works/pi-coding-agent
  2. Re-exports all 5 types from ./stack.js
  3. Re-exports all 4 types from ./skills.js
  4. Re-exports McpServerConfig and McpSuggestion from ./mcp.js
  5. Re-exports all 3 types from ./capabilities.js
  6. Re-exports SetupPreferences and SetupUi from ./setup.js

Key: Use .js extensions in the re-export paths (moduleResolution: bundler requires this).
Key: Use named exports only — no `export type *`.
Source: spec.md §4, barrel export block
Verify: npx tsc extensions/types/index.ts --noEmit
```

---

### Phase 2 — Edit `extensions/stack-detector.ts`

---

**Task 2.1** — Add import from barrel (right after existing imports)

```
Target: extensions/stack-detector.ts, lines 1-10
Action: After the three existing imports (ExtensionAPI, node:fs, node:path, node:url),
add the new import block:

  import type {
    ProjectProfile,
    DetectedStack,
    InferredProjectCommands,
    PackageManager,
    ProfileName,
    MarketplaceSkill,
    LocalSkill,
    SkillSuggestion,
    MarketplaceResult,
    McpServerConfig,
    McpSuggestion,
    CapabilityStatus,
    ProjectCapability,
    ProjectCapabilities,
    SetupPreferences,
    SetupUi,
  } from "./types/index.js";
```

---

**Task 2.2** — Remove top-level type blocks (lines 5 through ~1150)

```
Target: extensions/stack-detector.ts
Action: Remove everything between the comment `// ─── Tipos ───` and the first function.
This removes:
  - type ProjectProfile = ... (lines ~5-25)
  - interface DetectedStack = ... (lines ~26-40)
  - interface MarketplaceSkill = ... (lines ~41-50)
  - interface LocalSkill = ... (lines ~51-55)
  - type SkillSuggestion = ... (lines ~56)
  - interface McpServerConfig = ... (lines ~57-63)
  - interface McpSuggestion = ... (lines ~64-72)
  - interface InferredProjectCommands = ... (lines ~73-80)
  - type CapabilityStatus = ... (lines ~81-84)
  - interface ProjectCapability = ... (lines ~85-88)
  - interface ProjectCapabilities = ... (lines ~89-96)
  - interface SetupPreferences = ... (lines ~97-109)
  - (MarketplaceResult is also inline in the marketplace section — remove it there too)

Expected: ~1,100 lines removed. The file should now be ~160 lines.
```

**Special attention:**
- `MarketplaceResult` is defined inline in the marketplace search section (~line 250), not at the top. Remove it from there too.
- `SetupUi` is defined inline in the setup section (after `buildMinimalOpenspecConfig`). Remove it from there too.
- Both are now imported from `./types/index.js`.

---

**Task 2.3** — Update function signatures that used unnamed bounds

```
Target: extensions/stack-detector.ts
Action: Update these functions to use the new named aliases:

  - detectPackageManager(): return type changes from InferredProjectCommands["packageManager"] to PackageManager
  - commandForScript(): parameter type changes from InferredProjectCommands["packageManager"] to PackageManager
  - commandForBinary(): parameter type changes from InferredProjectCommands["packageManager"] to PackageManager
  - dockerApplies(): parameter type changes from ProjectProfile to ProfileName
  - runProjectSetupBlockBuilder(): parameter type changes from ProjectProfile to ProfileName

These were using the unnamed X/Y type bounds. Now they use PackageManager and ProfileName.
No logic changes — only type annotation updates.
```

---

### Phase 3 — Verify

---

**Task 3.1** — Run TypeScript compiler

```bash
npx tsc --noEmit
```

**Expected:** Zero errors. Any error means a type was referenced before it was exported, or an import path is wrong.

---

**Task 3.2** — Verify no top-level type declarations remain in `stack-detector.ts`

```bash
grep -n "^type \|^interface " extensions/stack-detector.ts
```

**Expected:** Only matches inside function bodies (scoped types). No top-level declarations.

---

**Task 3.3** — Verify all 16 types are in the barrel

```bash
# Check each type exists in the index.ts exports
grep -E "ProjectProfile|DetectedStack|InferredProjectCommands|PackageManager|ProfileName" extensions/types/index.ts
grep -E "MarketplaceSkill|LocalSkill|SkillSuggestion|MarketplaceResult" extensions/types/index.ts
grep -E "McpServerConfig|McpSuggestion" extensions/types/index.ts
grep -E "CapabilityStatus|ProjectCapability|ProjectCapabilities" extensions/types/index.ts
grep -E "SetupPreferences|SetupUi" extensions/types/index.ts
```

**Expected:** All 16 type names appear in the barrel.

---

**Task 3.4** — Check diff is within budget

```bash
git diff --stat
```

**Expected:** ≤ 300 changed lines (deletions + additions). The net should be around −800 lines (1,100 removed from stack-detector, ~325 added across new type files).

---

**Task 3.5** — Verify Pi loads the extension

```bash
pi install .
```

**Expected:** Extension registers `session_start`, `easii:stack`, and `easii:setup-project` without import errors. No TypeScript type errors at runtime.

---

## Task Dependency Graph

```
Task 1.1 (stack.ts)  ──┐
Task 1.2 (skills.ts)  ──┤
Task 1.3 (mcp.ts)     ──┤──► Task 1.6 (index.ts barrel) ──► Task 2.1 (add import)
Task 1.4 (capabilities) ─┤                                          │
Task 1.5 (setup.ts)   ──┘                                          ▼
                                                               Task 2.2 (remove inline types)
                                                                     │
                                                                     ▼
                                                               Task 2.3 (update function sigs)
                                                                     │
                                                                     ▼
                                                               Task 3.1-3.5 (verify)
```

**Tasks 1.1–1.5 are independent** (can be created in parallel if desired, but sequential is safer). **Task 1.6 depends on all 1.1–1.5.** **Tasks 2.1–2.3 depend on 1.6.** **Tasks 3.1–3.5 depend on 2.1–2.3.**

---

## Rollback Trigger

If `npx tsc --noEmit` fails after Task 2.2:

```bash
# Revert stack-detector.ts to pre-refactor state
git checkout HEAD -- extensions/stack-detector.ts

# Remove the types directory (atomic cleanup)
rm -rf extensions/types

# Verify back to clean state
npx tsc --noEmit
```

If the rollback succeeds and tsc passes, return to design phase to diagnose the root cause.

---

## Phase Completion Signal

Tasks are complete when:
- `npx tsc --noEmit` passes with zero errors
- `grep "^type \|^interface " extensions/stack-detector.ts` returns only function-body-scoped results
- All 16 types are exported from `extensions/types/index.ts`
- `git diff --stat` shows ≤ 300 changed lines
- `pi install .` succeeds without import errors

---

**Next phase:** `sdd-apply` — execute the task list above in order.