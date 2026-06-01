# @easii/pi

**Stack detector for Pi: suggests skills, MCPs and SDD schemas for your project.**

Pi package from [Easii Studio](https://github.com/easii-studio) that automatically detects your project tech stack and suggests relevant skills, MCPs and SDD flows.

## Standalone or with gentle-pi?

**Works standalone with vanilla Pi.** No dependencies required.

Gentle-pi adds SDD/OpenSpec workflows on top. @easii/pi integrates with it by:
- Pre-populating `openspec/config.yaml` with detected stack hints when `/sdd-init` runs
- Suggesting the `rn-feature` schema for React Native projects
- Providing capability audit that gentle-pi can forward to its skill registry

If you use gentle-pi:
```bash
pi install npm:@easii/pi npm:gentle-pi
```

If you use vanilla Pi:
```bash
pi install npm:@easii/pi
```

## Installation

```bash
pi install npm:@easii/pi
```

### Recommended companions (optional)

```bash
pi install npm:gentle-engram                # persistent memory across sessions
pi install npm:@juicesharp/rpiv-ask-user-question  # structured dialogs
```

## What it includes

### Stack Detector

On session_start, the package reads your `package.json` and detects the project profile. By default, it shows a one-liner only on the first session or when the stack changes. Use `/easii:stack` for the full report.

| Profile | Trigger |
|---------|---------|
| `react-native-expo` | `expo` dependency |
| `react-native-bare` | `react-native` without expo |
| `nextjs` | `next` dependency |
| `react-web` | `react` without RN |
| `node-backend` | `main` field, no react |
| `npm-library` | `types` or `files` field |
| `gamedev-phaser` | `phaser` dependency |
| `gamedev-pixi` | `pixi.js` dependency |
| `unknown` | none of the above |

Manual re-run:

```
/easii:stack
```

### Built-in skills

| Skill | When |
|-------|------|
| `expo` | Expo SDK, EAS Build, Expo Router, managed/bare |
| `react-native` | Testing, components, performance, iOS/Android differences |
| `rn-e2e-maestro` | E2E flows; only suggested if `@maestro/cli` or `.maestro/` exists |

```
/skill:expo
/skill:react-native
/skill:rn-e2e-maestro
```

### Suggested MCPs

`/easii:stack` suggests MCPs based on your deps and avoids duplicates in `.mcp.json` / `.pi/mcp.json`.

| Trigger | MCP |
|---------|-----|
| Expo | Expo MCP |
| `@supabase/*` | Supabase MCP |
| Playwright | Playwright MCP |
| Prisma / Postgres deps | PostgreSQL MCP |
| Firebase | Firebase MCP |
| Stripe | Stripe MCP |
| Next / React / Node | Context7 MCP |

## Schema `rn-feature` and SDD setup

SDD flow tailored for React Native features:

```
proposal → specs → design → tasks → apply
```

Includes:
- Platform considerations (iOS/Android)
- Testing strategy (unit + optional E2E)
- PR checklist

For React Native / Expo projects:

```
/easii:setup-project
```

This command:
1. Shows interactive summary, asks confirmation
2. If confirmed, asks about missing capabilities (strict TDD, E2E, CI/CD, Docker)
3. Copies `assets/schemas/rn-feature/` → `openspec/schemas/rn-feature/`
4. Sets `schema: rn-feature` in `openspec/config.yaml`
5. Adds managed block with detected stack and setup preferences for `/sdd-init`
6. Infers `test_command`, E2E, typecheck, lint and format when scripts exist

## Commands

| Command | What |
|---------|------|
| `/easii:stack` | Detect stack, audit capabilities, suggest skills/MCPs |
| `/easii:setup-project` | Configure OpenSpec for RN/Expo with `rn-feature` schema and hints for `/sdd-init` |

## Usage examples

### `/easii:stack` output

```
[@easii/pi] Stack detected: React Native + Expo
  ✓ TypeScript
  ✓ Expo Router
  ✓ EAS Build
  ✓ Tests: vitest

Detected capabilities — read-only
  ✓ Unit tests: configured → vitest
  ✓ E2E: configured → maestro test
  ~ Strict TDD: detected without clear checks
  ✓ CI: configured with quality checks
  ~ CD/deploy: platform file detected

Suggested skills — already applicable to this stack
  → [marketplace] @expo/expo-hog   ★4.8  (12,400 installs)
     Install: npx skills add expo/expo-hog
     Expo-specific linting, type checking, and best practices

  → [@easii/pi] /skill:expo  — Expo SDK, EAS Build, Expo Router, managed/bare
  → [@easii/pi] /skill:react-native  — Testing, components, performance, iOS/Android differences

Suggested MCPs — entries for mcpServers in .mcp.json or .pi/mcp.json
  → Expo MCP  — SDK docs, simulator and local Expo flows
     { "command": "npx", "args": ["-y", "expo-mcp@latest"], "lifecycle": "lazy" }
     Tip: with pi-mcp-adapter, use /mcp setup to import existing configs.
```

### `/easii:setup-project` interaction

```
/easii:setup-project

[@easii/pi] OpenSpec setup for React Native + Expo

Current state:
  schema: not configured
  test_command: "vitest"
  e2e: maestro detected (maestro test)
  typecheck: "npx tsc --noEmit"
  strict_tdd: not configured (available to enable)
  ci: github workflows detected

Recommendations for your profile:
  • strict_tdd: enable (vitest detected, not configured in openspec/config.yaml)
  • e2e: keep maestro (already detected)
  • ci: keep github workflows (already configured)
  • cd: pending (no deploy workflow detected)

Configure OpenSpec? [y/N]:
```

### Skills auto-suggested by stack

When your project has Expo:

```
Suggested skills — already applicable to this stack
  → [@easii/pi] /skill:expo  — Expo SDK, EAS Build, Expo Router, managed/bare
  → [@easii/pi] /skill:react-native  — Testing, components, performance, iOS/Android differences
```

When Maestro is detected:

```
  → [@easii/pi] /skill:rn-e2e-maestro  — E2E flows with Maestro detected in the project
```

### Capabilities read-only audit

```
Detected capabilities — read-only
  ✓ Unit tests: configured → vitest run
     (vitest detected via script)

  ✓ E2E: configured → maestro test
     (maestro detected via script)

  ~ Strict TDD: detected without clear checks

  ✓ CI: configured with quality checks

  ~ CD/deploy: platform file detected

  – Docker: not evaluated for this profile
     (not applicable for react-native-expo)
```

## Verbosity

By default, @easii/pi runs silently on session_start and shows a one-liner only when the stack changes. Full output is on-demand via `/easii:stack`.

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

### Backward compatibility

To restore the old behavior (full dump on every session):

```json
{
  "easii": {
    "verbosity": "full"
  }
}
```

## Development

```bash
# Install locally for testing
pi install .

# Test extension without installing
pi -e ./extensions/stack-detector.ts

# TypeScript check
npx tsc --noEmit

# Preview what would be published to npm
npm pack --dry-run
```

## Contributing

Issues and PRs welcome at [github.com/easii-studio/pi](https://github.com/easii-studio/pi).

## License

MIT — Easii Studio