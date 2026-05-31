---
name: rn-e2e-maestro
description: >
  Flujos E2E con Maestro para React Native. Cargá esta skill cuando necesites
  escribir, revisar o debuggear tests E2E con Maestro. Incluye cuándo usar E2E
  vs unit tests, estructura de flows, y patrones para flujos críticos de la app.
---

# React Native E2E con Maestro

## Cuándo cargar esta skill

Cargá esta skill cuando:
- Escribís un nuevo flow de Maestro
- Debuggeás un test E2E que falla
- Decidís si un caso necesita E2E o alcanza con unit test
- Configurás Maestro en un proyecto nuevo

---

## Cuándo usar E2E vs unit tests

### Usá E2E (Maestro) para:
- **Flujos críticos de negocio**: login, registro, checkout, pago
- **Flujos de onboarding**: el camino completo del usuario nuevo
- **Integraciones con APIs reales**: flujos que dependen de respuestas del servidor
- **Navegación compleja**: flows que cruzan múltiples screens

### Usá unit tests para:
- Lógica de componentes aislada
- Hooks y transformaciones de datos
- Validaciones y casos de error
- Todo lo que no requiere navegación real

### Regla práctica
> Si el escenario se puede testear sin navegar entre screens, usá unit test. Si el valor está en que el flujo completo funciona de punta a punta, usá E2E.

---

## Instalación y setup

```bash
# Instalar Maestro CLI
curl -Ls "https://get.maestro.mobile.dev" | bash

# Verificar instalación
maestro --version
```

### Estructura de carpetas
```
.maestro/
├── flows/
│   ├── auth/
│   │   ├── login.yaml
│   │   └── logout.yaml
│   ├── onboarding/
│   │   └── first-time-user.yaml
│   └── checkout/
│       └── complete-purchase.yaml
└── config.yaml        ← configuración global (opcional)
```

---

## Sintaxis base de un flow

```yaml
# .maestro/flows/auth/login.yaml
appId: com.easii.myapp    # bundle ID de tu app

---

# Nombre descriptivo del flow
- launchApp

# Navegar a login si no está en esa screen
- tapOn: "Iniciar sesión"

# Ingresar credenciales
- tapOn:
    id: "email-input"
- inputText: "test@easii.io"

- tapOn:
    id: "password-input"
- inputText: "TestPassword123"

- tapOn: "Entrar"

# Verificar que el login fue exitoso
- assertVisible: "Bienvenido"
- assertNotVisible: "Iniciar sesión"
```

---

## Selectores: cómo encontrar elementos

### Por texto (más frágil, evitar para lógica crítica)
```yaml
- tapOn: "Confirmar pedido"
```

### Por testID (recomendado)
```yaml
# En el componente RN:
# <Button testID="confirm-button" title="Confirmar" />

- tapOn:
    id: "confirm-button"
```

### Por accesibilidad label
```yaml
# <Button accessibilityLabel="Botón confirmar pedido" />
- tapOn:
    label: "Botón confirmar pedido"
```

### Regla de selectores
> Preferir `testID` para elementos con lógica. Texto libre solo para aserciones de contenido.

---

## Patrones útiles

### Esperar a que algo aparezca (para operaciones async)
```yaml
- waitForAnimationToEnd
- assertVisible:
    text: "Pedido confirmado"
    timeout: 5000    # ms
```

### Scroll hasta encontrar un elemento
```yaml
- scrollUntilVisible:
    element:
      text: "Ver más"
    direction: DOWN
```

### Condicional: hacer algo solo si un elemento existe
```yaml
- runFlow:
    when:
      visible: "Continuar como invitado"
    flow:
      - tapOn: "Continuar como invitado"
```

### Variables y parametrización
```yaml
# Definir variables
env:
  TEST_EMAIL: "test@easii.io"
  TEST_PASSWORD: "TestPassword123"

---
- inputText: ${TEST_EMAIL}
```

### Sub-flows reutilizables
```yaml
# En el flow principal
- runFlow: "../auth/login.yaml"    # reusar el flow de login antes de testear otra cosa
- tapOn: "Mi perfil"
```

---

## Correr los tests

```bash
# Correr un flow específico
maestro test .maestro/flows/auth/login.yaml

# Correr todos los flows
maestro test .maestro/flows/

# Modo interactivo (útil para desarrollo)
maestro studio

# Con reporte
maestro test --format junit .maestro/flows/
```

---

## Agregar testIDs a componentes (patrón estándar)

```typescript
// ✅ Siempre agregar testID a elementos interactivos en flujos críticos
<TouchableOpacity
  testID="checkout-button"
  onPress={handleCheckout}
>
  <Text>Confirmar compra</Text>
</TouchableOpacity>

// ✅ En inputs
<TextInput
  testID="email-input"
  placeholder="Email"
  onChangeText={setEmail}
/>
```

### Convención de nombres para testID
```
{screen}-{elemento}-{variante?}

Ejemplos:
  login-email-input
  login-password-input
  login-submit-button
  home-product-list
  product-add-to-cart-button
  checkout-confirm-button
```

---

## Checklist antes de mergear un flow nuevo

- [ ] El flow corre en simulador iOS localmente: `maestro test <flow>`
- [ ] El flow corre en emulador Android localmente
- [ ] Todos los `tapOn` usan `testID`, no texto libre (salvo aserciones)
- [ ] Los elementos interactivos tienen `testID` en el componente RN
- [ ] El flow está en la carpeta correcta bajo `.maestro/flows/`
- [ ] Si el flow requiere login, reusar `../auth/login.yaml` como sub-flow

---

## Compact Rules

- E2E solo para flujos críticos de negocio y onboarding. Lógica aislada → unit test.
- Selectores: preferir `testID` sobre texto. Texto solo para aserciones de contenido.
- Convención testID: `{screen}-{elemento}-{variante}`. Agregar a todos los elementos interactivos en flujos críticos.
- Sub-flows: reusar flows comunes (login, etc.) con `runFlow`.
- Variables: usar `env` para datos de test, nunca hardcodear credentials.
- Antes de PR: correr en iOS y Android. Verificar que todos los testIDs existen en el componente.
