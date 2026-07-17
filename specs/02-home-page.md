# SPEC 02 — Home page

> **Status:** Implementado
> **Depends on:** 01-mvp-visual
> **Date:** 2026-07-17
> **Objective:** Reemplazar `/` por la landing de marketing (`home.jsx`), mover la Biblioteca actual a `/games`, y actualizar el Nav para reflejar ambas rutas.

## Scope

**In:**

- Ruta `/` (Home): hero con silhouettes flotantes decorativas, sección "¿Por qué Arcade Vault?" (feature grid), preview de juegos (`GAMES.slice(0, 6)` en `mini-rail`), sección de stats, sección "Actividad en vivo" (últimas puntuaciones + top jugadores del día, con datos hardcodeados de ejemplo), sección de precios (plan único gratis + FAQ), CTA final. Migrado desde `references/templates/home-about/home.jsx`.
- Mover la Biblioteca actual (hero, buscador, chips de categoría, grid de `GameCard`, hoy en `app/page.tsx`) a `app/games/page.tsx`, ruta `/games`, sin cambios funcionales.
- Actualizar `Nav` (`components/nav.tsx`): agregar link "Inicio" apuntando a `/`, cambiar el link "Biblioteca" para apuntar a `/games` (conserva el texto "Biblioteca"), en Nav de escritorio y en el panel móvil. Actualizar `isActive` para que "Inicio" esté activo solo en `/` y "Biblioteca" en `/games` + `/juegos/*`.
- Actualizar los CTAs internos de Home para apuntar a las rutas reales: "Explorar juegos" → `/games`, "Crear cuenta" → `/auth`, cards de `mini-rail` → `/juegos/[id]`, "Ver todos los juegos" → `/games`, CTA final → `/games`, "Ver salón" → `/salon-de-la-fama`.
- Migrar los bloques de CSS necesarios de `references/templates/home-about/styles.css` (secciones HOME PAGE, y los bloques `.activity-*`, `.ticker`/`.tick-row`, `.top-list`/`.top-row`, `.pricing-*`, `.price-card`, `.pc-*`, `.faq-*`) a `app/globals.css`.
- Animación `reveal`/`IntersectionObserver` al hacer scroll (como en el template), migrada a un hook de cliente en `app/page.tsx`.

**Out of scope (for future specs):**

- Página "Acerca de" (`about.jsx`) y su formulario de contacto — queda para un spec futuro.
- Cambiar el texto del link "Biblioteca" a otra cosa (ej. "Juegos") — se mantiene igual, solo cambia el href.
- Datos reales de actividad/ranking (vienen hardcodeados como mock, igual que el template).
- Cualquier cambio a `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth`, `/salon-de-la-fama` más allá de los links de navegación entrantes desde Home.

## Data model

Este spec no introduce estructuras nuevas: reutiliza `GAMES` de `lib/games.ts` para el `mini-rail`, y los datos de "Actividad en vivo" (últimas puntuaciones, top jugadores) quedan hardcodeados directamente en el componente `app/page.tsx`, igual que en el template.

## Implementation plan

1. Mover el contenido actual de `app/page.tsx` (Biblioteca) a `app/games/page.tsx` sin cambios funcionales. Verificar que `/games` renderiza igual que `/` renderizaba antes.
2. Crear `app/page.tsx` con la nueva Home, migrando `references/templates/home-about/home.jsx`: `FloatingSilhouettes`, `MiniCard`, `FeatureIcon`, hook de `reveal`/`IntersectionObserver`, y las secciones hero / why / games preview / stats / actividad / precios / CTA final. Usar `next/navigation` (`useRouter` o `Link`, según corresponda por sección) en vez de la prop `navigate` del template.
3. Ajustar los destinos de navegación dentro de Home: hero y CTA final → `/games`, "Crear cuenta" → `/auth`, `MiniCard` → `/juegos/[id]`, "Ver salón" → `/salon-de-la-fama`.
4. Portar a `app/globals.css` los bloques de `references/templates/home-about/styles.css`: sección `HOME PAGE` completa (`.home*`, `.hero-*`, `.feature-*`, `.mini-*`, `.stats-*`, `.home-final`, `.reveal`), y los bloques `.activity-*`, `.ticker`/`.tick-row`/`.tk-*`, `.top-list`/`.top-row`/`.tp-*`, `.pricing-*`, `.price-card`/`.pc-*`, `.pricing-faq`/`.faq-*`, `.lb-link`.
5. Actualizar `components/nav.tsx`: agregar link "Inicio" (`/`) antes de "Biblioteca" tanto en el nav de escritorio como en el panel móvil; cambiar el `href` de "Biblioteca" de `/` a `/games`; actualizar `isActive` para distinguir "Inicio" (`pathname === "/"`) de "Biblioteca" (`/games` o `/juegos/*`).
6. Revisar que todos los links entrantes/salientes de Home, Biblioteca y Nav naveguen correctamente, y que `npm run lint` / `npm run build` pasen sin errores.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `/` muestra la nueva Home: hero, sección "¿Por qué Arcade Vault?", preview de juegos, stats, actividad en vivo, precios y CTA final.
- [ ] `/games` muestra la Biblioteca (hero, buscador, chips, grid) igual que antes cuando vivía en `/`.
- [ ] El buscador y los chips de categoría en `/games` siguen filtrando el grid correctamente.
- [ ] En `/`, el botón "Explorar juegos" del hero y el botón final "Insertar moneda" navegan a `/games`.
- [ ] En `/`, el botón "Crear cuenta" navega a `/auth`.
- [ ] En `/`, hacer clic en una card del preview de juegos navega a `/juegos/[id]` con el `id` correcto.
- [ ] En `/`, el botón "Ver todos los juegos" navega a `/games` y "Ver salón" navega a `/salon-de-la-fama`.
- [ ] Las secciones con clase `reveal` en `/` aparecen con la animación de aparición al hacer scroll.
- [ ] El `Nav` muestra un link "Inicio" que navega a `/` y queda marcado como activo solo en `/`.
- [ ] El link "Biblioteca" del `Nav` navega a `/games` y queda marcado como activo en `/games`, `/juegos/[id]` y `/juegos/[id]/jugar`.
- [ ] En viewport móvil (<840px), el panel deslizante del `Nav` incluye "Inicio" y "Biblioteca" con los mismos destinos.

## Decisiones

- **Sí:** mover la Biblioteca de `/` a `/games`. La landing de marketing (Home) reemplaza a `/` como en el template original (donde "Inicio" es la raíz), y `/games` es más idiomático en inglés que `/biblioteca` para este proyecto.
- **No:** mantener Biblioteca en `/` y poner Home en otra ruta (ej. `/inicio`). Rompería la convención del template, donde "Inicio" (Home) vive en la raíz.
- **Sí:** el link "Biblioteca" del Nav conserva su texto actual, solo cambia el `href` a `/games`. No hay razón visual para renombrarlo a "Juegos".
- **No:** implementar la página "Acerca de" (`about.jsx`) en este spec. Se deja explícitamente fuera para no mezclar dos migraciones distintas en un mismo spec; se hará en un spec futuro.
- **Sí:** los datos de "Actividad en vivo" (últimas puntuaciones, top jugadores) quedan hardcodeados directamente en `app/page.tsx`, igual que en el template, en vez de moverse a `lib/games.ts`. Son datos puramente decorativos sin relación con el resto de la app.
- **Sí:** portar el hook de `reveal`/`IntersectionObserver` del template tal cual, sin reescribirlo con una librería de animación. Es simple y ya está probado visualmente en el prototipo.

## Riesgos identificados

- Mover la Biblioteca de `/` a `/games` cambia la URL raíz de la app. Cualquier enlace externo o marcador que apuntara a `/` esperando ver la Biblioteca ahora verá la Home. Aceptable porque el proyecto aún no tiene usuarios en producción (según `specs/01-mvp-visual.md`, sigue siendo un MVP visual).

## What is **not** in this spec

- Página "Acerca de" (`about.jsx`) y su formulario de contacto.
- Cambio de texto del link "Biblioteca" en el Nav.
- Datos reales de actividad/ranking.
- Cambios a `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth`, `/salon-de-la-fama` más allá de los links de navegación entrantes desde Home.

Cada uno de estos, si se implementa, va en su propio spec.
