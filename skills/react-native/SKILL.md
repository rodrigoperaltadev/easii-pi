---
name: react-native
description: >
  Convenciones y patrones para proyectos React Native. Cargá esta skill cuando
  trabajes con testing (Jest + Testing Library RN), navigation, native modules,
  performance, o diferencias de comportamiento entre iOS y Android.
---

# React Native Skill

## Cuándo cargar esta skill

Cargá esta skill en proyectos React Native cuando trabajes con:
- Escritura o revisión de tests (unit, integration)
- Problemas de navigation o screen architecture
- Native modules o bridge calls
- Performance de listas y renders
- Bugs específicos de plataforma (iOS vs Android)

---

## Testing

### Stack recomendado
```
jest + jest-expo (o @testing-library/react-native)
```

### Estructura de tests
```
src/
├── components/
│   ├── Button.tsx
│   └── __tests__/
│       └── Button.test.tsx    ← co-located con el componente
├── screens/
│   └── HomeScreen.tsx
└── __tests__/
    └── HomeScreen.test.tsx    ← o en carpeta separada
```

### Patrón base para un test de componente
```typescript
import { render, screen, fireEvent } from '@testing-library/react-native';
import { Button } from '../Button';

describe('Button', () => {
  it('llama onPress cuando el usuario presiona', () => {
    const onPress = jest.fn();
    render(<Button onPress={onPress} title="Confirmar" />);
    
    fireEvent.press(screen.getByText('Confirmar'));
    
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

### Mocks necesarios frecuentemente
```typescript
// En jest.setup.ts o en el test
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
```

### Lo que NO testear en unit tests
- Navegación real entre screens (eso va en E2E)
- Animaciones (mockear `Animated`)
- Módulos nativos complejos (mockear el módulo entero)

---

## Arquitectura de screens y componentes

### Separación recomendada
```typescript
// ✅ Screen: orquesta datos y navegación, sin lógica de negocio
export function HomeScreen() {
  const { data, isLoading } = useHomeData();
  const router = useRouter();
  
  return <HomeView data={data} isLoading={isLoading} onItemPress={router.push} />;
}

// ✅ View: puro presentacional, fácil de testear
export function HomeView({ data, isLoading, onItemPress }) {
  if (isLoading) return <LoadingSpinner />;
  return <FlatList data={data} onPress={onItemPress} />;
}
```

### Reglas de componentes
- Props con tipos explícitos siempre — nunca `any`
- Componentes menores a 150 líneas; si crece, extraer
- Lógica de negocio en hooks custom, no en componentes
- Evitar lógica condicional profunda en el JSX — usar early returns

---

## Navigation

### Passando params de forma segura (Expo Router)
```typescript
// Definir tipos de params
type ProfileParams = { userId: string; name: string };

// Navegar
router.push({ pathname: '/profile/[userId]', params: { userId: '123', name: 'Rodrigo' } });

// Recibir
const { userId, name } = useLocalSearchParams<ProfileParams>();
```

### Expo Router: deep linking
- Activar `scheme` en `app.json` para links desde outside de la app
- Testear deep links con `npx uri-scheme open myapp://profile/123 --ios`

---

## Performance

### FlatList: reglas de oro
```typescript
<FlatList
  data={items}
  keyExtractor={(item) => item.id}          // ← siempre
  renderItem={renderItem}                    // ← extraer fuera del componente
  getItemLayout={getItemLayout}             // ← si todos los items tienen altura fija
  removeClippedSubviews={true}              // ← para listas largas
  maxToRenderPerBatch={10}
  windowSize={5}
/>

// ✅ renderItem fuera del componente o memoizado
const renderItem = useCallback(({ item }) => <ItemCard item={item} />, []);
```

### Evitar re-renders innecesarios
```typescript
// ✅ memo para componentes puros
export const ItemCard = memo(function ItemCard({ item }: Props) { ... });

// ✅ useCallback para handlers pasados como props
const handlePress = useCallback(() => onPress(item.id), [item.id, onPress]);

// ❌ Evitar objetos/arrays inline en JSX — crean nuevas referencias en cada render
// <Component style={{ margin: 10 }} />  ← crea objeto nuevo siempre
// <Component items={[a, b]} />          ← crea array nuevo siempre
```

---

## Diferencias iOS / Android

| Comportamiento | iOS | Android |
|---|---|---|
| Safe area | `useSafeAreaInsets()` | `useSafeAreaInsets()` |
| Back button | No existe (swipe gesture) | Botón físico — manejar con `useBackHandler` |
| Shadow/Elevation | `shadow*` props | `elevation` prop |
| Fonts | Cargar con `expo-font` | Ídem |
| Keyboard avoiding | `KeyboardAvoidingView` behavior `padding` | behavior `height` |
| Status bar | Estilo `light`/`dark` | Puede ser transparente |

### Testear diferencias de plataforma
```typescript
import { Platform } from 'react-native';

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 20 : 0,
  },
});

// O con Platform.select
const shadow = Platform.select({
  ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
  android: { elevation: 4 },
});
```

---

## Checklist antes de cada PR en proyectos RN

- [ ] Tests pasan: `npx jest --passWithNoTests`
- [ ] Sin errores de TypeScript: `npx tsc --noEmit`
- [ ] Componentes nuevos tienen al menos un test de render
- [ ] FlatLists tienen `keyExtractor` y `renderItem` extraído
- [ ] Handlers con `useCallback` si se pasan como props
- [ ] Testeado visualmente en iOS Y Android

---

## Compact Rules

- Tests: usar `@testing-library/react-native`. Co-locate tests con componentes. Mockear navigation y módulos nativos.
- Screens: orquestan datos. Views: presentacionales, testeables. Lógica en hooks.
- FlatList: siempre `keyExtractor`. `renderItem` fuera del componente o memoizado.
- Performance: `memo` para componentes puros. `useCallback` para handlers como props. Sin objetos inline en JSX.
- Plataforma: `Platform.select` para diferencias. `KeyboardAvoidingView` behavior diferente en iOS vs Android.
- Antes de PR: jest + tsc + test visual en ambas plataformas.
