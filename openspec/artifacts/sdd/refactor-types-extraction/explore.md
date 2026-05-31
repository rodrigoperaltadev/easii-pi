# Explore: Refactor Types Extraction — `@easii/pi`

## Scope

Extract all inline TypeScript types from `extensions/stack-detector.ts` into a dedicated `types/` directory. The goal is to improve maintainability, testability, and reusability of the type system.

**Target file:** `extensions/stack-detector.ts` (1,260 lines)  
**Output dir:** `extensions/types/` (new)  
**No behavioral changes.**

---

## Current State

### Type Inventory

The file defines 16 types/interfaces at the top, before any function:

| # | Name | Kind | Lines | Dependencies |
|---|------|------|-------|--------------|
| 1 | `ProjectProfile` | union | 11 | — |
| 2 | `DetectedStack` | interface | 13 | — |
| 3 | `MarketplaceSkill` | interface | 10 | — |
| 4 | `LocalSkill` | interface | 4 | — |
| 5 | `SkillSuggestion` | union | 1 | `MarketplaceSkill`, `LocalSkill` |
| 6 | `McpServerConfig` | interface | 7 | — |
| 7 | `McpSuggestion` | interface | 8 | `McpServerConfig` |
| 8 | `InferredProjectCommands` | interface | 8 | — |
| 9 | `CapabilityStatus` | union | 4 | — |
| 10 | `ProjectCapability` | interface | 4 | `CapabilityStatus` |
| 11 | `ProjectCapabilities` | interface | 7 | `ProjectCapability` (×6) |
| 12 | `SetupPreferences` | interface | 13 | — |
| 13 | `SetupUi` | interface | 3 | — |
| 14 | `MarketplaceResult` | interface | 10 | — |
| 15 | *(unnamed)* | type alias | 3 | `InferredProjectCommands` |
| 16 | *(unnamed)* | type alias | 1 | `ProjectProfile` |

**Total: ~1,100 lines of inline type definitions** (≈ 87% of file).

### Grouping Opportunity

Types fall into three natural clusters:

```
types/stack.ts      → ProjectProfile, DetectedStack, InferredProjectCommands
types/skills.ts     → MarketplaceSkill, LocalSkill, SkillSuggestion, MarketplaceResult
types/mcp.ts        → McpServerConfig, McpSuggestion
types/capabilities.ts → CapabilityStatus, ProjectCapability, ProjectCapabilities
types/setup.ts      → SetupPreferences, SetupUi
types/index.ts      → barrel export
```

---

## Constraints and Non-Goals

**Constraints:**
- Must remain a single-file extension for Pi runtime compatibility
- Cannot introduce build steps or module resolution changes
- Target: ES2022 + ESNext with `moduleResolution: bundler`

**Non-goals:**
- No refactoring of functions or logic
- No changes to runtime behavior
- No new tests (Vitest is present but no test files exist yet)

---

## Key Findings

### 1. Type Cohesion

`ProjectCapabilities` embeds 6 `ProjectCapability` fields. This could be extracted but keeping it inline avoids circular deps since `ProjectCapability` has no forward refs.

**Decision:** Extract to `types/capabilities.ts`. Keep `ProjectCapabilities` in same file.

### 2. Unnamed Type Aliases

Lines ~310-315 contain two unnamed type aliases:
```typescript
type X = InferredProjectCommands["packageManager"];
type Y = ProjectProfile;
```
These are used as parameter bounds in helper functions. They should be named:
```typescript
type PackageManager = InferredProjectCommands["packageManager"];
type ProfileName = ProjectProfile;
```

### 3. `SetupUi` Interface Coupling

`SetupUi` is defined late (after `buildMinimalOpenspecConfig`) and used as a dependency-injection interface for `confirmOrAbort`. It has only 3 fields and is tightly coupled to the setup flow. Recommendation: extract to `types/setup.ts` alongside `SetupPreferences`.

### 4. Import Surface

Currently, `stack-detector.ts` has **zero external imports** — it only uses `node:fs`, `node:path`, `node:url`, and the Pi ExtensionAPI type. After extraction, `extensions/types/index.ts` will need:
```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export type { ExtensionAPI } from "@earendil-works/pi-coding-agent"; // re-export
```

The extension file will then import types from the local `./types/index.ts`.

### 5. Absolute Path Usage

The file uses `path.join(cwd, ...)` throughout. The `cwd` is injected from the Pi context (`ctx.cwd`). No changes needed here.

### 6. No Circular Dependencies

Type dependency graph is acyclic:
```
ProjectProfile ← DetectedStack ← inferProjectCommands
MarketplaceSkill ← SkillSuggestion
LocalSkill ← SkillSuggestion
McpServerConfig ← McpSuggestion
CapabilityStatus ← ProjectCapability ← ProjectCapabilities
SetupUi ← confirmOrAbort ← runProjectSetup
```

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Breaking type inference in Pi runtime | Low | High | Keep all types `export type`; no runtime code |
| Import path mismatch with Pi bundler | Low | High | Use relative paths (`./types/`) |
| TSConfig `moduleResolution: bundler` | Low | Medium | No path aliases; explicit relative imports |
| Unknown test gap (no tests exist) | Medium | Low | Document that `vitest run` is ready but unused |

---

## Recommendation

Proceed with **spec** phase. Extraction is mechanically safe given:
- Acyclic type dependencies
- No circular import risk
- Zero behavioral change
- Clear grouping into 5 files + barrel

**Next:** Write `proposal.md` with acceptance criteria.