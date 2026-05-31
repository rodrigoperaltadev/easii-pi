---
name: expo
description: >
  Convenciones, patrones y gotchas para proyectos React Native con Expo.
  Cargá esta skill cuando trabajes con EAS Build, Expo Router, managed/bare
  workflow, o cualquier SDK de Expo. Incluye criterios para decidir entre
  managed y bare, y cómo manejar native modules.
---

# Expo Skill

## Cuándo cargar esta skill

Cargá esta skill al inicio de cualquier sesión en un proyecto que use `expo` como dependencia, o cuando trabajes con:
- EAS Build / EAS Submit / EAS Update
- Expo Router (file-based navigation)
- Expo SDK modules (`expo-camera`, `expo-location`, etc.)
- Decisiones de managed vs bare workflow

---

## Managed vs Bare workflow

### Managed workflow
- Usá managed cuando **no necesitás native code personalizado**
- El SDK de Expo maneja los builds nativos
- Ideal para proyectos que usan solo módulos del Expo SDK
- Restricción: no podés modificar `ios/` ni `android/` directamente

### Bare workflow
- Usá bare cuando necesitás **native modules de terceros** que no están en el Expo SDK
- Tenés acceso completo a `ios/` y `android/`
- Podés usar `expo prebuild` para generar los proyectos nativos
- Más control, más responsabilidad de mantenimiento

### Cuándo migrar de managed a bare
- Necesitás un native module no disponible en el Expo SDK
- Necesitás modificar el AppDelegate o MainApplication
- Integrás SDKs nativos de terceros (ej: algunos analytics, mapas custom)

---

## EAS Build

### Configuración base (`eas.json`)
```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {}
  }
}
```

### Gotchas frecuentes de EAS Build
- Las **environment variables** en EAS Build deben declararse en `eas.json` bajo `env`, no solo en `.env`
- Los **secrets** van en el dashboard de Expo, nunca en el repositorio
- `eas build --local` es útil para debuggear problemas de build sin consumir minutos de EAS
- Cada perfil de build genera un **build distinto** — development client ≠ preview ≠ production

### EAS Update (OTA)
- Solo actualiza el **bundle JavaScript**, no el código nativo
- Si cambiás native modules o el SDK version, necesitás un nuevo build nativo
- Configurá `runtimeVersion` para controlar compatibilidad entre builds y updates

---

## Expo Router

### Convenciones de estructura
```
app/
├── _layout.tsx          ← Root layout (navegación global, providers)
├── (tabs)/
│   ├── _layout.tsx      ← Tab layout
│   ├── index.tsx        ← Tab 1
│   └── profile.tsx      ← Tab 2
├── modal.tsx            ← Modal screen
└── +not-found.tsx       ← 404
```

### Reglas de navegación
- Los **grupos** `(nombre)` no aparecen en la URL
- Los **segmentos dinámicos** van entre `[brackets]`
- Los **layouts** se heredan — el root layout envuelve todo
- Usá `expo-router/link` para navegación, no `react-navigation` directamente

### Gotchas de Expo Router
- El archivo `+not-found.tsx` es obligatorio para builds de producción
- En **web**, las rutas son URLs reales — considerá SEO y deep linking desde el principio
- `useLocalSearchParams()` para params de ruta, `useGlobalSearchParams()` para params globales

---

## Módulos del Expo SDK

### Patrón de uso correcto
```typescript
// ✅ Correcto: importar del módulo específico
import * as Camera from 'expo-camera';
import * as Location from 'expo-location';

// ❌ Evitar: importar de 'expo' directamente (deprecado en SDK 50+)
import { Camera } from 'expo';
```

### Permisos (patrón estándar)
```typescript
const [status, requestPermission] = Camera.useCameraPermissions();

if (!status?.granted) {
  return <Button onPress={requestPermission} title="Pedir permiso" />;
}
```

### Diferencias iOS / Android a tener en cuenta
- Los permisos en iOS requieren strings descriptivos en `app.json` bajo `ios.infoPlist`
- Android necesita permisos en `app.json` bajo `android.permissions`
- Algunos módulos tienen comportamiento diferente por plataforma — siempre testeá en ambas

---

## Checklist antes de cada PR en proyectos Expo

- [ ] `npx expo-doctor` sin errores críticos
- [ ] Variables de entorno verificadas en todos los perfiles de EAS
- [ ] Testeado en simulador iOS Y emulador Android (o device físico)
- [ ] Si cambiaste `app.json`, regenerar con `expo prebuild --clean` (solo bare)
- [ ] Deep links / URL scheme verificados si hay navegación por URL

---

## Compact Rules

- Managed workflow: no modificar `ios/` ni `android/`. Usar `app.json` + Expo SDK.
- Bare workflow: `expo prebuild` genera los proyectos nativos. No modificar archivos generados a mano sin documentarlo.
- EAS: secrets en dashboard de Expo, nunca en repo. Env vars en `eas.json` bajo `env`.
- Expo Router: layouts heredados, grupos `(nombre)` no aparecen en URL, segmentos dinámicos con `[brackets]`.
- Permisos: siempre usar hooks del módulo (`useCameraPermissions`, etc.). Declarar en `app.json`.
- Antes de PR: correr `expo-doctor`, testear en ambas plataformas.
