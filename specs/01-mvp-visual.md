# SPEC 01 — MVP visual de Arcade Vault

> **Status:** Aprobado
> **Depends on:** —
> **Date:** 2026-07-13
> **Objective:** Implementar la capa visual completa de las 5 pantallas del prototipo (Biblioteca, Detalle, Auth, Salón de la Fama, Reproductor) como rutas reales de Next.js App Router, sin lógica de juego.

## Scope

**In:**

- Ruta `/` (Biblioteca): hero, buscador, chips de categoría, grid de `GameCard` con hover/tilt, filtrado en cliente por texto + categoría.
- Ruta `/juegos/[id]` (Detalle): cover, tags, descripción, stat-strip, botones "Jugar ahora" / "Volver al vault", leaderboard lateral con datos mock (`seededScores`).
- Ruta `/juegos/[id]/jugar` (Reproductor): mockup estático del HUD (jugador, puntuación, vidas, nivel) y del CRT con la escena decorativa (nave, enemigos, grid-floor) vía animaciones CSS. Sin score incremental, sin modal de fin de juego, sin lógica de partida.
- Ruta `/auth` (Auth): tabs "Iniciar sesión" / "Crear cuenta", formulario, botón "Jugar como invitado", botones sociales (decorativos, sin OAuth real). Al enviar el formulario o entrar como invitado, actualiza el estado de sesión visual y navega a `/`.
- Ruta `/salon-de-la-fama` (Salón de la Fama): tabs por juego, podio (top 3), tabla de puntuaciones con datos mock, fila destacada "tu mejor marca" solo si hay sesión activa.
- `Nav` compartido en el layout raíz: logo, links activos según ruta, contador de créditos (estático), botón de auth que refleja el estado de sesión, menú móvil (hamburguesa + panel deslizante).
- `AuthProvider` (Context de React, Client Component) en `app/layout.tsx` que expone `user` y `login`/`logout`, consumido por `Nav` y por la página `/auth`. Estado solo en memoria, sin `localStorage` ni backend.
- Datos mock (`GAMES`, `CATS`, `PLAYERS`, `seededScores`) migrados a `lib/games.ts` en TypeScript.
- Interacciones de UI en cliente sin persistencia: búsqueda/filtros, tabs, menú móvil, hover/tilt de cards — todas funcionando, pero sin guardar nada entre sesiones.

**Out of scope (for future specs):**

- Lógica real de juego (canvas, física, colisiones, input de teclado/táctil) en `/juegos/[id]/jugar`.
- Autenticación real (backend, OAuth, validación de credenciales, hashing de contraseñas).
- Persistencia de puntuaciones y de sesión (localStorage, base de datos, API routes).
- Guardado de puntuación al terminar una partida (modal "fin del juego" con input de iniciales).
- Datos reales de juegos (vienen de una API o CMS en vez de `lib/games.ts`).
- Internacionalización (los textos quedan en español, como en el template).
- Tests automatizados (no hay test runner configurado en el repo).

## Data model

```ts
// lib/games.ts
export type Game = {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";
  cover: string; // clase CSS del cover generado (ej. "cover-bricks")
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string; // ej. "12.4K"
};

export const GAMES: Game[];
export const CATS: readonly ["TODOS", "ARCADE", "PUZZLE", "SHOOTER", "VERSUS"];
export const PLAYERS: string[];

export type ScoreRow = { rank: number; name: string; score: number; date: string };
export function seededScores(seed: number, count?: number): ScoreRow[];
```

```ts
// context/auth-context.tsx
export type SessionUser = { name: string } | null;

type AuthContextValue = {
  user: SessionUser;
  login: (user: SessionUser) => void;
  logout: () => void;
};
```

Convenciones:

- `seededScores` es determinista (PRNG con semilla), igual que en el template — mismos inputs producen siempre el mismo leaderboard.
- `AuthContextValue.user` vive solo en memoria del `AuthProvider`; no se lee ni escribe en `localStorage`.
- `GAMES`, `CATS`, `PLAYERS` son los mismos valores del template (`references/templates/data.jsx`), traducidos 1:1 a TypeScript.

## Implementation plan

1. Crear `lib/games.ts` con `GAMES`, `CATS`, `PLAYERS` y `seededScores`, migrados desde `references/templates/data.jsx` a TypeScript tipado.
2. Crear `context/auth-context.tsx` con `AuthProvider` y el hook `useAuth()`. Envolver `children` con `AuthProvider` en `app/layout.tsx`.
3. Crear `components/nav.tsx` (Client Component) migrando `references/templates/nav.jsx`: logo, links con estado activo por ruta (`usePathname`), botón de auth conectado a `useAuth()`, menú móvil. Sustituir el placeholder actual en `app/layout.tsx` por este componente, más el footer (`© 2026 ARCADE VAULT · v2.6.0`) migrado desde `app.jsx`.
4. Implementar `app/page.tsx` (Biblioteca): hero, buscador, chips de categoría y `GameCard` con hover/tilt, migrando `references/templates/biblioteca.jsx`. Los links de las cards apuntan a `/juegos/[id]`.
5. Implementar `app/juegos/[id]/page.tsx` (Detalle): cover, tags, stat-strip, leaderboard, migrando `references/templates/detalle.jsx`. Si `id` no existe en `GAMES`, usar `notFound()`.
6. Implementar `app/auth/page.tsx` (Auth): tabs, formulario, botón de invitado, botones sociales decorativos, migrando `references/templates/auth.jsx`. Al enviar o entrar como invitado, llama `login()` del contexto y navega a `/` con `useRouter`.
7. Implementar `app/salon-de-la-fama/page.tsx` (Salón de la Fama): tabs por juego, podio, tabla, fila "tu mejor marca" condicionada a `useAuth().user`, migrando `references/templates/salon.jsx`.
8. Implementar `app/juegos/[id]/jugar/page.tsx` (Reproductor): HUD estático (usa `useAuth().user?.name` o "INVITADO"), CRT con escena decorativa, migrando la parte visual de `references/templates/reproductor.jsx` sin el `useEffect` de score incremental ni el modal de fin de juego. Botones "Salir" (vuelve a `/juegos/[id]`) y "Volver al vault" (`/`).
9. Reemplazar el contenido de ejemplo de `app/page.tsx` (si quedó algo del scaffold inicial) y revisar que todas las rutas naveguen entre sí correctamente (Nav, links internos, botones "volver").

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `/` muestra el hero, el buscador y el grid de juegos de `GAMES`.
- [ ] Escribir en el buscador de `/` filtra las cards por título en tiempo real.
- [ ] Hacer clic en un chip de categoría en `/` filtra las cards por esa categoría.
- [ ] Hacer clic en una `GameCard` navega a `/juegos/[id]` con el `id` correcto.
- [ ] `/juegos/[id]` muestra el detalle del juego y un leaderboard con 10 filas.
- [ ] Visitar `/juegos/no-existe` devuelve la página 404 de Next.js.
- [ ] El botón "Jugar ahora" en `/juegos/[id]` navega a `/juegos/[id]/jugar`.
- [ ] `/juegos/[id]/jugar` muestra el HUD y el CRT decorativo sin que la puntuación cambie sola ni aparezca un modal de fin de juego.
- [ ] `/auth` muestra los tabs "Iniciar sesión" / "Crear cuenta" y cambia el formulario visible al alternar entre ellos.
- [ ] Enviar el formulario de `/auth` (o pulsar "Jugar como invitado") navega a `/` y el botón de auth en el `Nav` pasa a mostrar el nombre de usuario.
- [ ] Recargar la página después de loguearse vuelve a mostrar "Iniciar Sesión" en el `Nav` (no hay persistencia).
- [ ] `/salon-de-la-fama` muestra el podio y la tabla para el primer juego por defecto, y cambia de datos al hacer clic en otro tab.
- [ ] Con sesión activa, `/salon-de-la-fama` muestra la fila "tu mejor marca"; sin sesión, no aparece.
- [ ] En viewport móvil (<840px), el `Nav` muestra el botón hamburguesa y el panel deslizante funciona (abrir/cerrar).
- [ ] El link activo en el `Nav` (Biblioteca / Salón de la Fama) refleja la ruta actual, incluyendo `/juegos/[id]` y `/juegos/[id]/jugar` como parte de "Biblioteca".

## Decisiones

- **Sí:** rutas de archivo idiomáticas del App Router (`/`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth`, `/salon-de-la-fama`) en vez del hash-router del template. Next.js ya resuelve routing, historial y deep-linking sin reinventar `app.jsx`.
- **No:** mantener `location.hash` como router propio. Habría sido más fiel al prototipo, pero va contra las convenciones del framework que ya usa el proyecto.
- **Sí:** portar `styles.css` casi tal cual a `globals.css`. Ya está hecho en el commit `f0c6893` (solo cambian las variables `--pixel`/`--mono` para usar `next/font`) — se reutiliza sin reescribir a utilidades de Tailwind.
- **No:** reescribir los estilos con utilidades Tailwind. Alto riesgo de perder fidelidad visual con el prototipo para un MVP que es puramente visual.
- **Sí:** React Context (`AuthProvider`) en el layout raíz para compartir el estado de sesión entre `Nav` y `/auth`. Es el mecanismo estándar de React para estado compartido entre un layout persistente y sus rutas hijas.
- **No:** `localStorage` para la sesión o las puntuaciones. El MVP es solo visual; la persistencia real de auth/scores queda para un spec futuro con backend.
- **Sí:** Reproductor como mockup estático (sin `setInterval` de score, sin modal de fin de juego). El objetivo explícito de este spec es "sin juego" — simular una partida sería lógica de juego disfrazada.
- **No:** omitir la pantalla de Reproductor por completo. Su HUD y su CRT son parte del diseño visual del MVP aunque no haya partida real.
- **Sí:** `lib/games.ts` como módulo compartido tipado. Varias pantallas (Biblioteca, Detalle, Salón de la Fama, Reproductor) necesitan los mismos datos mock.

## What is **not** in this spec

- Lógica real de juego (canvas, física, colisiones, input) en el Reproductor.
- Autenticación real con backend, OAuth o validación de credenciales.
- Persistencia de sesión o puntuaciones (localStorage, base de datos, API routes).
- Modal de fin de juego con guardado de puntuación.
- Datos de juegos provenientes de una API o CMS.
- Internacionalización y tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
