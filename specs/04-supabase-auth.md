# SPEC 04 — Supabase: autenticación real y perfiles

> **Status:** Aprobado
> **Depends on:** 01-mvp-visual, 02-home-page
> **Date:** 2026-07-25
> **Objective:** Conectar la app a Supabase con `@supabase/ssr` y reemplazar el `AuthProvider` en memoria por autenticación real de correo + contraseña respaldada por una tabla `profiles`.

## Scope

**In:**

- Dependencias: `@supabase/supabase-js` y `@supabase/ssr`.
- Variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, documentadas en el `.env.example` ya commiteado y con valores reales en `.env.local` (ignorado). Proyecto Supabase: `lngtyxwjbjbefefqqctw`.
- Clientes: `lib/supabase/client.ts` (`createBrowserClient`, para Client Components) y `lib/supabase/server.ts` (`createServerClient` con `cookies()` de `next/headers`, para Server Components y Route Handlers).
- `proxy.ts` en la raíz (el antiguo `middleware.ts`; Next.js 16 lo renombró) que refresca la sesión en cada request con `getClaims()` y reescribe las cookies. Con `matcher` que excluye estáticos e imágenes. **No protege ninguna ruta.**
- Migración SQL versionada en `supabase/migrations/`, aplicada al proyecto remoto con `apply_migration` del MCP: tabla `public.profiles`, sus políticas RLS y el trigger `on_auth_user_created` que crea el perfil al registrarse.
- Reescritura de `/auth` (`app/auth/page.tsx`) como Client Component contra Supabase:
  - Tab **Iniciar sesión**: correo + contraseña → `signInWithPassword` → redirige a `/games`.
  - Tab **Crear cuenta**: usuario + correo + contraseña → `signUp` con `options.data.username` y `emailRedirectTo` → estado "revisa tu correo".
  - Botones sociales **GOOGLE** y **GITHUB** y el divisor "O CONTINÚA CON": se quedan exactamente como están hoy, decorativos y sin acción. No se tocan.
  - Botón **JUGAR COMO INVITADO**: se mantiene tal cual, como sesión falsa solo en memoria.
  - Estados visibles de carga y de error (credenciales inválidas, correo ya registrado, usuario ya tomado).
- `app/auth/callback/route.ts` (GET): intercambia el `code` por sesión (`exchangeCodeForSession`) y redirige a `/games`. Lo usa la confirmación de correo.
- `context/auth-context.tsx` reescrito: recibe el usuario inicial resuelto en el servidor desde `app/layout.tsx` (sin parpadeo), se suscribe a `onAuthStateChange`, expone `user`, `signOut` real y el flag `guest` en memoria. La sesión real siempre gana sobre el modo invitado.
- `components/nav.tsx`: muestra el `username` del perfil cuando hay sesión, "INVITADO" cuando solo hay modo invitado, y el botón de salir ejecuta `signOut` real.
- Configuración en el dashboard de Supabase (manual, documentada en este spec): confirmación de correo activada, y `Site URL` / `Redirect URLs` apuntando a `http://localhost:3000/auth/callback`.

**Out of scope (for future specs):**

- Persistencia de puntuaciones, partidas y el Salón de la Fama con datos reales. Es el spec siguiente y la razón por la que `profiles` existe desde ya.
- Migrar `GAMES` de `lib/games.ts` a la base de datos.
- **OAuth de cualquier proveedor (Google, GitHub): queda para un spec futuro.**
- Recuperación de contraseña, magic link y `signInAnonymously` de Supabase.
- Rutas protegidas y redirección de `/auth` cuando ya hay sesión.
- Página de perfil, edición de `username`, avatares y subida de archivos a Storage.
- Personalizar las plantillas de correo de Supabase o enviarlas por Resend (siguen las de por defecto).
- Tipos TypeScript generados de la base de datos (`generate_typescript_types`); `profiles` se tipa a mano.
- Despliegue en producción con URLs reales (solo se configura `localhost:3000`).
- Tests automatizados: no hay test runner en el repo.

## Data model

Migración `supabase/migrations/0001_profiles.sql`:

```sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text not null unique,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Lectura pública: los rankings del spec siguiente necesitan ver los nombres.
create policy "profiles_select_public" on public.profiles
  for select using (true);

-- Cada usuario solo puede modificar su propia fila.
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);
```

Trigger que crea el perfil al registrarse (`security definer`, se dispara `after insert on auth.users`):

```sql
-- Toma el username de options.data.username.
-- Si no viene (usuario creado a mano en el dashboard), usa la parte local del correo.
-- Ante colisión, añade los primeros 4 caracteres del uuid.
create function public.handle_new_user() returns trigger ...
```

Convenciones:

- `username`: se guarda en mayúsculas y recortado a 10 caracteres, igual que hace hoy `login({ name: user.toUpperCase().slice(0, 10) })` en `app/auth/page.tsx`.
- No hay política de `insert` para `profiles`: las filas solo las crea el trigger. Ninguna ruta de la app inserta perfiles directamente.
- Antes de llamar a `signUp`, el formulario consulta `profiles` por `username` para avisar de que ya está tomado. Es una comprobación de UX; la autoridad real es el índice `unique`.

Tipos en el cliente (`lib/supabase/types.ts`):

```ts
export type Profile = {
  id: string;
  username: string;
  created_at: string;
};

// context/auth-context.tsx
export type SessionUser =
  | { kind: "supabase"; id: string; username: string; email: string }
  | { kind: "guest"; username: "INVITADO" }
  | null;
```

## Implementation plan

1. Instalar dependencias: `npm install @supabase/supabase-js @supabase/ssr`. Verificar que aparecen en `package.json` y que `npm run build` sigue pasando.
2. Añadir a `.env.example` (commiteado) `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=`, y rellenar `.env.local` con los valores reales del proyecto `lngtyxwjbjbefefqqctw`. Verificar que `.env.local` no aparece en `git status`.
3. Crear `lib/supabase/client.ts` (`createBrowserClient`), `lib/supabase/server.ts` (`createServerClient` con `cookies()` de `next/headers`, usando `getAll`/`setAll`) y `lib/supabase/types.ts` con `Profile`. Aún nadie los usa. Test: `npm run build` y `npm run lint` pasan.
4. Escribir `supabase/migrations/0001_profiles.sql` con la tabla, RLS, políticas y el trigger `handle_new_user`, y aplicarlo con `apply_migration` del MCP. Test: `list_tables` muestra `public.profiles` con RLS activo y `get_advisors` no reporta advertencias de seguridad nuevas.
5. Configurar el dashboard de Supabase (manual, sin código): activar confirmación de correo y poner `Site URL` = `http://localhost:3000` con `http://localhost:3000/auth/callback` en Redirect URLs.
6. Crear `proxy.ts` en la raíz: refresca la sesión con `getClaims()` y propaga las cookies, con `matcher` que excluye `_next/static`, `_next/image`, `favicon.ico` e imágenes. No redirige nada. Test: navegar por `/`, `/games` y `/about` sigue funcionando igual.
7. Reescribir `context/auth-context.tsx` con el nuevo `SessionUser` (unión etiquetada), `signOut` real, flag `guest` en memoria y suscripción a `onAuthStateChange`; en `app/layout.tsx` resolver el usuario inicial en el servidor (sesión + `username` de `profiles`) y pasarlo como prop. Ajustar `components/nav.tsx` al nuevo tipo para que compile. Test: sin sesión la app se comporta como hoy.
8. Crear `app/auth/callback/route.ts` (GET): lee `code`, llama a `exchangeCodeForSession` y redirige a `/games`; si falla, redirige a `/auth` con un parámetro de error.
9. Conectar la tab **Iniciar sesión** de `app/auth/page.tsx`: campo correo + contraseña, `signInWithPassword`, botón deshabilitado mientras carga y mensaje de error legible. Test manual: con un usuario creado a mano desde el dashboard, entrar y aterrizar en `/games` con el nombre en el Nav.
10. Conectar la tab **Crear cuenta**: usuario + correo + contraseña, consulta previa de disponibilidad del `username`, `signUp` con `options.data.username` y `emailRedirectTo` al callback, y estado "revisa tu correo". Test manual: registrarse, recibir el correo, confirmar y quedar logueado en `/games` con la fila creada en `profiles`.
11. Apuntar **JUGAR COMO INVITADO** al flag `guest` del contexto, sin tocar el divisor "O CONTINÚA CON" ni los botones **GOOGLE** y **GITHUB**. Test manual: el modo invitado muestra "INVITADO" en el Nav, y los botones sociales siguen en pantalla sin hacer nada, igual que antes.
12. Terminar `components/nav.tsx`: mostrar `username` con sesión real, "INVITADO" en modo invitado, y salir ejecutando `signOut` (o limpiando el flag de invitado). Verificar que `npm run lint` y `npm run build` pasan.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `@supabase/supabase-js` y `@supabase/ssr` figuran en `dependencies` de `package.json`.
- [ ] `.env.example` está commiteado con `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; `.env.local` existe localmente y **no** aparece en `git status`.
- [ ] `supabase/migrations/0001_profiles.sql` está commiteado y `list_tables` muestra `public.profiles` con RLS habilitado.
- [ ] `get_advisors` no reporta advertencias de seguridad nuevas sobre `public.profiles`.
- [ ] Existe `proxy.ts` en la raíz del proyecto (no `middleware.ts`) y navegar por `/`, `/games`, `/about`, `/juegos/[id]` y `/salon-de-la-fama` funciona igual que antes.
- [ ] Con sesión iniciada, recargar cualquier página mantiene la sesión y el Nav muestra el `username` sin parpadear a "no logueado".
- [ ] Crear cuenta con usuario + correo + contraseña muestra el estado "revisa tu correo" y **no** deja al usuario logueado todavía.
- [ ] Abrir el enlace del correo de confirmación pasa por `/auth/callback` y aterriza en `/games` con la sesión iniciada.
- [ ] Tras confirmar, existe una fila en `public.profiles` con el `username` en mayúsculas, de 10 caracteres o menos, y el mismo `id` que en `auth.users`.
- [ ] Intentar registrarse con un `username` ya existente muestra un mensaje de "usuario no disponible" y no llama a `signUp`.
- [ ] Iniciar sesión con correo + contraseña correctos redirige a `/games`; con credenciales inválidas muestra un mensaje de error y deja el formulario editable.
- [ ] Mientras se envía cualquiera de los dos formularios, el botón queda deshabilitado.
- [ ] Los botones GOOGLE y GITHUB y el divisor "O CONTINÚA CON" siguen en `/auth` con el mismo aspecto que antes de este spec, y pulsarlos no produce ningún efecto ni error en consola.
- [ ] "JUGAR COMO INVITADO" muestra "INVITADO" en el Nav, y al recargar la página el modo invitado se pierde.
- [ ] Si hay sesión real de Supabase, el Nav muestra el `username` del perfil aunque antes se hubiera pulsado "jugar como invitado".
- [ ] El botón de salir del Nav cierra la sesión: el Nav vuelve al estado sin usuario y recargar no la restaura.
- [ ] La `service_role` key no aparece en ningún archivo del repo.

## Decisiones

- **Sí:** este spec cubre fundación + autenticación real, y nada más. "Implementar Supabase" tocaba auth, puntuaciones y catálogo de juegos: tres dominios en un solo spec es la receta para que la implementación improvise.
- **No:** persistencia de puntuaciones aquí. Va en el spec siguiente, que ya se apoyará en `profiles`.
- **Sí:** `@supabase/ssr` con clientes separados de browser y servidor. Permite leer la sesión en Server Components y evita el parpadeo de "no logueado" en cada carga.
- **No:** solo cliente con `onAuthStateChange`. Más simple, pero deja la sesión invisible al servidor, que es justo lo que necesitará el guardado de puntuaciones.
- **Sí:** `proxy.ts` en la raíz. Next.js 16 renombró `middleware.ts` a `proxy.ts`; la documentación de Supabase todavía usa el nombre viejo y hay que traducirla al escribir el código.
- **Sí:** el `proxy.ts` solo refresca la sesión, no protege rutas. Nada que proteger todavía, y la propia documentación de Next desaconseja usarlo como capa de autorización.
- **Sí:** login por correo, no por nombre de usuario. Resolver username → email exige un Route Handler extra y filtra qué usuarios existen; el nombre sigue pidiéndose al crear la cuenta.
- **No:** OAuth (Google ni GitHub) en este spec. Decisión del usuario: depende de credenciales y configuración externas al repo, y el correo + contraseña ya cubre el flujo completo de alta y acceso. Va en su propio spec.
- **Sí:** dejar los botones sociales tal cual, decorativos. Decisión del usuario: conservan el diseño del template y quedan listos para el spec de OAuth. Contrapartida asumida: `/auth` muestra dos botones que no hacen nada.
- **No:** eliminarlos u ocultarlos. Sería más honesto de cara al usuario final, pero obliga a rehacer el bloque cuando llegue OAuth.
- **Sí:** confirmación de correo activada, con `app/auth/callback/route.ts`. Es la única pieza que consume el callback ahora que no hay OAuth, y aun así hace falta para cerrar el registro.
- **Sí:** tabla `profiles` con trigger, en vez de guardar el nombre en `raw_user_meta_data`. El Salón de la Fama necesitará hacer join contra los nombres, y `auth.users` no se consulta desde el cliente.
- **Sí:** lectura pública de `profiles` vía RLS. Los rankings son públicos por diseño; la tabla solo contiene nombre y fecha de alta.
- **Sí:** sin política de `insert` en `profiles`. Las filas las crea únicamente el trigger, así que nadie puede fabricar perfiles huérfanos.
- **Sí:** ante colisión de `username`, sufijo automático con 4 caracteres del uuid. Es la red de seguridad del `unique` en la carrera entre dos registros simultáneos, sin añadir una pantalla de onboarding.
- **No:** pantalla de "elige tu nombre" cuando el nombre está tomado. Es la solución correcta a largo plazo; queda para cuando exista una página de perfil.
- **Sí:** `SessionUser` como unión etiquetada (`kind: "supabase" | "guest"`). Obliga a tocar `components/nav.tsx`, pero hace imposible confundir un invitado con una cuenta real cuando haya que decidir si se guarda una puntuación.
- **Sí:** conservar "jugar como invitado" como sesión falsa en memoria, sin `localStorage`. Decisión del usuario; la sesión real siempre gana sobre el flag de invitado.
- **No:** `signInAnonymously` de Supabase para el invitado. Crea usuarios reales en `auth.users` que habría que limpiar, sin aportar nada mientras no se guarden puntuaciones.
- **Sí:** publishable key (`sb_publishable_...`) en vez de la anon key clásica. Es la nomenclatura actual de Supabase y se rota de forma independiente.
- **Sí:** migración en archivo versionado dentro de `supabase/migrations/`, aplicada con el MCP. El esquema queda en el repo sin añadir Docker ni la CLI al flujo de trabajo.
- **No:** tipos generados con `generate_typescript_types`. Una sola tabla con tres columnas no justifica el paso de generación; se revisará cuando lleguen las puntuaciones.
- **Sí:** redirección a `/games` tras entrar. Decisión del usuario; cambia el `router.push("/")` actual.
- **No:** eliminar el `AuthProvider`. Se reescribe, no se borra: `components/nav.tsx` y `/auth` ya dependen de `useAuth`.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| La documentación de Supabase para Next.js indica `middleware.ts`; en Next.js 16 ese archivo ya no se ejecuta y la sesión nunca se refrescaría, con fallos intermitentes difíciles de diagnosticar. | El archivo es `proxy.ts` en la raíz. El criterio de aceptación lo verifica de forma explícita, y la sesión se comprueba recargando la página. |
| El `username` viaja en `options.data.username` y el trigger lo copia a `profiles`: un usuario podría manipular ese metadato al registrarse. | El trigger normaliza (mayúsculas, 10 caracteres) y el índice `unique` rechaza duplicados. Solo afecta al nombre visible, no a permisos. |
| La comprobación previa de disponibilidad del `username` tiene una condición de carrera: dos registros simultáneos con el mismo nombre. | El `unique` es la autoridad; el segundo registro recibe el sufijo del uuid vía trigger. La consulta previa es solo UX. |
| Con confirmación de correo activada, el usuario cierra la pestaña y nunca confirma: queda una fila en `auth.users` sin perfil ni acceso. | Aceptado. El estado "revisa tu correo" es explícito y el usuario puede volver a registrarse; la limpieza de cuentas sin confirmar queda fuera de este spec. |
| `Site URL` o Redirect URLs mal configuradas en el dashboard rompen el enlace de confirmación en tiempo de ejecución, no en el build. | El paso 5 del plan las configura antes de conectar el registro, y el paso 10 prueba el alta de extremo a extremo. |
| Confundir la `service_role` key con la publishable key la expondría al navegador vía `NEXT_PUBLIC_`. | Este spec no usa `service_role` en ningún punto. Un criterio de aceptación verifica que no aparece en el repo. |
| Convivencia de sesión real e invitado: mostrar "INVITADO" a alguien que sí tiene cuenta. | La sesión de Supabase tiene prioridad sobre el flag `guest` en el contexto, y hay un criterio de aceptación para ese caso concreto. |
| Las URLs configuradas apuntan solo a `localhost:3000`; al desplegar, los enlaces de confirmación romperían. | Aceptado y declarado fuera de alcance. El despliegue exigirá añadir las URLs de producción en el dashboard. |

## What is **not** in this spec

- Puntuaciones, partidas y Salón de la Fama con datos reales.
- Catálogo de juegos en base de datos (`GAMES` sigue en `lib/games.ts`).
- **OAuth con Google o GitHub.**
- Recuperación de contraseña, magic link y `signInAnonymously`.
- Rutas protegidas y redirección de `/auth` cuando ya hay sesión.
- Página de perfil, edición de `username` y avatares.
- Plantillas de correo personalizadas.
- Tipos TypeScript generados de la base de datos.
- Configuración de producción (URLs reales, dominios).
- Tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
