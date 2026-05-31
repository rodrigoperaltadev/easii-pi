# @easii/pi — AGENTS.md

Contexto completo del proyecto para agentes AI (Pi, Cowork, Claude Code, etc).
Creado a partir de la sesión de diseño en Claude Chat — Mayo 2026.

---

## Qué es este proyecto

`@easii/pi` es un paquete Pi de Easii Studio que agrega inteligencia contextual al agente de coding. Detecta el stack tecnológico del proyecto al iniciar sesión y sugiere skills relevantes — primero buscando en marketplaces públicos, luego cayendo a skills propias de calidad garantizada.

**Instalación:**
```bash
pi install npm:@easii/pi
```

**Autor:** rodrigoperaltadev (npm: @easii)
**Licencia:** MIT
**Estado:** v0.2.0 — listo para validar localmente antes de publicar

---

## Contexto técnico: el ecosistema Pi

### Qué es Pi
Pi (`pi.dev`) es un **coding harness mínimo para terminal**. A diferencia de Claude Code o Cursor, Pi no tiene features fijas — todo se agrega como paquetes npm. Es extensible via TypeScript extensions, skills, prompt templates y themes.

### Qué es gentle-pi
`gentle-pi` es el paquete Pi de Gentleman Programming. Agrega una capa de arquitectura senior con:
- **SDD/OpenSpec**: flujo spec-driven (init → explore → proposal → spec → design → tasks → apply → verify → archive)
- **Strict TDD**: evidencia RED → GREEN → TRIANGULATE → REFACTOR
- **Subagent orchestration**: un padre orquesta agentes hijo con contexto separado
- **Skill registry**: `.atl/skill-registry.md` — inventario de skills ya instaladas en el proyecto

### Paquetes companion de gentle-pi que usamos
| Paquete | Función |
|---|---|
| `pi-subagents` | Lanzar agentes hijo para exploración, implementación, revisión |
| `pi-intercom` | Canal de comunicación entre sesión padre e hijos durante ejecución |
| `gentle-engram` | Memoria persistente entre sesiones (SQLite + FTS5 + MCP) |
| `pi-web-access` | Búsqueda web y fetch de URLs para el agente |
| `pi-lens` | Feedback de código en tiempo real: LSP, linters, formatters, type-check |
| `@juicesharp/rpiv-todo` | Lista de tareas persistente con overlay visual |
| `@juicesharp/rpiv-ask-user-question` | Dialog estructurado para que el agente pregunte en lugar de adivinar |

### Estructura de un paquete Pi
```json
// package.json
{
  "name": "@scope/pi-package",
  "keywords": ["pi-package"],
  "pi": {
    "extensions": ["./extensions"],
    "skills": ["./skills"],
    "prompts": ["./prompts"]
  },
  "peerDependencies": {
    "@earendil-works/pi-coding-agent": "*"
  },
  "publishConfig": { "access": "public" }
}
```

### Cómo funciona una extensión Pi
```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    // cwd del proyecto, ui para notificar al usuario
    ctx.ui.notify("Mensaje", "info");
  });

  pi.registerCommand("mi-comando", {
    description: "Descripción del comando",
    handler: async (args, ctx) => { ... },
  });
}
```

### Cómo funciona una skill Pi
```
skills/
└── mi-skill/
    └── SKILL.md    ← frontmatter (name, description) + instrucciones markdown
```
Las skills siguen el estándar open `agentskills.io` — son portables entre Pi, Claude Code, Codex, Cursor y más. Pi solo carga la descripción en el contexto; el contenido completo se carga on-demand cuando el agente lo necesita.

---

## Qué hace @easii/pi

### 1. Stack Detector (`extensions/stack-detector.ts`)
Se ejecuta en `session_start`. Lee `package.json` del proyecto y detecta el perfil:

| Perfil detectado | Condición |
|---|---|
| `react-native-expo` | dep: `expo` |
| `react-native-bare` | dep: `react-native` (sin expo) |
| `nextjs` | dep: `next` |
| `react-web` | dep: `react` (sin RN) |
| `gamedev-phaser` | dep: `phaser` |
| `gamedev-pixi` | dep: `pixi.js` |
| `npm-library` | tiene `types` o `files`, sin react ni `main` |
| `node-backend` | tiene `main`, sin react |

También detecta: TypeScript, Expo Router, EAS Build, framework de tests (jest/vitest), E2E (maestro/detox/playwright), state management (zustand/redux/jotai/mobx/react-query).

**Flujo de sugerencia de skills:**
1. Busca en `openagentskill.com/api/agent/skills?q=...` (API pública, sin auth)
2. Filtra por calidad mínima: `downloads >= 500` y `rating >= 3.5`
3. Si hay resultados útiles → sugiere marketplace + completa con skills locales no cubiertas
4. Si no hay resultados → usa skills locales de `@easii/pi` como fallback

Comando manual: `/easii:stack`

### 2. Skills incluidas (propias de Easii)
Cubren el gap que hoy no existe en los marketplaces públicos para mobile:

- **`expo`** — EAS Build, managed vs bare, Expo Router, permisos, gotchas del SDK
- **`react-native`** — testing patterns (Jest + TLRN), arquitectura screen/view, FlatList performance, diferencias iOS/Android
- **`rn-e2e-maestro`** — cuándo usar E2E vs unit tests, flujo de flows, testID conventions, sub-flows reutilizables. Solo se sugiere automáticamente cuando Maestro está detectado (`@maestro/cli` o `.maestro/`).

### 3. Schema `rn-feature` (en `assets/schemas/rn-feature/`)
Flujo SDD customizado para features de React Native. Templates que incluyen:
- Consideraciones de plataforma (iOS/Android) desde la propuesta
- Estrategia de testing (unit + E2E opcional) en el diseño técnico
- Tasks separadas por sección: setup, lógica, UI, unit tests, E2E (opcional), PR

**Instalación manual del schema en un proyecto:**
```bash
cp -r assets/schemas/rn-feature openspec/schemas/
```
Y en `openspec/config.yaml`:
```yaml
schema: rn-feature
```

---

## Decisiones de diseño tomadas

### ¿Por qué un paquete único en lugar de separar por dominio?
El stack-detector ya discrimina por perfil internamente. Separar en `@easii/pi-frontend`, `@easii/pi-gamedev`, etc. solo complica el mantenimiento. Si el paquete crece demasiado, se puede separar en v3+.

### ¿Por qué no crear solo skills propias?
Los marketplaces de AgentSkills tienen miles de skills. Para stacks genéricos (React, TypeScript, Node), ya hay skills con miles de descargas. No tiene sentido duplicarlas. Las skills propias de `@easii/pi` son el fallback para el gap real: **mobile y Expo**, donde el ecosistema todavía no llega.

### ¿Por qué openagentskill.com como fuente del marketplace?
Tiene una API REST pública sin autenticación, bien documentada, con filtros por calidad. Endpoint usado: `GET /api/agent/skills?q=...&sort=quality&format=json`. Sin rate limits declarados para lectura.

### ¿Qué es el skill registry de gentle-pi vs las sugerencias de @easii/pi?
- **gentle-pi skill registry** → inventario de skills *ya instaladas* en disco
- **@easii/pi stack detector** → recomendador de skills que *todavía no tenés* basado en el stack

Son complementarios. gentle-pi asegura que no olvides cargar las skills que ya instalaste. @easii/pi te dice cuáles instalar.

---

## Roadmap

### v0.1.0 (base — scaffold)
- [x] Stack detector con búsqueda en marketplace + fallback local
- [x] Skills: expo, react-native, rn-e2e-maestro
- [x] Schema rn-feature con templates

### v0.2.0 (actual — listo para validar)
- [x] Integración con `/sdd-init`: pre-poblar `openspec/config.yaml` con stack detectado, bloque `easii`, comandos de test/typecheck inferidos
- [x] Comando interactivo `/easii:setup-project` que explica, pregunta en bloque por recomendaciones de capacidades faltantes aplicables (strict TDD, E2E, CI/CD, Docker), guarda preferencias y copia el schema correcto al proyecto
- [x] Sugerencia de MCPs relevantes (Expo MCP, Supabase MCP, etc.) según deps detectadas
- [x] Auditoría read-only de capacidades: unit tests, E2E, strict TDD, CI, CD/deploy y Docker cuando aplica

### v0.3.0 (futuro)
- [ ] **Especialidades / playbooks** — bundles por perfil (skills + MCPs + schema + arquitectura + testing). Ver [`docs/future/specialties-playbooks.md`](docs/future/specialties-playbooks.md)
- [ ] Skills: nextjs, react-web
- [ ] Schema: rn-library (librería npm)
- [ ] Soporte gamedev: Phaser skill + schema gamedev

### v0.4.0+ (futuro — harnesses de inception/producto)
- [ ] **`/easii:new-project`** — preguntas guiadas para crear un Project Blueprint antes de scaffold. Ver [`docs/future/project-inception-requirements-harnesses.md`](docs/future/project-inception-requirements-harnesses.md)
- [ ] **`/easii:requirements`** — convertir requerimientos de cliente en casos de uso, historias, criterios de aceptación y primer slice SDD.

### No entra nunca (ya cubierto por otros paquetes)
- Memoria entre sesiones → gentle-engram
- Todo tracking → rpiv-todo
- Subagent orchestration → pi-subagents + pi-intercom
- Preguntas estructuradas al usuario → rpiv-ask-user-question

---

## Estructura del repo

```
@easii/pi/
├── AGENTS.md                          ← este archivo
├── package.json                       ← Pi manifest + publishConfig public
├── tsconfig.json
├── README.md
├── .gitignore
│
├── extensions/
│   └── stack-detector.ts              ← detección + búsqueda marketplace + fallback
│
├── skills/
│   ├── expo/SKILL.md
│   ├── react-native/SKILL.md
│   └── rn-e2e-maestro/SKILL.md
│
└── assets/
    └── schemas/
        └── rn-feature/
            ├── schema.yaml
            └── templates/
                ├── proposal.md
                ├── specs.md
                ├── design.md
                └── tasks.md

docs/
└── future/
    ├── specialties-playbooks.md                       ← diseño pendiente: especialidades por stack
    └── project-inception-requirements-harnesses.md    ← diseño pendiente: new-project + requirements
```

---

## Cómo trabajar en este proyecto

### Probar localmente sin publicar
```bash
# Desde la raíz del repo
pi install .

# O probar la extensión sola sin instalar
pi -e ./extensions/stack-detector.ts

# Verificar TypeScript
npx tsc --noEmit
```

### Publicar a npm
```bash
npm publish   # publishConfig.access: "public" ya está seteado
```

### Convención de commits
```
feat: descripción
fix: descripción
skill: nombre-skill — descripción
schema: nombre-schema — descripción
```

---

## Marketplaces de AgentSkills

El estándar `SKILL.md` es adoptado por 18+ plataformas. Links útiles:

- **agentskills.io** — especificación oficial del estándar
- **openagentskill.com** — marketplace con API pública (el que usamos)
- **agenticskills.io** — 173+ skills verificadas, `npx skills add autor/skill`
- **lobehub.com/skills** — marketplace grande con reviews de agentes
- **skillsmp.com** — búsqueda masiva, 1.2M+ skills indexadas
- **github.com/anthropics/skills** — skills oficiales de Anthropic
- **github.com/vercel/agent-skills** — skills de Vercel Labs (react-best-practices, etc.)

---

## Notas importantes para el agente

- Este proyecto es un **paquete Pi**, no una app. No tiene build step — Pi compila TypeScript on-the-fly.
- Las skills son **archivos markdown**, no código. Su valor está en el conocimiento que contienen.
- El stack-detector usa `fetch` nativo de Node 18+. No requiere deps externas.
- El timeout del marketplace es 4 segundos. Si falla, cae silenciosamente al fallback local.
- Al publicar skills propias al marketplace (`openagentskill.com/api/skills/submit`), el repo necesita al menos 3 estrellas en GitHub.
- `publishConfig.access: "public"` en package.json es obligatorio para paquetes `@scoped` en npm free tier.
