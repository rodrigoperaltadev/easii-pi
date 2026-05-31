# SDD Design: Refactor Types Extraction — `@easii/pi`

**Change ID:** `refactor-types-extraction`  
**Phase:** design  
**Date:** 2026-05-30  
**Status:** Designed

> This is the "how to do it" guide. The spec defined what to extract; this document covers how to do it safely, what the output looks like, and what to watch out for.

---

## 1. Import Graph (ASCII)

```
@earendil-works/pi-coding-agent
         │
         │  (ExtensionAPI — re-exported from barrel for external consumers)
         ▼
extensions/types/index.ts ─── barrel, no logic
         │
         ├──► extensions/types/stack.ts
         │         └─ ProjectProfile, DetectedStack,
         │             InferredProjectCommands,
         │             PackageManager, ProfileName
         │
         ├──► extensions/types/skills.ts
         │         └─ MarketplaceSkill, LocalSkill,
         │             SkillSuggestion, MarketplaceResult
         │
         ├──► extensions/types/mcp.ts
         │         └─ McpServerConfig, McpSuggestion
         │
         ├──► extensions/types/capabilities.ts
         │         └─ CapabilityStatus, ProjectCapability,
         │             ProjectCapabilities
         │
         └──► extensions/types/setup.ts
                   └─ SetupPreferences, SetupUi

extensions/stack-detector.ts
         │  (entry point — no logic moves, only type imports)
         ▼
  imports from ./types/index.ts ──► all types above
```

**No circular dependencies.** All edges go one direction: `index.ts` → domain files → `stack-detector.ts`.

---

## 2. Diff Sketch by File

### 2.1 `extensions/types/stack.ts` — NEW

```diff
+ /**
+  * Project profile labels for display in reports.
+  */
+ export type ProjectProfile =
+   | "react-native-expo"
+   | "react-native-bare"
+   | "nextjs"
+   | "react-web"
+   | "node-backend"
+   | "npm-library"
+   | "gamedev-phaser"
+   | "gamedev-pixi"
+   | "unknown";
+
+ export interface DetectedStack {
+   profile: ProjectProfile;
+   deps: string[];
+   hasTypeScript: boolean;
+   hasExpoRouter: boolean;
+   hasEAS: boolean;
+   testFramework: "jest" | "vitest" | "none";
+   e2eFramework: "maestro" | "detox" | "playwright" | "none";
+   stateManagement: string[];
+ }
+
+ export interface InferredProjectCommands {
+   packageManager: "npm" | "pnpm" | "yarn" | "bun";
+   testCommand: string;
+   unitCommand: string;
+   e2eCommand: string;
+   typecheckCommand: string;
+   lintCommand: string;
+   formatCommand: string;
+ }
+
+ /** Bounded type for package manager values. */
+ export type PackageManager = InferredProjectCommands["packageManager"];
+
+ /** Bounded type for project profile names. */
+ export type ProfileName = ProjectProfile;
```

### 2.2 `extensions/types/skills.ts` — NEW

```diff
+ export interface MarketplaceSkill {
+   name: string;
+   slug: string;
+   installCmd: string;
+   downloads: number;
+   rating: number;
+   description: string;
+   source: "marketplace";
+ }
+
+ export interface LocalSkill {
+   skillName: string;
+   reason: string;
+   source: "local";
+ }
+
+ export type SkillSuggestion = MarketplaceSkill | LocalSkill;
+
+ export interface MarketplaceResult {
+   slug: string;
+   name: string;
+   install_command?: string;
+   installCommand?: string;
+   downloads?: number;
+   rating?: number;
+   description?: string;
+ }
```

### 2.3 `extensions/types/mcp.ts` — NEW

```diff
+ export interface McpServerConfig {
+   command?: string;
+   args?: string[];
+   url?: string;
+   env?: Record<string, string>;
+   lifecycle?: "lazy" | "eager" | "keep-alive";
+ }
+
+ export interface McpSuggestion {
+   serverKey: string;
+   name: string;
+   reason: string;
+   config: McpServerConfig;
+   setupHint?: string;
+ }
```

### 2.4 `extensions/types/capabilities.ts` — NEW

```diff
+ export type CapabilityStatus =
+   | "configured"
+   | "detected-partial"
+   | "missing"
+   | "not-applicable";
+
+ export interface ProjectCapability {
+   status: CapabilityStatus;
+   summary: string;
+   details?: string[];
+ }
+
+ export interface ProjectCapabilities {
+   unitTests: ProjectCapability;
+   e2eTests: ProjectCapability;
+   strictTdd: ProjectCapability;
+   ci: ProjectCapability;
+   cd: ProjectCapability;
+   docker: ProjectCapability;
+ }
```

### 2.5 `extensions/types/setup.ts` — NEW

```diff
+ export interface SetupPreferences {
+   strictTdd: "configured" | "enable" | "skip" | "missing-runner";
+   e2e:
+     | "configured"
+     | "detected-partial"
+     | "recommended"
+     | "skip"
+     | "not-applicable";
+   ci: "configured" | "detected-partial" | "recommended" | "skip";
+   cd: "configured" | "detected-partial" | "recommended" | "skip";
+   docker:
+     | "configured"
+     | "detected-partial"
+     | "recommended"
+     | "skip"
+     | "not-applicable";
+ }
+
+ export interface SetupUi {
+   confirm?: (title: string, message: string) => Promise<boolean>;
+   notify: (message: string, level: "info" | "warning" | "error") => void;
+ }
```

### 2.6 `extensions/types/index.ts` — NEW

```diff
+ export type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
+
+ // stack
+ export type {
+   ProjectProfile,
+   DetectedStack,
+   InferredProjectCommands,
+   PackageManager,
+   ProfileName,
+ } from "./stack.js";
+
+ // skills
+ export type {
+   MarketplaceSkill,
+   LocalSkill,
+   SkillSuggestion,
+   MarketplaceResult,
+ } from "./skills.js";
+
+ // mcp
+ export type { McpServerConfig, McpSuggestion } from "./mcp.js";
+
+ // capabilities
+ export type {
+   CapabilityStatus,
+   ProjectCapability,
+   ProjectCapabilities,
+ } from "./capabilities.js";
+
+ // setup
+ export type { SetupPreferences, SetupUi } from "./setup.js";
```

### 2.7 `extensions/stack-detector.ts` — BEFORE/AFTER

**BEFORE (lines 1-100):**

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type ProjectProfile =
  | "react-native-expo"
  | "react-native-bare"
  // ... (9 variants, ~20 lines)

interface DetectedStack {
  profile: ProjectProfile;
  // ... (13 fields, ~30 lines)
}

interface MarketplaceSkill { /* 10 fields */ }
interface LocalSkill { /* 3 fields */ }
type SkillSuggestion = MarketplaceSkill | LocalSkill;
interface McpServerConfig { /* 5 fields */ }
interface McpSuggestion { /* 5 fields + McpServerConfig */ }
interface InferredProjectCommands { /* 8 fields */ }
type CapabilityStatus = /* 4 variants */;
interface ProjectCapability { /* 3 fields */ }
interface ProjectCapabilities { /* 6 ProjectCapability fields */ }
interface SetupPreferences { /* 5 fields */ }
// SetupUi is INLINE in this version (not at top)
// MarketplaceResult is INLINE inside searchMarketplace section
```

**AFTER (lines 1-30):**

```diff
- import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
+ // (stays — ExtensionAPI is from the package, not from our types)
+ import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
  import * as fs from "node:fs";
  import * as path from "node:path";
  import { fileURLToPath } from "node:url";

- // ─── Tipos ───────────────────────────────────────────────────────────────────
-
- type ProjectProfile = ...   (lines deleted)
- interface DetectedStack = ...  (lines deleted)
- // ... all 16 type blocks deleted (~1,100 lines removed)
-
+ import type {
+   ProjectProfile,
+   DetectedStack,
+   InferredProjectCommands,
+   PackageManager,
+   ProfileName,
+   MarketplaceSkill,
+   LocalSkill,
+   SkillSuggestion,
+   MarketplaceResult,
+   McpServerConfig,
+   McpSuggestion,
+   CapabilityStatus,
+   ProjectCapability,
+   ProjectCapabilities,
+   SetupPreferences,
+   SetupUi,
+ } from "./types/index.js";
```

**Key change:** `// ─── Tipos ───────────────────────────────────────────────────────────────────` comment block and all ~1,100 lines of inline type declarations are removed. Replaced with one `import type` from the barrel. The `SetupUi` interface that was inline within the setup section is now also imported.

---

## 3. Migration Sequence

Execute in this exact order. Each step is verified before moving to the next.

### Step 1 — Create directory structure

```bash
mkdir -p extensions/types
```

### Step 2 — Create type files (in dependency order)

Create files in this order so that if any TypeScript check fails, the cause is clear:

1. `extensions/types/stack.ts` — base types with no cross-file deps
2. `extensions/types/skills.ts` — skills types
3. `extensions/types/mcp.ts` — MCP types
4. `extensions/types/capabilities.ts` — capabilities types
5. `extensions/types/setup.ts` — setup types
6. `extensions/types/index.ts` — barrel export

> **Why this order?** `stack.ts` is the only file with types that have no external file deps. All other files' types reference only types defined within the same file or in `stack.ts` (via index imports in the barrel). Creating them in order ensures that if a file references something not yet created, it fails fast.

### Step 3 — Verify new files compile in isolation

```bash
npx tsc extensions/types/stack.ts --noEmit --moduleResolution bundler
npx tsc extensions/types/skills.ts --noEmit --moduleResolution bundler
# ... etc
```

Skip this if using `npx tsc --noEmit` on the whole project is faster.

### Step 4 — Edit `extensions/stack-detector.ts`

**4a. Add the import block after the existing imports:**
```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

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

**4b. Remove the `// ─── Tipos ───` comment and all inline type blocks** (lines 5 through ~1150).

**4c. Move `MarketplaceResult` inline definition** from inside the `searchMarketplace` function's vicinity into `skills.ts` — it is currently defined in the "marketplace search" section, not in the top block. The spec noted this is a local interface inside that section. After extraction, the `import type { MarketplaceResult } from ...` will satisfy the reference in `searchMarketplace`.

**4d. Remove the `SetupUi` interface from the setup section** (currently inline near `confirmOrAbort`). It moves to `setup.ts`.

### Step 5 — Verify whole project compiles

```bash
npx tsc --noEmit
```

Expected: **zero errors**. Any error means a type was referenced before it was exported, or an import path is wrong.

### Step 6 — Verify Pi loads the extension

```bash
pi install .
# or
pi dev --dry-run  # if supported
```

Expected: extension registers `session_start`, `easii:stack`, `easii:setup-project` without import errors.

### Step 7 — Confirm no top-level type declarations remain

```bash
grep -n "^type \|^interface \|^  type " extensions/stack-detector.ts | grep -v "function\|//\|  //\|in "
```

Expected: only matches inside function bodies (scoped types like the `X = ...` bounds inside helper functions). No top-level declarations.

### Step 8 — Count diff lines

```bash
git diff --stat
```

Expected: ≤ 300 changed lines (deletions + additions). With ~1,100 lines removed and ~300 new lines in type files, net change should be around −800 lines, well within budget.

---

## 4. Key Transformation Examples

### Example 1 — Naming unnamed type bounds

**Before (inside helper functions):**
```typescript
// line ~310 — inside detectPackageManager / commandForScript
type X = InferredProjectCommands["packageManager"];
type Y = ProjectProfile;

// usage:
function detectPackageManager(cwd: string): InferredProjectCommands["packageManager"] { ... }
function commandForScript(packageManager: InferredProjectCommands["packageManager"], scriptName: string): string { ... }
function dockerApplies(profile: ProjectProfile): boolean { ... }
```

**After (in `types/stack.ts`):**
```typescript
export type PackageManager = InferredProjectCommands["packageManager"];
export type ProfileName = ProjectProfile;
```

And in `stack-detector.ts`:
```typescript
function detectPackageManager(cwd: string): PackageManager { ... }
function commandForScript(packageManager: PackageManager, scriptName: string): string { ... }
function dockerApplies(profile: ProfileName): boolean { ... }
```

### Example 2 — MarketplaceResult extraction

**Before (inline, ~line 250):**
```typescript
interface MarketplaceResult {
  slug: string;
  name: string;
  install_command?: string;
  installCommand?: string;
  downloads?: number;
  rating?: number;
  description?: string;
}

async function searchMarketplace(query: string): Promise<MarketplaceSkill[]> {
  // ...
  const data = (await res.json()) as { skills?: MarketplaceResult[] };
  // ...
}
```

**After (`types/skills.ts`):**
```typescript
export interface MarketplaceResult {
  slug: string;
  name: string;
  install_command?: string;
  installCommand?: string;
  downloads?: number;
  rating?: number;
  description?: string;
}
```

**After (`stack-detector.ts`):**
```typescript
import type { MarketplaceResult, MarketplaceSkill } from "./types/index.js";

async function searchMarketplace(query: string): Promise<MarketplaceSkill[]> {
  // ...
  const data = (await res.json()) as { skills?: MarketplaceResult[] };
  // ...
}
```

### Example 3 — SetupUi interface relocation

**Before (inline in setup section):**
```typescript
// after buildMinimalOpenspecConfig function
interface SetupUi {
  confirm?: (title: string, message: string) => Promise<boolean>;
  notify: (message: string, level: "info" | "warning" | "error") => void;
}

async function confirmOrAbort(ui: SetupUi, title: string, message: string): Promise<boolean> {
  // ...
}
```

**After (`types/setup.ts`):**
```typescript
export interface SetupUi {
  confirm?: (title: string, message: string) => Promise<boolean>;
  notify: (message: string, level: "info" | "warning" | "error") => void;
}
```

**After (`stack-detector.ts`):**
```typescript
import type { SetupUi } from "./types/index.js";

async function confirmOrAbort(ui: SetupUi, title: string, message: string): Promise<boolean> {
  // ... no change to function body
}
```

### Example 4 — Barrel export composition

`extensions/types/index.ts` re-exports from each domain file using explicit named exports (not `export type *`). This avoids namespace pollution and makes it explicit which types are public:

```typescript
export type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// stack
export type {
  ProjectProfile,
  DetectedStack,
  InferredProjectCommands,
  PackageManager,
  ProfileName,
} from "./stack.js";
```

When `stack-detector.ts` imports from the barrel, it gets all types in one import or can cherry-pick:

```typescript
// Full import (cleaner for files that use many types)
import type { SetupUi, SetupPreferences } from "./types/index.js";

// Or selective
import type { SetupUi } from "./types/index.js";
import type { McpSuggestion } from "./types/index.js";
```

---

## 5. Review Workload Estimate and PR Strategy

### Lines changed (estimated)

| File | Change type | Lines |
|---|---|---|
| `extensions/types/stack.ts` | create | ~85 |
| `extensions/types/skills.ts` | create | ~40 |
| `extensions/types/mcp.ts` | create | ~20 |
| `extensions/types/capabilities.ts` | create | ~30 |
| `extensions/types/setup.ts` | create | ~40 |
| `extensions/types/index.ts` | create | ~35 |
| `extensions/stack-detector.ts` | edit | −1,100 type lines, +25 import lines |
| **Total** | | **~275 net changed** |

**Within review budget (≤ 300 lines).**

### Review checklist

1. **Type fidelity** — each extracted type is a verbatim copy of the original. Check that field names, optional flags (`?`), union variants, and comments are preserved exactly.
2. **No logic touched** — scan `stack-detector.ts` for any changes to function bodies. Only `import` statements and removed type blocks should change.
3. **`MarketplaceResult` moved correctly** — it was in the middle of the file (inside the marketplace section), not at the top. Verify it is removed from its inline location and imported from the barrel.
4. **`SetupUi` moved correctly** — was in the setup section, not at top. Verify removed from inline location.
5. **`npx tsc --noEmit` passes** — this is the primary safety gate.
6. **No barrel duplication** — `index.ts` re-exports each type once. No double-export.
7. **`ExtensionAPI` stays in `stack-detector.ts`** — not changed. The re-export in `index.ts` is for external consumers only.
8. **`PROFILE_LABELS` untouched** — runtime constant stays in `stack-detector.ts`.

### PR strategy

- **Single PR** — this is a clean refactor, no feature changes.
- **PR title:** `refactor: extract inline types from stack-detector.ts into extensions/types/`
- **PR description:** summary of what changed, verification steps (`npx tsc --noEmit`), and note that no runtime behavior changed.
- **Reviewer:** one fresh reviewer (not the implementer). Check for:
  - Type fidelity
  - No accidental function changes
  - Correct import paths (`.js` extensions on re-exports, not on imports in `stack-detector.ts`)
  - Barrel exports are clean (no `export type *`)
- **Do not squash-merge** — keep individual file commits for traceability during rollback if needed.

---

## 6. Rollback Plan

### If something goes wrong

**Trigger:** `npx tsc --noEmit` fails, or Pi fails to load the extension.

**Step 1 — Identify failure type**

```
tsc error → type not found / circular import → go to Step 2
Pi runtime error → import path wrong → go to Step 3
```

**Step 2 — Type/import failure**

1. Run `npx tsc --noEmit` to get the exact error.
2. Common causes:
   - **Missing export in barrel** → check `index.ts` re-exports match the imported types
   - **`.js` extension on wrong path** → barrel uses `./stack.js` (runtime), `stack-detector.ts` uses `./types/index.js` (runtime). Verify no `.ts` extensions used in imports.
   - **Circular import** → if `index.ts` accidentally imports from `stack-detector.ts`, remove it. The barrel should only re-export from domain files.

**Step 3 — Runtime/import path failure**

1. Check that `extensions/types/` files exist and have correct names (kebab-case: `stack.ts`, `skills.ts`, etc.).
2. Check that `stack-detector.ts` imports from `./types/index.js` (not `./types/index.ts` — `.js` is correct for `moduleResolution: bundler`).
3. If unsure, revert `stack-detector.ts` to original and verify it still compiles (if it did before the change).

**Step 4 — Full rollback (if needed)**

```bash
# Revert stack-detector.ts to pre-refactor state
git checkout HEAD -- extensions/stack-detector.ts

# Remove the types directory (atomic cleanup)
rm -rf extensions/types

# Verify back to clean state
npx tsc --noEmit
```

This is safe because:
- The types directory is self-contained and not referenced by any other file except `stack-detector.ts`
- No other package depends on `extensions/types/`
- `stack-detector.ts` is the only consumer — reverting it restores the original inline types

**Step 5 — After rollback**

Document the failure in the apply-progress artifact with the error message and what caused it. Re-enter the design phase to fix the root cause before retrying.

---

## 7. Verification Summary

| Check | Method | Pass criteria |
|---|---|---|
| All 16 types extracted | Compare `index.ts` exports vs original top-level declarations | 16 types present |
| No inline types in `stack-detector.ts` | `grep "^type \|^interface "` at top level | Only function-body-scoped types remain |
| Named aliases in place | `grep "PackageManager\|ProfileName" types/stack.ts` | Both aliases present as named exports |
| `npx tsc --noEmit` | Run tsc | Zero errors |
| Barrel exports `ExtensionAPI` | Check `index.ts` | Re-export present |
| `MarketplaceResult` in barrel | Check barrel + `index.ts` | Present |
| `SetupUi` in barrel | Check barrel + `index.ts` | Present |
| No circular imports | `npx tsc --noEmit` with verbose | No "circular" errors |
| Diff ≤ 300 lines | `git diff --stat` | ≤ 300 changed lines |
| Runtime behavior unchanged | Run `pi dev` or `pi install .` | Extension loads, commands register |

---

**Phase gate:** This design is complete and ready for the **tasks** phase. All file structures are specified, transformation examples are concrete, and rollback paths are documented.