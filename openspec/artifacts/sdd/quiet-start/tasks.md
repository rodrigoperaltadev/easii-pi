# SDD Tasks: quiet-start

> Implementation tasks for quiet-start refactor.

---

## 1. Type update — DetectedStack

**File:** `extensions/types/stack.ts`

Add `triggerDeps` field to `DetectedStack` interface:

```typescript
export interface DetectedStack {
  profile: ProjectProfile;
  triggerDeps: string[]; // NEW: deps that fired profile detection
  deps: string[];
  // ... rest unchanged
}
```

**Verification:** `npx tsc --noEmit` passes with updated type.

---

## 2. Edit detectStack — add triggerDeps

**File:** `extensions/stack-detector.ts`

Edit the existing `detectStack()` function:

1. Add `let triggerDeps: string[] = []` near `let profile: ProjectProfile = "unknown"`
2. Add `triggerDeps = [...]` in each branch of the detection ladder:
   - `has("expo")` → `triggerDeps = ["expo"]`
   - `has("react-native")` → `triggerDeps = ["react-native"]`
   - `has("next")` → `triggerDeps = ["next"]`
   - `has("react") && !has("react-native")` → `triggerDeps = ["react"]`
   - `has("phaser")` → `triggerDeps = ["phaser"]`
   - `has("pixi.js") || has("@pixi/app")` → `triggerDeps = ["pixi.js"]`
   - `pkg["main"] && !has("react")` → `triggerDeps = ["node-backend"]`
   - `(pkg["types"] || Array.isArray(pkg["files"])) && !has("react")` → `triggerDeps = ["npm-library"]`
3. Add `triggerDeps` to the return object

**Important:** Do NOT replace the function. Edit it in place. Preserve the existing conditions (guards, ordering).

**Verification:** `npx tsc --noEmit` passes.

---

## 3. Create extensions/state/settings.ts

**File:** `extensions/state/settings.ts` (NEW)

```typescript
import * as fs from "node:fs";
import * as path from "node:path";

// Types defined in this file (no self-import)
export interface EasiiSettings {
  easii?: {
    verbosity?: Verbosity;
  };
}

export type Verbosity = "off" | "minimal" | "full";

export const DEFAULT_VERBOSITY: Verbosity = "minimal";

export function getVerbosity(cwd: string): Verbosity {
  const filePath = path.join(cwd, ".pi", "settings.json");
  if (!fs.existsSync(filePath)) return DEFAULT_VERBOSITY;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as EasiiSettings;
    const verbosity = data.easii?.verbosity;
    if (verbosity === "off" || verbosity === "minimal" || verbosity === "full") {
      return verbosity;
    }
    return DEFAULT_VERBOSITY;
  } catch {
    return DEFAULT_VERBOSITY;
  }
}
```

**Verification:** `npx tsc --noEmit` passes.

---

## 4. Create extensions/state/state-file.ts

**File:** `extensions/state/state-file.ts` (NEW)

```typescript
import * as fs from "node:fs";
import * as path from "node:path";

export interface EasiiState {
  lastProfile: string;
  lastSignalsHash: string;
  lastSeen: string; // ISO 8601 — informational only
}

export function readState(cwd: string): EasiiState | null {
  const filePath = path.join(cwd, ".pi", "easii-state.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as EasiiState;
  } catch {
    return null;
  }
}

export function writeState(cwd: string, state: EasiiState): void {
  const dir = path.join(cwd, ".pi");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "easii-state.json"), JSON.stringify(state, null, 2));
}
```

**Verification:** `npx tsc --noEmit` passes.

---

## 5. Create extensions/state/index.ts (barrel)

**File:** `extensions/state/index.ts` (NEW)

```typescript
export type { EasiiSettings, Verbosity } from "./settings.js";
export { getVerbosity, DEFAULT_VERBOSITY } from "./settings.js";

export type { EasiiState } from "./state-file.js";
export { readState, writeState } from "./state-file.js";
```

**Verification:** `npx tsc --noEmit` passes.

---

## 6. Add computeSignalsHash to stack-detector.ts

**File:** `extensions/stack-detector.ts`

Add near the top of the file (after imports):

```typescript
import * as crypto from "node:crypto";

// Add after existing imports (before stack detection section)

function computeSignalsHash(stack: DetectedStack): string {
  const signals = [stack.profile, ...stack.triggerDeps].sort().join("|");
  return crypto.createHash("sha256").update(signals).digest("hex").slice(0, 8);
}
```

**Verification:** `npx tsc --noEmit` passes.

---

## 7. Refactor session_start handler

**File:** `extensions/stack-detector.ts`

Replace the existing `session_start` handler with the new stateful version:

```typescript
pi.on("session_start", async (_event, ctx) => {
  const verbosity = getVerbosity(ctx.cwd);
  if (verbosity === "off") return;

  const stack = detectStack(ctx.cwd);
  if (!stack || stack.profile === "unknown") return;

  const currentHash = computeSignalsHash(stack);
  const state = readState(ctx.cwd);

  const profileChanged = !state || state.lastProfile !== stack.profile;
  const signalsChanged = !state || state.lastSignalsHash !== currentHash;
  const shouldNotify = profileChanged || signalsChanged;

  if (verbosity === "full") {
    const suggestions = await buildSuggestions(stack);
    const mcpSuggestions = buildMcpSuggestions(stack, ctx.cwd);
    const capabilities = detectCapabilities(ctx.cwd, stack);
    ctx.ui.notify(buildReport(stack, suggestions, mcpSuggestions, capabilities), "info");
  } else if (shouldNotify) {
    ctx.ui.notify(
      `[@easii/pi] ${PROFILE_LABELS[stack.profile]} detected — run /easii:stack for suggestions.`,
      "info"
    );
  }

  writeState(ctx.cwd, {
    lastProfile: stack.profile,
    lastSignalsHash: currentHash,
    lastSeen: new Date().toISOString(),
  });
});
```

Also add the imports at the top of the file:

```typescript
import * as crypto from "node:crypto";
import { getVerbosity } from "./state/settings.js";
import { readState, writeState } from "./state/state-file.js";
```

**Note:** `crypto` is imported once at the top. `PROFILE_LABELS` already exists in the file (line ~840, used by `buildReport` and format functions) — reuse it in the one-liner, do not duplicate.

**Verification:** `npx tsc --noEmit` passes.

---

## 8. Update /easii:stack handler (optional polish)

**File:** `extensions/stack-detector.ts`

Add "Analyzing stack..." placeholder before running:

```typescript
pi.registerCommand("easii:stack", {
  handler: async (_args, ctx) => {
    ctx.ui.notify("[@easii/pi] Analyzing stack...", "info");

    const stack = detectStack(ctx.cwd);
    // ... rest unchanged
  },
});
```

**Verification:** `npx tsc --noEmit` passes.

---

## 9. Update .gitignore

**File:** `.gitignore`

Add:
```
# @easii/pi state (local, not shared)
.pi/easii-state.json
```

**Verification:** `.pi/easii-state.json` is not tracked by git.

---

## 10. Update README.md

**File:** `README.md`

Add verbosity section and back-compat documentation.

**Verification:** README includes verbosity docs.

---

## 11. Verification tests

Run these manually or with the test suite:

### Test 1: First session emits one-liner
```
Setup: No .pi/easii-state.json exists
Action: Start Pi session in project with package.json (expo)
Expected: One-liner notify: "[@easii/pi] React Native + Expo detected — run /easii:stack for suggestions."
Expected: .pi/easii-state.json created with lastProfile and lastSignalsHash
```

### Test 2: Second session is silent (same stack)
```
Setup: .pi/easii-state.json exists with correct profile + hash
Action: Start Pi session in same project
Expected: No notify emitted
Expected: State file unchanged
```

### Test 3: Stack change re-triggers one-liner
```
Setup: .pi/easii-state.json with react-native-expo
Action: User removes expo dep, package.json has only react-native
Expected: One-liner notify: "[@easii/pi] React Native (bare) detected — run /easii:stack for suggestions."
Expected: State file updated with new profile + hash
```

### Test 4: verbosity=off is always silent
```
Setup: .pi/settings.json with { "easii": { "verbosity": "off" } }
Action: Start Pi session in any project
Expected: No notify emitted (even on first session)
Expected: State file NOT updated (off returns early; allows one-liner to re-fire when verbosity changes to minimal)
```

### Test 5: verbosity=full dumps everything (back-compat)
```
Setup: .pi/settings.json with { "easii": { "verbosity": "full" } }
Action: Start Pi session in project with package.json (expo)
Expected: Full dump (stack info, capabilities, skills, MCPs)
Expected: Marketplace fetch occurs (~4s)
Expected: State file updated
```

### Test 6: Hash stable on version bump
```
Setup: .pi/easii-state.json with react-native-bare, hash based on ["react-native"]
Action: User runs npm install react-native@0.78 (version bump only)
Expected: No one-liner (same trigger deps → same hash)
Expected: State file unchanged
```

### Test 7: /easii:stack always runs full report
```
Setup: Any state, any verbosity setting
Action: User runs /easii:stack
Expected: Full report with stack, capabilities, skills, MCPs
Expected: Ignores verbosity setting
```

---

## 12. Commit

```bash
git add -A
git commit -m "feat: quiet-start session with stateful one-liner and on-demand full report"
```

---

## Summary

| Task | File | Type |
|------|------|------|
| 1 | `extensions/types/stack.ts` | Edit |
| 2 | `extensions/stack-detector.ts` | Edit (detectStack) |
| 3 | `extensions/state/settings.ts` | New |
| 4 | `extensions/state/state-file.ts` | New |
| 5 | `extensions/state/index.ts` | New |
| 6 | `extensions/stack-detector.ts` | Edit (computeSignalsHash) |
| 7 | `extensions/stack-detector.ts` | Edit (session_start) |
| 8 | `extensions/stack-detector.ts` | Edit (/easii:stack) |
| 9 | `.gitignore` | Edit |
| 10 | `README.md` | Edit |
| 11 | — | Manual verification |
| 12 | — | Commit |