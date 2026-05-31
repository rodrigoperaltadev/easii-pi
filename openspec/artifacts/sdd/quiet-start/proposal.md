# SDD Proposal: quiet-start

**Change:** Silent session_start with stateful one-liner; full report moved to /easii:stack.
**Author:** rodrigoperaltadev
**Date:** 2026-05-31
**Status:** v3 — writeSettings removed from v1

---

## Context

Currently, every Pi session_start in a project with `@easii/pi` installed triggers a full dump:
- Stack detection output
- Capability audit (unit tests, E2E, CI, CD, Docker)
- Marketplace skill search (network call)
- MCP suggestions
- Format + display

This happens **every session**, even if nothing changed. For developers who work in the same project across many sessions, this is:
- Noisy (repeated output)
- Slow (4s marketplace timeout on every session)
- Unnecessary (most sessions are in the same stack)

## What we want

```
Session 1:  [@easii/pi] React Native + Expo detected — run /easii:stack for suggestions.
Session 2+: (silent — nothing changed)

User wants full report: /easii:stack
→ Full dump with skills, MCPs, capabilities
```

## Scope

### In

- Refactor `session_start` handler to be silent by default with stateful one-liner
- Move full report logic exclusively to `/easii:stack` command
- Add state file `.pi/easii-state.json` for stack-change detection
- Add verbosity setting in `.pi/settings.json` (`off | minimal | full`)
- Add `triggerDeps` field in `detectStack()` return (single source of truth for signals)
- Add `computeSignalsHash()` using `triggerDeps`
- Update README with new behavior

### Out (no-goals)

- **No** write to settings in v1 — users edit `.pi/settings.json` manually
- **No** changes to detection logic inside `detectStack()` ladder
- **No** changes to `detectCapabilities()` logic
- **No** changes to `buildSuggestions()` / `buildMcpSuggestions()` / `buildReport()`
- **No** new deps (especially NOT gentle-engram)
- **No** changes to `/easii:setup-project` or schemas
- **No** changes to extension registration (same commands, same events)

### Future (out of scope for v1)

- `writeSettings()` — would need for `/easii:verbose` command (future)
- Automatic verbosity change via command — user sets manually in config

## Decisions

| Decision | Resolution | Rationale |
|----------|-----------|-----------|
| Default verbosity | `minimal` | Discoverable: one-liner tells user about `/easii:stack` |
| State file | `.pi/easii-state.json` | Simple, local, no coupling to openspec |
| Config file | `.pi/settings.json` (read-only in v1) | Standard Pi settings location |
| Hash target | Profile + triggerDeps (from detectStack) | Single source of truth, no duplication |
| Trigger | Profile OR signals hash change | Captures meaningful changes, not noise |
| Network in session_start | **PROHIBITED in off/minimal** | Performance + offline safety |
| `full` mode | ** Allows network** | Back-compat opt-in; documented tradeoff |
| Settings write | **Out of scope for v1** | Read-only; no risk to existing keys |
| `detectStack` signature | `detectStack(cwd: string)` | Unified across session_start and /easii:stack |

## Network rule (reconciled)

- `off` and `minimal`: NO network calls. session_start is fast and offline-only.
- `full`: Back-compat mode. Reintroduces `buildSuggestions()` with marketplace fetch and its ~4s latency. This is the explicit tradeoff users accept when opting into `full`.

Rationale: `full` is a conscious opt-in. Users who enable it expect the old behavior and its latencies.

## Single source of truth for signals

`detectStack()` is extended to return `triggerDeps: string[]` — the deps that fired profile detection. `computeSignalsHash()` consumes it, never re-implements the detection ladder.

**Important:** Edit the existing `detectStack()` function, adding `triggerDeps` in each branch of the existing ladder. Do not replace the function wholesale — the existing conditions (node-backend, npm-library guards, etc.) must be preserved.

## Back-compat

- Users who want the old "dump on every session" behavior can set `verbosity: "full"` in `.pi/settings.json`
- The `full` mode is documented with its network tradeoff in README
- Migration is opt-in via setting

## Artifacts produced

- `explore.md` — options analysis and tradeoffs
- `proposal.md` — this file (v3)
- `spec.md` — exact conditions and scenarios
- `design.md` — refactor design with code structure
- `tasks.md` — implementation tasks with estimates

## Verification plan

1. **session_start first time:** one-liner emitted, state file created
2. **session_start same stack:** silent, no notify
3. **session_start stack changed:** one-liner emitted, state updated
4. **session_start verbosity=off:** silent always
5. **session_start verbosity=full:** full dump with marketplace (back-compat)
6. **/easii:stack always:** full report regardless of verbosity
7. **Hash stable:** version bumps don't re-trigger notification
8. **Settings read-only:** existing keys preserved (no write in v1)

---

**Awaiting confirmation before proceeding to tasks phase and implementation.**