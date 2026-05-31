# SDD Explore: quiet-start

> Bounded refactor: change session_start from "dump everything" to "quiet with state, full report on-demand".

## 1. State storage location

### Option A: `.pi/easii-state.json` (chosen)
**Rationale:** Simplest, local-only, zero coupling to openspec.

```json
{
  "lastProfile": "react-native-expo",
  "lastSignalsHash": "a3f8c2d1",
  "lastSeen": "2026-05-31T10:00:00Z"
}
```

- Lives at `{cwd}/.pi/easii-state.json`
- Added to `.gitignore` (state, not source)
- No external deps
- Survives Pi restarts, shared across sessions in same project

**Tradeoffs:** Separate from openspec/config.yaml, but that separation is good — state ≠ config.

### Option B: openspec/config.yaml easii block
Rejected because:
- Couples state to source-controlled config
- User edits config.yaml manually; state is auto-generated — mixing concerns
- Harder to "reset" state cleanly

### Option C: package-level state
Rejected because:
- Doesn't survive across projects
- Can't track "first time in this project"

---

## 2. Signal hashing

### Option A: hash(profile + dep-signals) (chosen)
Only hash what **drives** profile detection.

```typescript
function computeSignalsHash(pkg: PackageJson, profile: ProjectProfile): string {
  const signals = [
    profile,
    ...triggerDeps(pkg), // deps that fire profile detection
  ].sort();
  return md5(signals.join("|"));
}
```

Where `triggerDeps` = the specific deps that trigger each profile:
- `expo` → react-native-expo
- `react-native` (no expo) → react-native-bare
- `next` → nextjs
- `react` (no RN) → react-web
- `phaser` → gamedev-phaser
- etc.

**NOT hashed:** devDeps, scripts, version bumps, package name.

**Tradeoffs:** Stable on version bumps, precise on actual profile changes.

### Option B: hash(full package.json)
Rejected because:
- Version bumps trigger false positives
- `npm install` changes would re-trigger notification
- Too noisy

### Option C: hash(deps sorted + profile)
Middle ground but still includes devDeps which are noise for profile detection.

---

## 3. Config surface for verbosity knob

### Option A: `.pi/settings.json` (chosen)
Standard Pi location for settings. Clean separation from openspec.

```json
{
  "easii": {
    "verbosity": "minimal"
  }
}
```

**Why not openspec/config.yaml?** Because:
- easii block in config.yaml is for SETUP HINTS (written by setup-project command)
- Verbosity is user preference, not detected config — separate concerns
- `.pi/settings.json` is where users look for Pi behavior knobs

### Option B: easii block in openspec/config.yaml
Rejected because:
- Config block is @easii/pi-generated hints, not user-configured preferences
- Coupling user pref to generated content is confusing

### Option C: state file itself
Rejected because:
- State + config in same file is muddy
- User would need to edit generated JSON

---

## 4. Verbosity modes

| Mode | session_start behavior | /easii:stack behavior |
|------|------------------------|----------------------|
| `off` | Silent always | Full report |
| `minimal` (DEFAULT) | One-liner on first/changed | Full report |
| `full` | Full dump (back-compat) | Full report |

**Decision:** `minimal` default — balances discoverability (one-liner) with quietness. `full` available for users who want old behavior.

---

## 5. One-liner trigger logic

### Trigger conditions (show one-liner)
1. **First session ever:** no state file exists
2. **Profile changed:** `lastProfile !== currentProfile`
3. **Signals hash changed:** `lastSignalsHash !== computeSignalsHash(pkg, profile)`

If none trigger → session_start is silent (no notify).

### One-liner format
```
[@easii/pi] React Native + Expo detected — run /easii:stack for suggestions.
```

### State update (always, even if silent)
After detecting, update `.pi/easii-state.json` with current profile + hash.

---

## 6. What lives in session_start vs /easii:stack

### session_start (offline, fast)
- `detectStack()` — local, no network
- Compute signals hash
- Check state file
- Emit one-liner ONLY if trigger conditions met
- Update state file

### /easii:stack (on-demand, can be async)
- `detectStack()` — already available
- `buildSuggestions()` — async marketplace search
- `buildMcpSuggestions()` — local
- `detectCapabilities()` — local (reads config.yaml, workflows)
- `buildReport()` — format everything
- Emit full report

**Key invariant:** session_start NEVER calls `buildSuggestions()`, `buildMcpSuggestions()`, `detectCapabilities()`.

---

## Open questions (resolved in proposal)

1. **Default mode:** `minimal` vs `off` — chose `minimal` for discoverability.
2. **Config location:** `.pi/settings.json` chosen over openspec block.
3. **When to re-show one-liner:** On profile change OR signals hash change (not just first session).
4. **What to hash:** Profile + trigger deps (not full package.json).

---

## Preserved (DO NOT change)

- `detectStack()` logic
- `inferProjectCommands()` logic
- `detectCapabilities()` logic
- `buildSuggestions()` async logic
- `buildMcpSuggestions()` logic
- `buildReport()` formatting
- All format* functions
- `/easii:setup-project` command