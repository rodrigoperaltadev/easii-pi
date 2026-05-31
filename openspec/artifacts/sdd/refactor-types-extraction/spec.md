# SDD Spec: Refactor Types Extraction — `@easii/pi`

**Change ID:** `refactor-types-extraction`  
**Phase:** spec  
**Date:** 2026-05-30  
**Status:** Specified

---

## 1. Type Dependency Graph

```
ProjectProfile  (union — base type, no deps)
  ├── DetectedStack  (interface)
  │     ├── inferProjectCommands()
  │     ├── detectStack()
  │     ├── getMarketplaceQueries()
  │     ├── getLocalFallbacks()
  │     ├── buildMcpSuggestions()
  │     ├── getMcpCatalog()
  │     ├── detectCapabilities()
  │     ├── profileSupportsE2e()
  │     ├── recommendedE2eTool()
  │     ├── buildReport()
  │     ├── buildStackContextLines()
  │     ├── runProjectSetup()
  │     └── SCHEMA_BY_PROFILE
  ├── PROFILE_LABELS  (Record<ProjectProfile, string>)
  ├── dockerApplies()  ← uses ProfileName alias → ProjectProfile
  └── RunProjectSetupBlockBuilder  ← uses ProfileName alias → ProjectProfile

InferredProjectCommands  (interface — base type, no deps)
  ├── detectPackageManager()  ← returns PackageManager alias → ["packageManager"]
  ├── commandForScript()
  ├── commandForBinary()
  ├── inferProjectCommands()
  ├── buildStackContextLines()
  ├── applyDetectedSddHints()
  ├── collectSetupPreferences()
  └── applyStrictTddPreference()

MarketplaceSkill  (interface — base type, no deps)
  └── SkillSuggestion  (union)
        └── buildSuggestions()

LocalSkill  (interface — base type, no deps)
  └── SkillSuggestion  (union)
        ├── getLocalFallbacks()
        └── buildSuggestions()

MarketplaceResult  (interface — base type, no deps)
  └── searchMarketplace()

McpServerConfig  (interface — base type, no deps)
  └── McpSuggestion  (interface)
        ├── formatMcpEntry()
        ├── getMcpCatalog()
        └── buildMcpSuggestions()

CapabilityStatus  (union — base type, no deps)
  └── ProjectCapability  (interface)
        └── ProjectCapabilities  (interface)
              ├── detectStrictTdd()
              ├── detectCapabilities()
              ├── formatCapability()
              └── collectSetupPreferences()

SetupUi  (interface — base type, no deps)
  └── confirmOrAbort()
        ├── applyDetectedSddHints()
        ├── ensureSchemaInConfig()
        └── runProjectSetup()

SetupPreferences  (interface — base type, no deps)
  ├── buildSetupPreferencesLines()
  ├── applyDetectedSddHints()
  ├── collectSetupPreferences()
  └── applyStrictTddPreference()
```

**No circular dependencies.** All edges go downward in the above graph.

---

## 2. Target File Structure

```
extensions/
├── stack-detector.ts        ← refactored: imports from ./types/index.ts
└── types/
    ├── index.ts             ← barrel export
    ├── stack.ts             ← ProjectProfile, DetectedStack, InferredProjectCommands
    ├── skills.ts            ← MarketplaceSkill, LocalSkill, SkillSuggestion, MarketplaceResult
    ├── mcp.ts               ← McpServerConfig, McpSuggestion
    ├── capabilities.ts      ← CapabilityStatus, ProjectCapability, ProjectCapabilities
    └── setup.ts             ← SetupPreferences, SetupUi
```

---

## 3. Naming Conventions

| Convention | Rule |
|---|---|
| File name | `kebab-case` matching the domain: `stack.ts`, `skills.ts`, `mcp.ts`, `capabilities.ts`, `setup.ts` |
| Type exports | Named exports only (no `export type *`). Grouped by domain. |
| Named aliases | Named when replacing unnamed bounds: `PackageManager`, `ProfileName` |
| Pi API type | Re-exported from `@earendil-works/pi-coding-agent` in `index.ts` as `export type { ExtensionAPI }` |

---

## 4. Import/Export Plan

### `extensions/types/index.ts` — barrel export

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

// skills
export type {
  MarketplaceSkill,
  LocalSkill,
  SkillSuggestion,
  MarketplaceResult,
} from "./skills.js";

// mcp
export type { McpServerConfig, McpSuggestion } from "./mcp.js";

// capabilities
export type {
  CapabilityStatus,
  ProjectCapability,
  ProjectCapabilities,
} from "./capabilities.js";

// setup
export type { SetupPreferences, SetupUi } from "./setup.js";
```

### `extensions/stack-detector.ts` — after refactor

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// All types from barrel — no inline type blocks remain at top level
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

## 5. Type Definitions (verbatim)

All definitions are copied verbatim from `extensions/stack-detector.ts`. No implementation details included — only type declarations.

### `extensions/types/stack.ts`

```typescript
/**
 * Project profile labels for display in reports.
 * @see PROFILE_LABELS in stack-detector.ts
 */
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

/**
 * Detected project stack metadata.
 * Populated by detectStack() from package.json and filesystem checks.
 */
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

/**
 * Inferred project build/test commands per detected stack.
 * Populated by inferProjectCommands() from package.json scripts and lockfile detection.
 */
export interface InferredProjectCommands {
	packageManager: "npm" | "pnpm" | "yarn" | "bun";
	testCommand: string;
	unitCommand: string;
	e2eCommand: string;
	typecheckCommand: string;
	lintCommand: string;
	formatCommand: string;
}

/**
 * Bounded type for package manager values.
 * Alias for InferredProjectCommands["packageManager"].
 * Used as parameter bound in detectPackageManager(), commandForScript(), commandForBinary().
 */
export type PackageManager = InferredProjectCommands["packageManager"];

/**
 * Bounded type for project profile names.
 * Alias for ProjectProfile.
 * Used as parameter bound in dockerApplies() and runProjectSetupBlockBuilder().
 */
export type ProfileName = ProjectProfile;
```

### `extensions/types/skills.ts`

```typescript
/**
 * A skill sourced from the openagentskill.com marketplace.
 * Populated by searchMarketplace() from the API response.
 */
export interface MarketplaceSkill {
	name: string;
	slug: string;
	installCmd: string;
	downloads: number;
	rating: number;
	description: string;
	source: "marketplace";
}

/**
 * A skill bundled with @easii/pi as local fallback knowledge.
 * Populated by getLocalFallbacks() based on detected profile.
 */
export interface LocalSkill {
	skillName: string;
	reason: string;
	source: "local";
}

/**
 * Union of skill suggestion sources.
 * @see buildSuggestions()
 */
export type SkillSuggestion = MarketplaceSkill | LocalSkill;

/**
 * Raw API response item from openagentskill.com/api/agent/skills.
 * Contains snake_case and camelCase variants of the same fields.
 * @see searchMarketplace()
 */
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

### `extensions/types/mcp.ts`

```typescript
/**
 * Configuration entry for a Model Context Protocol server.
 * Maps to the mcpServers schema in .mcp.json / .pi/mcp.json.
 */
export interface McpServerConfig {
	command?: string;
	args?: string[];
	url?: string;
	env?: Record<string, string>;
	lifecycle?: "lazy" | "eager" | "keep-alive";
}

/**
 * A suggested MCP server to add to the project config.
 * Produced by getMcpCatalog() and filtered by buildMcpSuggestions().
 */
export interface McpSuggestion {
	serverKey: string;
	name: string;
	reason: string;
	config: McpServerConfig;
	setupHint?: string;
}
```

### `extensions/types/capabilities.ts`

```typescript
/**
 * Capability audit status for a single project capability.
 * @see detectCapabilities()
 */
export type CapabilityStatus =
	| "configured"
	| "detected-partial"
	| "missing"
	| "not-applicable";

/**
 * Single capability record with status, summary, and optional details.
 * @see detectCapabilities()
 */
export interface ProjectCapability {
	status: CapabilityStatus;
	summary: string;
	details?: string[];
}

/**
 * Full capability audit for a project (read-only).
 * Covers unit tests, E2E, strict TDD, CI, CD/deploy, and Docker.
 * Populated by detectCapabilities().
 */
export interface ProjectCapabilities {
	unitTests: ProjectCapability;
	e2eTests: ProjectCapability;
	strictTdd: ProjectCapability;
	ci: ProjectCapability;
	cd: ProjectCapability;
	docker: ProjectCapability;
}
```

### `extensions/types/setup.ts`

```typescript
/**
 * User preferences for project setup collected in collectSetupPreferences().
 * Stored in the easii.setup_preferences block of openspec/config.yaml.
 */
export interface SetupPreferences {
	strictTdd: "configured" | "enable" | "skip" | "missing-runner";
	e2e:
		| "configured"
		| "detected-partial"
		| "recommended"
		| "skip"
		| "not-applicable";
	ci: "configured" | "detected-partial" | "recommended" | "skip";
	cd: "configured" | "detected-partial" | "recommended" | "skip";
	docker:
		| "configured"
		| "detected-partial"
		| "recommended"
		| "skip"
		| "not-applicable";
}

/**
 * UI interface injected by the Pi runtime into setup commands.
 * Provides optional confirm() and required notify().
 * Used as dependency injection in confirmOrAbort().
 */
export interface SetupUi {
	confirm?: (title: string, message: string) => Promise<boolean>;
	notify: (message: string, level: "info" | "warning" | "error") => void;
}
```

---

## 6. Edge Cases and Special Handling

### 6.1 Named aliases for unnamed type bounds

Two type aliases exist in the current file without explicit names:

```typescript
// At line ~310 — replace with named alias PackageManager
type X = InferredProjectCommands["packageManager"];

// At line ~315 — replace with named alias ProfileName
type Y = ProjectProfile;
```

Both must be named (`PackageManager`, `ProfileName`) before extraction. They appear as parameter bounds for `detectPackageManager`, `commandForScript`, `commandForBinary`, `dockerApplies`, and `runProjectSetupBlockBuilder`.

### 6.2 `MarketplaceResult` field name variants

The API returns `install_command` (snake_case) and the codebase uses `installCommand` (camelCase). The `MarketplaceResult` interface handles both as optional fields. No change needed to this handling.

### 6.3 `ExtensionAPI` re-export

`stack-detector.ts` imports `ExtensionAPI` from `@earendil-works/pi-coding-agent` at the top. After extraction, `types/index.ts` re-exports it:

```typescript
export type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
```

The `stack-detector.ts` import line changes from:
```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
```
to a re-export from `./types/index.js` — but only if `ExtensionAPI` is used in `stack-detector.ts`. (It is used as the parameter type `pi: ExtensionAPI` in the extension entry.) The `ExtensionAPI` should stay imported from the original package in `stack-detector.ts`, not from `./types/index.js`, since it is the source of truth and not a type we defined. The `types/index.ts` re-exports it for external consumers of the types package.

### 6.4 No function signatures in types/

Zero runtime code moves. All functions stay in `stack-detector.ts`. Types are pure `export type` / `export interface`.

### 6.5 `SetupUi` injected interface

`SetupUi` is an injected interface used only in function signatures within `stack-detector.ts`. It should be exported as-is with no changes to its 3-field shape.

### 6.6 `PROFILE_LABELS` constant

`PROFILE_LABELS: Record<ProjectProfile, string>` is a runtime constant, not a type. It stays in `stack-detector.ts`.

### 6.7 `MarketplaceSkill.source` literal

The `source: "marketplace" as const` in `searchMarketplace()` maps from `MarketplaceResult` to `MarketplaceSkill`. This is runtime logic and stays in `stack-detector.ts`. The `source` field type declaration `"marketplace"` in `MarketplaceSkill` interface is correct as-is.

---

## 7. Verification Checklist

Aligned with proposal acceptance criteria:

- [ ] `npx tsc --noEmit` passes with no errors
- [ ] `pi dev` or `pi install .` loads the extension without import errors
- [ ] All 16 original types are present in `extensions/types/`:
  - [ ] `ProjectProfile` (stack.ts)
  - [ ] `DetectedStack` (stack.ts)
  - [ ] `InferredProjectCommands` (stack.ts)
  - [ ] `PackageManager` alias (stack.ts)
  - [ ] `ProfileName` alias (stack.ts)
  - [ ] `MarketplaceSkill` (skills.ts)
  - [ ] `LocalSkill` (skills.ts)
  - [ ] `SkillSuggestion` (skills.ts)
  - [ ] `MarketplaceResult` (skills.ts)
  - [ ] `McpServerConfig` (mcp.ts)
  - [ ] `McpSuggestion` (mcp.ts)
  - [ ] `CapabilityStatus` (capabilities.ts)
  - [ ] `ProjectCapability` (capabilities.ts)
  - [ ] `ProjectCapabilities` (capabilities.ts)
  - [ ] `SetupPreferences` (setup.ts)
  - [ ] `SetupUi` (setup.ts)
- [ ] All 16 types re-exported via `extensions/types/index.ts` barrel
- [ ] `extensions/stack-detector.ts` contains zero top-level `type`, `interface`, or `type X =` declarations (only function-body-scoped types if any)
- [ ] `PackageManager` and `ProfileName` named aliases exist and replace the two unnamed bounds
- [ ] No circular imports introduced
- [ ] Diff ≤ 300 changed lines (deletions + additions)
- [ ] Pi extension registers `session_start`, `easii:stack`, and `easii:setup-project` as before
- [ ] Runtime behavior unchanged (same output for same input stack)

---

## 8. Phase Gate

This spec is complete and ready for the **design** phase. All type definitions are verbatim copies. The dependency graph is acyclic. Naming conventions are established. The import/export plan uses only relative paths compatible with `moduleResolution: bundler`.