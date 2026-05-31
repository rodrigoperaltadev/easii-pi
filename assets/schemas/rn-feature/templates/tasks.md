## 1. Setup y estructura base

- [ ] Crear archivos de la feature (screen, view, hooks)
- [ ] Agregar ruta en Expo Router si aplica
- [ ] Configurar tipos TypeScript

## 2. Lógica y hooks

- [ ] Implementar hook(s) de datos
- [ ] Integrar con API / store
- [ ] Manejo de estados: loading, error, empty

## 3. UI / Componentes

- [ ] Implementar componente View (presentacional)
- [ ] Estados visuales: loading skeleton, error state, empty state
- [ ] Agregar `testID` a todos los elementos interactivos

## 4. Tests unitarios

- [ ] Test de render del componente View
- [ ] Tests del hook con casos: éxito, error, loading
- [ ] Tests de validaciones / lógica crítica

## 5. E2E con Maestro *(opcional — solo si es flujo crítico)*

- [ ] Escribir flow en `.maestro/flows/`
- [ ] Verificar que todos los `testID` existen en los componentes
- [ ] Correr flow en simulador iOS
- [ ] Correr flow en emulador Android

## 6. Pulido y PR

- [ ] `npx tsc --noEmit` sin errores
- [ ] `npx jest` pasa
- [ ] Test visual en iOS y Android
- [ ] PR con descripción del cambio y screenshots/video si tiene cambios de UI
