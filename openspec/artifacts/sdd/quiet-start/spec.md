# SDD Spec: quiet-start

> Exact conditions for session_start behavior and /easii:stack output.

---

## 1. State file

### Location
`{cwd}/.pi/easii-state.json`

### Schema
```typescript
interface EasiiState {
  lastProfile: string;
  lastSignalsHash: string;
  lastSeen: string; // ISO 8601 — informational only, not used in decisions
}
```

### Lifecycle
- **Create:** on first session if no file exists
- **Update:** after every session_start detection (regardless of whether notify was emitted)
- **Never delete** automatically

### Known limitations
- **Concurrent sessions:** last-write-wins is acceptable. State is best-effort. No locking needed for v1.

---

## 2. Signal hash

### Source: detectStack exposes trigger deps

`detectStack()` is extended to return `triggerDeps: string[]` — the deps that fired profile detection. This is the single source of truth. `computeSignalsHash()` consumes it, never re-implements the detection ladder.

**Important:** Add `triggerDeps` to the existing `detectStack()` function, branch by branch. Do NOT replace the function. Preserve the existing conditions (node-backend, npm-library guards, etc.).

### detectStack signature

```typescript
// Signature unchanged externally: call with cwd
function detectStack(cwd: string): DetectedStack | null

// DetectedStack extended with triggerDeps:
interface DetectedStack {
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

### What triggerDeps contains (per existing ladder branch)

| Profile | triggerDeps |
|---------|-------------|
| `react-native-expo` | `["expo"]` |
| `react-native-bare` | `["react-native"]` |
| `nextjs` | `["next"]` |
| `react-web` | `["react"]` |
| `gamedev-phaser` | `["phaser"]` |
| `gamedev-pixi` | `["pixi.js"]` |
| `node-backend` | `["node-backend"]` (marker only) |
| `npm-library` | `["npm-library"]` (marker only) |
| `unknown` | `[]` |

### computeSignalsHash

```typescript
function computeSignalsHash(stack: DetectedStack): string {
  const signals = [stack.profile, ...stack.triggerDeps].sort().join("|");
  return crypto.createHash("sha256").update(signals).digest("hex").slice(0, 8);
}
```

**Why sha256:** Avoids linter warnings about md5. Hash is for change detection only, not security.

**Why only 8 chars:** Collision risk is negligible for this use case. Keeps state file small.

### What is NOT hashed
- Version numbers
- Dev dependencies (unless they are trigger deps)
- Scripts
- Package name, description, etc.

---

## 3. Config file (read-only in v1)

### Location
`{cwd}/.pi/settings.json`

### Schema
```typescript
interface EasiiSettings {
  easii?: {
    verbosity?: "off" | "minimal" | "full";
  };
}

type Verbosity = "off" | "minimal" | "full";
```

### Defaults
- If file doesn't exist → `verbosity: "minimal"`
- If file exists but easii block missing → `verbosity: "minimal"`
- Unknown values → treat as `"minimal"`

### Note on write

**No writeSettings in v1.** `@easii/pi` only reads verbosity. Users edit `.pi/settings.json` manually.

When `/easii:verbose` command is added (future), it will need read-merge-write logic to preserve existing keys (e.g., `subagents.agentOverrides` from pi-subagents).

---

## 4. session_start behavior

### Algorithm (pseudocode)

```typescript
// Async because verbosity === "full" calls buildSuggestions (async)
async function onSessionStart(ctx: SessionContext): Promise<void> {
  const verbosity = getVerbosity(ctx.cwd);
  if (verbosity === "off") return;

  const stack = detectStack(ctx.cwd); // takes cwd, returns DetectedStack | null
  if (!stack || stack.profile === "unknown") return;

  const currentHash = computeSignalsHash(stack);
  const state = readState(ctx.cwd);

  const profileChanged = !state || state.lastProfile !== stack.profile;
  const signalsChanged = !state || state.lastSignalsHash !== currentHash;
  const shouldNotify = profileChanged || signalsChanged;

  if (verbosity === "full") {
    // Back-compat: emit full dump (includes network fetch to marketplace)
    const suggestions = await buildSuggestions(stack);     // ASYNC — 4s timeout
    const mcpSuggestions = buildMcpSuggestions(stack, ctx.cwd);
    const capabilities = detectCapabilities(ctx.cwd, stack);
    ctx.ui.notify(buildReport(stack, suggestions, mcpSuggestions, capabilities), "info");
  } else if (shouldNotify) {
    // minimal (default): one-liner — NO network
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
}
```

**Note on network:** In `full` mode, `buildSuggestions()` fetches the marketplace. This is the documented tradeoff for opting into back-compat. In `off` and `minimal`, NO network calls occur.

### Firing conditions for one-liner (minimal mode)

| Condition | Show one-liner? |
|-----------|-----------------|
| No state file exists | YES (first session ever) |
| `lastProfile !== currentProfile` | YES (profile changed) |
| `lastSignalsHash !== currentHash` | YES (trigger deps changed) |
| None of above | NO (silent) |

### One-liner format
```
[@easii/pi] React Native + Expo detected — run /easii:stack for suggestions.
```

### PROFILE_LABELS completeness

```typescript
const PROFILE_LABELS: Record<ProjectProfile, string> = {
  "react-native-expo": "React Native + Expo",
  "react-native-bare": "React Native (bare)",
  nextjs: "Next.js",
  "react-web": "React Web",
  "node-backend": "Node.js Backend",
  "npm-library": "npm library",
  "gamedev-phaser": "Videojuego (Phaser)",
  "gamedev-pixi": "Videojuego (PixiJS)",
  unknown: "Proyecto desconocido",
};
```

---

## 5. /easii:stack behavior

### Always runs full report (no state gating, no verbosity check)

```typescript
pi.registerCommand("easii:stack", {
  handler: async (_args, ctx) => {
    ctx.ui.notify("[@easii/pi] Analyzing stack...", "info");

    const stack = detectStack(ctx.cwd); // same signature as session_start
    if (!stack || stack.profile === "unknown") {
      ctx.ui.notify("[@easii/pi] Could not detect stack. Is there a package.json?", "warning");
      return;
    }

    const [suggestions, mcpSuggestions, capabilities] = await Promise.all([
      buildSuggestions(stack),
      Promise.resolve(buildMcpSuggestions(stack, ctx.cwd)),
      Promise.resolve(detectCapabilities(ctx.cwd, stack)),
    ]);

    ctx.ui.notify(buildReport(stack, suggestions, mcpSuggestions, capabilities), "info");
  },
});
```

---

## 6. File operations

### getVerbosity(cwd: string): Verbosity

```typescript
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

### readState(cwd: string): EasiiState | null

```typescript
export function readState(cwd: string): EasiiState | null {
  const filePath = path.join(cwd, ".pi", "easii-state.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as EasiiState;
  } catch {
    return null;
  }
}
```

### writeState(cwd: string, state: EasiiState): void

```typescript
export function writeState(cwd: string, state: EasiiState): void {
  const dir = path.join(cwd, ".pi");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "easii-state.json"), JSON.stringify(state, null, 2));
}
```

---

## 7. .gitignore entries

```gitignore
# @easii/pi state (local, not shared)
.pi/easii-state.json
```

Note: `.pi/settings.json` is NOT gitignored — user config that can be committed.

---

## 8. Error handling

| Scenario | Behavior |
|----------|----------|
| package.json missing | Silent (no error, no notify) |
| .pi/ dir missing | Create it before writing state |
| Invalid JSON in state file | Treat as no state → emit one-liner |
| Invalid JSON in settings | Treat as default (minimal) |
| Network timeout in /easii:stack | Silently fall back to local skills (existing behavior) |

---

## 9. Scenarios

### Scenario 1: First session ever
```
State: none
Input: package.json with expo
Output: [@easii/pi] React Native + Expo detected — run /easii:stack for suggestions.
State after: { lastProfile: "react-native-expo", lastSignalsHash: "a3f8c2d1", lastSeen: "..." }
```

### Scenario 2: Second session, same stack
```
State: { lastProfile: "react-native-expo", lastSignalsHash: "a3f8c2d1" }
Input: same package.json
Output: (silent — no notify)
State after: unchanged
```

### Scenario 3: User ran npm install expo-router
```
State: { lastProfile: "react-native-expo", lastSignalsHash: "a3f8c2d1" }
Input: package.json now has expo-router (devDep)
Trigger deps: still ["expo"] → same hash
Output: (silent — signals unchanged)
```

### Scenario 4: User upgraded react-native from 0.76 to 0.78
```
State: { lastProfile: "react-native-bare", lastSignalsHash: "b4d9e3f2" }
Input: package.json react-native@0.78
Trigger deps: still ["react-native"] → same hash
Output: (silent — signals unchanged despite version bump)
```

### Scenario 5: User added @supabase/supabase-js
```
State: { lastProfile: "react-native-expo", lastSignalsHash: "a3f8c2d1" }
Input: package.json now has @supabase/supabase-js
Trigger deps: still ["expo"] → same hash
Output: (silent — profile unchanged, MCPs will appear in /easii:stack)
```

### Scenario 6: User removed expo, converted to bare RN
```
State: { lastProfile: "react-native-expo", lastSignalsHash: "a3f8c2d1" }
Input: package.json no longer has expo, has react-native
Trigger deps: ["react-native"] → different hash
Output: [@easii/pi] React Native (bare) detected — run /easii:stack for suggestions.
```

### Scenario 7: User set verbosity to "full"
```
Settings: { easii: { verbosity: "full" } }
Behavior: Every session emits full dump (back-compat mode, includes marketplace fetch)
```

### Scenario 8: User set verbosity to "off"
```
Settings: { easii: { verbosity: "off" } }
Behavior: Every session is silent (user knows about /easii:stack)
```

### Scenario 9: Invalid settings.json treated as default
```
Settings file: { "subagents": { ... }, "easii": "not-an-object" }
Behavior: verbosity defaults to "minimal"
```