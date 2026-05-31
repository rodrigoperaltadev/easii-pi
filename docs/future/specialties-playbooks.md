# Especialidades / Playbooks — diseño para implementación futura

> **Estado:** diseño acordado, no implementado.  
> **Decisión (2026-05-30):** posponer implementación; documentar acá para v0.3+.

---

## Problema que resuelve

Hoy `@easii/pi` sugiere **skills**, **MCPs** y **schema SDD** por separado. El dev recibe piezas sueltas pero no un **playbook coherente** por tipo de proyecto.

Las especialidades agrupan recomendaciones en bundles accionables sin duplicar el contenido profundo de las skills ni el flujo SDD de gentle-pi.

---

## Modelo mental

```text
Detector (stack) → Especialidad (playbook) → Skills / MCPs / Schema / hints
                         ↓
                  Comandos siguientes (/easii:setup-project, /sdd-new)
                         ↓
                  Skills cargan detalle on-demand
                         ↓
                  SDD ejecuta el cambio concreto
```

| Capa | Responsabilidad | Formato |
|------|-----------------|---------|
| **Especialidad** | Qué bundle aplica, checklist corto, next steps | 5–10 líneas en reporte |
| **Skill** | Cómo hacerlo bien (Expo, RN, Maestro…) | `SKILL.md` on-demand |
| **SDD** | Spec/design/tasks del feature actual | artifacts OpenSpec |

---

## Qué incluye una especialidad

```typescript
interface Specialty {
  id: string;                    // ej. "mobile-feature"
  name: string;                  // ej. "Mobile Feature (Expo/RN)"
  profiles: ProjectProfile[];    // cuándo aplica

  // Referencias (no duplicar contenido)
  skills: string[];              // skill names locales o marketplace queries
  mcpServerKeys: string[];       // keys del catálogo MCP existente
  sddSchema?: string;            // ej. "rn-feature"

  // Hints cortos (checklist, no treatise)
  architecture: string[];        // 3–5 bullets
  testing: string[];             // unit / E2E strategy
  piPackages?: string[];         // companions opcionales (gentle-pi, pi-lens…)

  nextSteps: string[];           // comandos concretos
}
```

---

## Playbooks propuestos (v1)

### `mobile-feature`

**Perfiles:** `react-native-expo`, `react-native-bare`

| Campo | Valor |
|-------|-------|
| Skills | `expo`, `react-native`, `rn-e2e-maestro` (si E2E) |
| MCPs | `expo`, `supabase` (si `@supabase/*`) |
| Schema SDD | `rn-feature` |
| Arquitectura | Screen → View → components; feature folders; navigation centralizada; permisos nativos en proposal |
| Testing | Unit: Jest + Testing Library; E2E: Maestro solo en flows críticos; `testID` en elementos interactivos |
| Pi packages | `gentle-pi`, `pi-lens` (TS), `pi-mcp-adapter` |
| Next steps | `/easii:setup-project` → `/sdd-new <feature>` |

### `web-app-feature` (v0.3+, cuando existan skills)

**Perfiles:** `nextjs`, `react-web`

| Campo | Valor |
|-------|-------|
| Skills | marketplace: nextjs / react best practices |
| MCPs | `context7`, Playwright (si E2E) |
| Schema SDD | TBD (schema web-feature) |
| Arquitectura | Feature folders o app router segments; server vs client components (Next); colocation de state |
| Testing | Vitest/Jest unit; Playwright E2E en flows críticos |
| Next steps | `/sdd-init` → `/sdd-new` |

### `api-service` (v0.3+)

**Perfiles:** `node-backend`

| Campo | Valor |
|-------|-------|
| MCPs | `postgres`, `supabase`, `stripe` (según deps) |
| Arquitectura | routes → services → repos; validation en boundary; DTOs tipados |
| Testing | Unit en services; integration en routes (supertest o similar) |

### `gamedev-feature` (v0.4+)

**Perfiles:** `gamedev-phaser`, `gamedev-pixi`

| Campo | Valor |
|-------|-------|
| Skills | TBD (phaser / pixi) |
| Schema SDD | TBD (gamedev schema) |
| Arquitectura | Scene/state separation; asset pipeline; game loop vs UI layer |

---

## Qué NO incluir en especialidades

- Texto largo de arquitectura (va en skills o SDD design)
- Auto-instalar paquetes, skills o MCPs (Pi no tiene API de install unificada)
- Elegir state management por el dev (máximo hint si ya detectamos uno)
- Duplicar flujo SDD de gentle-pi
- Scaffolding agresivo de carpetas sin confirmación del usuario

---

## UX propuesta

### Opción A — sección en `/easii:stack` (recomendada para v1)

Agregar al final del reporte existente:

```text
Especialidad sugerida: mobile-feature
  Arquitectura: Screen/View · feature folders · testID conventions
  Testing: Jest unit · Maestro E2E (opcional, flows críticos)
  Siguiente: /easii:setup-project → /sdd-new <nombre>
```

`session_start` **no** debería incluir la especialidad completa (notify ya es denso). Solo stack + skills + MCPs, o un one-liner con link a `/easii:stack`.

### Opción B — comando dedicado

`/easii:specialty` — reporte completo del playbook sin marketplace search (más rápido).

---

## Implementación técnica (cuando toque)

1. **Archivo:** `extensions/specialties.ts` o sección en `stack-detector.ts`
2. **Mapa estático:** `SPECIALTIES: Specialty[]` + `resolveSpecialty(stack): Specialty | null`
3. **Integración:** `buildReport()` recibe specialty opcional; `getMcpCatalog` y `getLocalFallbacks` ya cubren parte del bundle
4. **Tests:** fixture `package.json` por perfil → specialty esperada (cuando haya test runner)

### Dependencias previas

- [x] MCP suggestions (`buildMcpSuggestions`)
- [x] `/easii:setup-project` + schema mapping
- [ ] Integración `/sdd-init` (pre-poblar `test_command` y context)
- [ ] Skills web (nextjs, react-web) para `web-app-feature`
- [ ] Schemas adicionales para web/gamedev

---

## Roadmap sugerido

| Versión | Entrega |
|---------|---------|
| **v0.2.x** | Cerrar `/sdd-init` integration (context + testing en config.yaml) |
| **v0.3.0** | Especialidad `mobile-feature` en `/easii:stack` + `/easii:specialty` |
| **v0.3.x** | `web-app-feature` cuando existan skills + schema |
| **v0.4.0** | `gamedev-feature`; scaffolding opcional con confirm |

---

## Referencias en el repo

- Detección de stack: `extensions/stack-detector.ts`
- MCP catalog: `getMcpCatalog()` en el mismo archivo
- Schema SDD mobile: `assets/schemas/rn-feature/`
- Skills locales: `skills/expo/`, `skills/react-native/`, `skills/rn-e2e-maestro/`
