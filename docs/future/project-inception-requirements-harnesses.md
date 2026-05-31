# Project Inception & Requirements Harnesses — diseño futuro

> **Estado:** idea validada, no implementada.  
> **Decisión (2026-05-30):** mantener fuera del stack detector; diseñar como harnesses separados para v0.4+.

---

## Por qué separarlos del stack detector

`@easii/pi` hoy opera principalmente sobre proyectos existentes: detecta stack, sugiere skills, MCPs y schemas SDD.

Los harnesses de creación de proyecto y discovery de requisitos ocurren antes o al inicio del trabajo. Tienen otra responsabilidad:

| Harness | Momento | Pregunta central |
|---------|---------|------------------|
| `stack-detector` | Proyecto existente | ¿Qué stack tiene este repo y qué le falta? |
| `new-project` | Antes de crear repo | ¿Qué tipo de producto queremos construir? |
| `requirements` / `stories` | Antes de diseñar una feature | ¿Qué necesita el cliente y cómo lo convertimos en trabajo verificable? |

Mantenerlos separados evita que el detector se vuelva un asistente genérico y conserva el rol de `@easii/pi` como harness contextual.

---

## Harness 1: creación de proyecto nuevo

### Comando propuesto

```text
/easii:new-project
```

Alias posible:

```text
/easii:create-project
```

### Objetivo

Guiar al usuario desde una intención inicial hasta un **Project Blueprint**: stack recomendado, comandos de bootstrap, skills, MCPs, schema SDD, estructura inicial y próximos pasos.

No debe crear archivos ni ejecutar scaffold automáticamente sin confirmación explícita.

### Preguntas iniciales

1. **Tipo de proyecto**
   - Web app
   - Mobile app
   - Backend/API
   - Game
   - Library/package

2. **Nivel de intención**
   - MVP rápido
   - Producto escalable
   - Prototipo técnico
   - Librería reusable

3. **Preferencias de stack**
   - Usar recomendado
   - Tengo stack preferido
   - Migrar desde stack existente

4. **Testing esperado**
   - Básico
   - Unit + integration
   - Unit + E2E
   - Strict TDD

5. **Operación / delivery**
   - CI solamente
   - CI + CD/deploy
   - Docker/containerización
   - No definir todavía

> Pregunta abierta para futuro: no todos los perfiles deberían recibir las mismas preguntas operativas. Por ejemplo, Docker tiene sentido natural en web/backend, pero para videojuegos o mobile puede ser ruido salvo que el usuario mencione deploy/server tooling. El blueprint debe filtrar preguntas por dominio.

### Output esperado

```text
Project Blueprint: Mobile MVP

Stack recomendado:
- Expo + TypeScript
- Expo Router
- Zustand o store mínima según necesidad
- Jest + Testing Library
- Maestro opcional para flows críticos

Pi setup:
- Skills: expo, react-native, rn-e2e-maestro
- MCPs: expo, context7, supabase si aplica
- Schema SDD: rn-feature

Bootstrap sugerido:
1. npx create-expo-app@latest <name>
2. cd <name>
3. pi install npm:@easii/pi
4. /easii:setup-project
5. /sdd-new first-feature
```

### Principios

- Primero blueprint, después confirmación.
- No elegir herramientas irreversibles sin explicar tradeoffs.
- No vender una arquitectura única para todos los proyectos.
- Delegar detalles profundos a skills y SDD.
- Favorecer slices pequeños y revisables.

### Relación con especialidades

`/easii:new-project` debería reutilizar los playbooks definidos en `docs/future/specialties-playbooks.md`.

Ejemplo:

```text
Tipo: Mobile app
Nivel: MVP rápido
→ Especialidad recomendada: mobile-feature
→ Schema: rn-feature
→ Skills: expo, react-native
→ MCPs: expo, context7
```

---

## Harness 2: requisitos de cliente → casos de uso / historias

### Comando propuesto

```text
/easii:requirements
```

Alias posibles:

```text
/easii:stories
/easii:use-cases
```

### Objetivo

Convertir un requerimiento del cliente en un paquete de análisis productivo y verificable:

- actores
- objetivos
- casos de uso
- historias de usuario
- criterios de aceptación
- preguntas abiertas
- riesgos
- no-goals
- primer slice recomendado para SDD

Este harness debe funcionar antes de escribir código y también antes de crear un cambio SDD.

### Entrada típica

```text
El cliente quiere una app para turnos médicos donde pacientes puedan reservar horarios,
los médicos administren su disponibilidad y la clínica vea reportes básicos.
```

### Output esperado

```text
Product Discovery Summary

Actores:
- Paciente
- Médico
- Administrador de clínica

Objetivos:
- Reducir fricción para reservar turnos
- Permitir a médicos controlar disponibilidad
- Dar visibilidad operativa a la clínica

Historias iniciales:
1. Como paciente, quiero ver horarios disponibles para reservar un turno.
2. Como médico, quiero bloquear horarios no disponibles.
3. Como admin, quiero gestionar profesionales y especialidades.

Criterios de aceptación — reserva de turno:
- Dado un paciente autenticado...
- Cuando selecciona un horario disponible...
- Entonces el turno queda reservado y deja de aparecer como disponible.

Preguntas abiertas:
- ¿Hay pagos online?
- ¿Se requieren recordatorios por WhatsApp/email?
- ¿Una clínica o multi-clínica?

Primer slice SDD recomendado:
- appointment-booking-mvp
```

### Artifacts posibles

Primero preview + confirmación. Si el usuario aprueba, podría escribir:

```text
docs/product/brief.md
docs/product/user-stories.md
docs/product/open-questions.md
openspec/changes/<change>/proposal.md
```

### Principios

- No convertir requisitos ambiguos en implementación prematura.
- Separar hechos, supuestos y preguntas abiertas.
- Expresar historias con criterios de aceptación verificables.
- Proponer un primer slice pequeño, no una épica gigante.
- Mantener trazabilidad desde requerimiento → caso de uso → historia → SDD.

---

## Relación entre ambos harnesses

```text
/easii:new-project
  → define producto, stack y blueprint inicial
  → puede invocar/recomendar /easii:requirements

/easii:requirements
  → transforma necesidad de cliente en historias verificables
  → puede recomendar /sdd-new <slice>

/easii:setup-project
  → prepara OpenSpec/schema en un repo existente

/easii:stack
  → diagnostica stack existente y sugiere skills/MCPs
```

---

## Roadmap sugerido

| Versión | Entrega |
|---------|---------|
| **v0.2.x** | Cerrar integración `/sdd-init` |
| **v0.3.0** | Especialidades/playbooks (`mobile-feature` primero) |
| **v0.4.0** | `/easii:new-project` con Project Blueprint, sin scaffolding automático |
| **v0.5.0** | `/easii:requirements` para casos de uso, historias y criterios de aceptación |
| **v0.6.0** | Escritura opcional de artifacts productivos y proposal SDD con confirmación |

---

## Riesgos a evitar

- Scope creep: que `@easii/pi` se convierta en generador universal de apps.
- Decisiones ocultas: crear stacks o carpetas sin mostrar blueprint antes.
- Historias genéricas: output lindo pero no verificable.
- Duplicar SDD: este harness prepara input; SDD diseña y ejecuta cambios concretos.
- Mezclar producto con implementación: discovery primero, arquitectura después.
