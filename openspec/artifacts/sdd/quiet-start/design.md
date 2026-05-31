# SDD Design: quiet-start

> Refactor design for stack-detector.ts

---

## 1. New file structure

```
extensions/
├── stack-detector.ts      # Main extension (refactored session_start)
├── types/                 # Unchanged
│   ├── index.ts
│   ├── stack.ts
│   ├── skills.ts
│   ├── mcp.ts
│   ├── capabilities.ts
│   └── setup.ts
└── state/                 # NEW
    ├── index.ts           # Barrel export
    ├── settings.ts        # EasiiSettings, getVerbosity (read-only)
    └── state-file.ts      # EasiiState, readState, writeState
```

---

## 2. Type definitions (no self-imports)

### extensions/types/stack.ts — DetectedStack extended

```typescript
// Existing interface, add triggerDeps field
export interface DetectedStack {
  profile: ProjectProfile;
  triggerDeps: string[]; // NEW: deps that fired profile detection
  deps: string[];
  hasTypeScript: boolean;
  hasExpoRouter: boolean;
  hasEAS: boolean;
  testFramework: "jest" | "vitest" | "none";
  e2eFramework: "maestro" | "detox" | "playwright" | "none";
  stateManagement: string[];
}
```

### extensions/state/settings.ts — types defined here, no self-import

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

**Note:** No `writeSettings` in v1 — @easii/pi only reads verbosity. Users edit `.pi/settings.json` manually. `writeSettings` will be needed when `/easii:verbose` command is added (future).

### extensions/state/state-file.ts — types defined here, no self-import

```typescript
import * as fs from "node:fs";
import * as path from "node:path";

// Types defined in this file (no self-import)
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

---

## 3. detectStack modification (edit existing function, add triggerDeps)

**Important:** Edit the existing `detectStack()` function in place. Do NOT replace it wholesale. Preserve the existing conditions and guards.

### Current function (to be edited)

```typescript
// extensions/stack-detector.ts — find this function and ADD triggerDeps
function detectStack(cwd: string): DetectedStack | null {
  const pkg = readPackageJson(cwd);
  if (!pkg) return null;

  const deps = getDeps(pkg);
  const has = (name: string) => deps.includes(name);

  let profile: ProjectProfile = "unknown";
  // ... existing ladder continues ...

  // MODIFY: add triggerDeps variable alongside each profile assignment
  // Example for react-native-expo branch:
  if (has("expo")) {
    profile = "react-native-expo";
    triggerDeps = ["expo"]; // ADD THIS LINE
  }
  // ... etc for all branches

  // MODIFY: include triggerDeps in return object
  return {
    profile,
    triggerDeps,           // NEW FIELD
    deps,
    hasTypeScript,
    // ... rest unchanged
  };
}
```

**Key principles:**
- Add `let triggerDeps: string[] = []` near `let profile: ProjectProfile = "unknown"`
- Add `triggerDeps = [...]` in each branch of the detection ladder
- Include `triggerDeps` in the return object
- Do NOT change the detection conditions (node-backend guard, npm-library guard, etc.)

---

## 4. Signal hash function

```typescript
import * as crypto from "node:crypto";

function computeSignalsHash(stack: DetectedStack): string {
  const signals = [stack.profile, ...stack.triggerDeps].sort().join("|");
  return crypto.createHash("sha256").update(signals).digest("hex").slice(0, 8);
}
```

**Why sha256:** Avoids linter warnings about md5. Not security-sensitive.
**Why 8 chars:** Collisions negligible for change detection. Keeps state file small.

---

## 5. extensions/state/index.ts (barrel)

```typescript
export type { EasiiSettings, Verbosity } from "./settings.js";
export { getVerbosity, DEFAULT_VERBOSITY } from "./settings.js";

export type { EasiiState } from "./state-file.js";
export { readState, writeState } from "./state-file.js";
```

---

## 6. Refactored session_start handler

### Before (current — emits on every session, has network)

```typescript
pi.on("session_start", async (_event, ctx) => {
  const stack = detectStack(ctx.cwd);
  if (!stack || stack.profile === "unknown") return;

  const suggestions = await buildSuggestions(stack);        // NETWORK!
  const mcpSuggestions = buildMcpSuggestions(stack, ctx.cwd);
  const capabilities = detectCapabilities(ctx.cwd, stack);
  const report = buildReport(stack, suggestions, mcpSuggestions, capabilities);
  ctx.ui.notify(report, "info");                              // EVERY session
});
```

### After (new — stateful, network gated by verbosity)

```typescript
pi.on("session_start", async (_event, ctx) => {
  const verbosity = getVerbosity(ctx.cwd);
  if (verbosity === "off") return;                          // Always silent

  const stack = detectStack(ctx.cwd);                       // takes cwd, returns DetectedStack | null
  if (!stack || stack.profile === "unknown") return;

  const currentHash = computeSignalsHash(stack);
  const state = readState(ctx.cwd);

  const profileChanged = !state || state.lastProfile !== stack.profile;
  const signalsChanged = !state || state.lastSignalsHash !== currentHash;
  const shouldNotify = profileChanged || signalsChanged;

  if (verbosity === "full") {
    // Back-compat: full dump (includes network fetch)
    const suggestions = await buildSuggestions(stack);
    const mcpSuggestions = buildMcpSuggestions(stack, ctx.cwd);
    const capabilities = detectCapabilities(ctx.cwd, stack);
    ctx.ui.notify(buildReport(stack, suggestions, mcpSuggestions, capabilities), "info");
  } else if (shouldNotify) {
    // Minimal (default): one-liner — NO network
    ctx.ui.notify(
      `[@easii/pi] ${PROFILE_LABELS[stack.profile]} detected — run /easii:stack for suggestions.`,
      "info"
    );
  }

  // Always update state (even if silent)
  writeState(ctx.cwd, {
    lastProfile: stack.profile,
    lastSignalsHash: currentHash,
    lastSeen: new Date().toISOString(),
  });
});
```

---

## 7. /easii:stack unchanged

The `/easii:stack` command body stays exactly as-is. It already calls:
- `detectStack(ctx.cwd)` — same signature, unchanged
- `buildSuggestions(stack)` — async, marketplace (here)
- `buildMcpSuggestions(stack, ctx.cwd)` — local
- `detectCapabilities(ctx.cwd, stack)` — local
- `buildReport()` — format everything

Just add "Analyzing stack..." placeholder and it's done.

---

## 8. Imports added to stack-detector.ts

```typescript
import * as crypto from "node:crypto";
import { getVerbosity } from "./state/settings.js";
import { readState, writeState } from "./state/state-file.js";
```

---

## 9. .gitignore update

```gitignore
# @easii/pi state (local, not shared)
.pi/easii-state.json
```

Note: `.pi/settings.json` is NOT gitignored — user config that can be committed.

---

## 10. README updates

### New section: Verbosity

```markdown
## Verbosity

By default, @easii/pi runs silently on session_start and shows a one-liner only when the stack changes. Full output is on-demand via /easii:stack.

Configure verbosity in `.pi/settings.json`:

```json
{
  "easii": {
    "verbosity": "minimal"
  }
}
```

| Value | Behavior |
|-------|----------|
| `minimal` (default) | One-liner on first session or when stack changes |
| `full` | Full dump on every session (includes marketplace fetch, ~4s latency) |
| `off` | Completely silent on session_start |

**Note:** `full` mode is the legacy behavior. It makes a network call to the skills marketplace on every session.
```

### New section: Backward compatibility

```markdown
## Backward compatibility

To restore the old behavior (full dump on every session):

```json
{
  "easii": {
    "verbosity": "full"
  }
}
```
```

---

## 11. Files summary

| File | Change |
|------|--------|
| `extensions/types/stack.ts` | Add `triggerDeps: string[]` to `DetectedStack` |
| `extensions/stack-detector.ts` | Refactor session_start, add `computeSignalsHash()` |
| `extensions/state/settings.ts` | NEW: `EasiiSettings`, `Verbosity`, `getVerbosity()` |
| `extensions/state/state-file.ts` | NEW: `EasiiState`, `readState()`, `writeState()` |
| `extensions/state/index.ts` | NEW: barrel export |
| `.gitignore` | Add `.pi/easii-state.json` |
| `README.md` | Add verbosity section, back-compat docs |

---

## 12. Preserved (DO NOT change)

- Detection ladder inside `detectStack()` — only add `triggerDeps` variable and assignment
- All capability detection functions: `detectCapabilities()`, `detectCiCapability()`, `detectCdCapability()`, etc.
- All suggestion functions: `buildSuggestions()`, `buildMcpSuggestions()`
- All format functions: `formatStackInfo()`, `formatCapabilitiesReport()`, etc.
- `buildReport()`
- `/easii:setup-project` command and all its helpers
- All types in `extensions/types/` except `DetectedStack`