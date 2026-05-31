# @easii/pi

**Stack-aware Pi harness para frontend, mobile y game development.**

Paquete Pi de [Easii Studio](https://github.com/easii-studio) que detecta automáticamente el stack tecnológico de tu proyecto y sugiere skills, MCPs y flujos SDD relevantes.

## Instalación

```bash
pi install npm:@easii/pi
```

### Compañeros recomendados

```bash
pi install npm:gentle-pi          # harness SDD base (opcional pero recomendado)
pi install npm:gentle-engram      # memoria persistente entre sesiones
pi install npm:@juicesharp/rpiv-ask-user-question
```

## Qué incluye

### Stack Detector

En cada `session_start`, el paquete lee el `package.json` del proyecto y detecta:

- **React Native + Expo** → activa skills de Expo, RN y E2E
- **React Native bare** → activa skill de RN
- **Next.js** → (próximamente)
- **Videojuegos (Phaser/PixiJS)** → (próximamente)

Podés re-correr la detección manualmente con:

```
/easii:stack
```

El reporte incluye:

- perfil detectado con jerarquía visual por color
- capacidades read-only: unit tests, E2E, strict TDD, CI, CD/deploy y Docker cuando aplica
- skills sugeridas desde marketplace + fallback local, solo cuando aplican al stack detectado
- MCPs sugeridos según dependencias/config real del proyecto
- hints de testing y E2E cuando el proyecto los expone

### Skills incluidas

| Skill | Cuándo se usa |
|---|---|
| `expo` | Proyectos con Expo SDK, EAS Build, Expo Router |
| `react-native` | Testing RN, componentes, performance, diferencias iOS/Android |
| `rn-e2e-maestro` | Flujos E2E; solo se sugiere si existen `@maestro/cli` o `.maestro/` |

Cargar una skill manualmente:

```
/skill:expo
/skill:react-native
/skill:rn-e2e-maestro
```

### MCPs sugeridos

`/easii:stack` sugiere MCPs relevantes y evita repetir los que ya estén en `.mcp.json` o `.pi/mcp.json`.

Ejemplos actuales:

| Trigger | MCP |
|---|---|
| Expo | Expo MCP |
| `@supabase/*` | Supabase MCP |
| Playwright | Playwright MCP |
| Prisma/Postgres deps | PostgreSQL MCP |
| Firebase | Firebase MCP |
| Stripe | Stripe MCP |
| Next/React/Node | Context7 MCP |

### Schema `rn-feature` y setup SDD

Flujo SDD adaptado para features de React Native:

```
proposal → specs → design → tasks → apply
```

Con templates que incluyen:
- Consideraciones de plataforma (iOS/Android)
- Estrategia de testing (unit + E2E opcional)
- Checklist de PR

Para configurar un proyecto RN/Expo:

```
/easii:setup-project
```

El comando muestra primero un resumen interactivo y pide confirmación. Si aceptás, hace una única pregunta de recomendaciones para capacidades faltantes que aplican al perfil:

- strict TDD si hay `test_command` confiable y todavía no está activo
- estrategia E2E recomendada si el stack la justifica
- CI/CD como pendiente recomendado si no está detectado
- Docker solo en perfiles web/backend donde aplica

Luego:

- copia `assets/schemas/rn-feature/` a `openspec/schemas/rn-feature/`
- setea `schema: rn-feature` en `openspec/config.yaml`
- agrega un bloque administrado con stack detectado y preferencias de setup para `/sdd-init`
- infiere `test_command`, E2E, typecheck, lint y format cuando existen scripts confiables

## Comandos

| Comando | Qué hace |
|---|---|
| `/easii:stack` | Detecta stack, audita capacidades read-only y sugiere skills/MCPs |
| `/easii:setup-project` | Configura OpenSpec para RN/Expo con schema `rn-feature` y hints para `/sdd-init` |

## Desarrollo local

```bash
# Clonar el repo
git clone https://github.com/easii-studio/pi
cd pi

# Instalar en Pi desde el path local
pi install .

# Testear sin instalar
pi -e ./extensions/stack-detector.ts

# Verificar TypeScript
npx tsc --noEmit

# Revisar qué se publicaría en npm
npm pack --dry-run
```

## Contribuir

Issues y PRs bienvenidos en [github.com/easii-studio/pi](https://github.com/easii-studio/pi).

## Licencia

MIT — Easii Studio
