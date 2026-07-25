# SPEC 03 — Página "Sobre nosotros" y formulario de contacto con Resend

> **Status:** Implemented
> **Depends on:** 01-mvp-visual, 02-home-page
> **Date:** 2026-07-19
> **Objective:** Implementar la página `/about` migrada desde `references/templates/home-about/about.jsx` y conectar su formulario de contacto a un envío real de correo vía Resend a través de un Route Handler.

## Scope

**In:**

- Ruta `/about` (`app/about/page.tsx`): sección "Acerca de" (hero con kicker, título, misión, `highlight-row` con 3 highlights e íconos pixel `HighlightIcon`), divisor animado (`about-divider`), y sección "Contacto" (`contact-grid`: intro + tips, y el formulario). Migrado desde `references/templates/home-about/about.jsx`, con la animación `reveal`/`IntersectionObserver` como en specs 01–02.
- Formulario de contacto como Client Component con estados: **idle** (form), **enviando** (botón deshabilitado, texto "ENVIANDO…"), **éxito** (terminal `terminal-success` del template), **error** (mensaje de fallo con opción de reintentar). Mantiene el `shake` en validación de campos vacíos.
- Campo **honeypot** oculto (ej. `input name="company"` fuera de pantalla): si viene relleno, el servidor responde 200 sin enviar correo.
- Route Handler `app/api/contact/route.ts` (POST): valida `name`, `email`, `msg` (no vacíos + formato de email), chequea honeypot, y envía el correo con Resend. Responde JSON `{ ok: true }` o `{ ok: false, error }` con el status adecuado.
- Integración Resend: instalar `resend`, enviar desde `onboarding@resend.dev` hacia `CONTACT_TO_EMAIL`, con `reply_to` igual al email del formulario para poder responder directo.
- Variables de entorno: `RESEND_API_KEY` (la provees tú) y `CONTACT_TO_EMAIL=ctorres014@gmail.com`. Se documentan en un `.env.example` commiteado (sin valores secretos).
- Nav (`components/nav.tsx`): link "Sobre nosotros" apuntando a `/about`, al final (después de "Salón de la Fama"), en escritorio y panel móvil, con `isActive` marcándolo solo en `/about`.
- Migrar a `app/globals.css` los bloques de `references/templates/home-about/styles.css`: `.about*`, `.contact*`, `.highlight*`, `.hl-*`, `.tip*`, `.term-*`, `.terminal-success`, `.field`, y `.shake` si no está ya portado.

**Out of scope (for future specs):**

- Rate-limiting real / captcha / verificación de dominio propio en Resend (se usa `onboarding@resend.dev`, que solo entrega a la cuenta dueña de la key).
- Plantilla HTML rica del correo (se envía texto plano o HTML mínimo, no un diseño elaborado).
- Persistencia de los mensajes enviados (base de datos, dashboard de contactos).
- Notificaciones de confirmación al remitente (autoresponder al usuario).
- Internacionalización y tests automatizados (no hay test runner en el repo).

## Data model

Este spec no introduce estructuras de datos persistentes. Define solo el contrato del Route Handler y la forma del estado local del formulario.

```ts
// Cuerpo del POST a /api/contact (JSON)
type ContactRequest = {
  name: string;
  email: string;
  msg: string;
  company?: string; // honeypot: debe venir vacío
};

// Respuesta del Route Handler
type ContactResponse =
  | { ok: true }
  | { ok: false; error: string };
```

```ts
// Estado local del formulario (Client Component)
type FormStatus = "idle" | "sending" | "success" | "error";
// form: { name, email, msg }  — igual que el template
// status: FormStatus
// shake: boolean               — validación de campos vacíos (del template)
```

Convenciones:

- El honeypot (`company`) no es visible ni enfocable; si llega con contenido, el servidor responde `{ ok: true }` sin enviar correo (finge éxito para no dar pistas al bot).
- Validación en dos capas: cliente (campos no vacíos, dispara `shake`) y servidor (no vacíos + regex de email). El servidor es la autoridad.
- El correo usa `reply_to` = `email` del formulario, así responder desde la bandeja va directo al remitente.

## Implementation plan

1. Instalar la dependencia: `npm install resend`. Verificar que `resend` aparece en `package.json` y que `npm run build` sigue pasando.
2. Crear `.env.example` (commiteado) con `RESEND_API_KEY=` y `CONTACT_TO_EMAIL=ctorres014@gmail.com`, y `.env.local` (ignorado) con la key real que tú provees. Verificar que `.env.local` no aparece en `git status`.
3. Crear `app/api/contact/route.ts` con el handler `POST`: parsear JSON, chequear honeypot (`company`), validar `name`/`email`/`msg` (no vacíos + regex de email), y devolver `400` con `{ ok:false, error }` si falla. Aún sin llamar a Resend. Test manual: `curl` con body inválido → 400, body válido → 200.
4. Integrar Resend en el handler: instanciar `new Resend(process.env.RESEND_API_KEY)`, enviar desde `onboarding@resend.dev` a `CONTACT_TO_EMAIL` con `reply_to` = email del form y cuerpo con nombre/email/mensaje. Manejar el error de Resend devolviendo `502`/`{ ok:false }`. Test manual: `curl` válido → llega el correo a `ctorres014@gmail.com`.
5. Crear `app/about/page.tsx` migrando `about.jsx`: sección "Acerca de" (hero, misión, `highlight-row`, `HighlightIcon`), `about-divider`, sección "Contacto" (intro + tips). Aún con el formulario del template (submit falso) para validar el layout. Portar el hook `reveal`/`IntersectionObserver` como en spec 02.
6. Portar a `app/globals.css` los bloques de estilos `.about*`, `.contact*`, `.highlight*`, `.hl-*`, `.tip*`, `.term-*`, `.terminal-success`, `.field` (y `.shake` si falta). Verificar que `/about` se ve fiel al template.
7. Conectar el formulario al Route Handler: reemplazar el `onSubmit` falso por uno que valide (con `shake`), ponga `status="sending"`, haga `fetch("/api/contact", { method:"POST", ... })`, y según la respuesta pase a `success` (terminal del template) o `error`. Agregar el honeypot oculto, el botón deshabilitado en "ENVIANDO…", y el bloque de error con reintento.
8. Actualizar `components/nav.tsx`: agregar link "Sobre nosotros" (`/about`) al final, en escritorio y panel móvil, y en `isActive` marcarlo solo cuando `pathname === "/about"`. Verificar navegación y que `npm run lint` / `npm run build` pasan.

## Acceptance criteria

- [ ] `npm run build` y `npm run lint` pasan sin errores.
- [ ] `resend` figura en `dependencies` de `package.json`.
- [ ] `.env.example` está commiteado con `RESEND_API_KEY` y `CONTACT_TO_EMAIL`; `.env.local` existe localmente y **no** aparece en `git status`.
- [ ] `/about` renderiza la sección "Acerca de" (kicker, título, misión, 3 highlights con sus íconos) y la sección "Contacto" (intro, tips, formulario), fiel al template.
- [ ] Las secciones con clase `reveal` en `/about` aparecen con la animación al hacer scroll.
- [ ] Enviar el formulario con algún campo vacío dispara el `shake` y **no** hace la petición.
- [ ] Al enviar un formulario válido, el botón pasa a "ENVIANDO…" y queda deshabilitado mientras dura la petición.
- [ ] Una petición exitosa muestra la terminal de éxito (`terminal-success`) con el nombre del remitente, y "Enviar otro mensaje" resetea el formulario a estado idle.
- [ ] Un fallo de red o de Resend muestra el estado de error con opción de reintentar, sin perder lo escrito.
- [ ] `POST /api/contact` con `name`, `email` o `msg` vacíos, o email con formato inválido, responde `400` con `{ ok:false }`.
- [ ] `POST /api/contact` con el honeypot `company` relleno responde `200` sin enviar correo.
- [ ] `POST /api/contact` válido envía el correo y llega a `ctorres014@gmail.com`, con `reply_to` igual al email del formulario.
- [ ] El `Nav` muestra "Sobre nosotros" apuntando a `/about`, en escritorio y panel móvil, marcado como activo solo en `/about`.

## Decisiones

- **Sí:** ruta `/about` en inglés. Elección explícita del usuario, aunque el resto de rutas en español (`/salon-de-la-fama`) usen ese idioma; el link visible sigue en español ("Sobre nosotros").
- **Sí:** Route Handler (`app/api/contact/route.ts`) en vez de Server Action. Separa cliente/servidor de forma limpia y se puede probar con `curl` sin montar la UI.
- **No:** Server Action. Válida, pero acopla el envío al render del componente y es menos cómoda de testear de forma aislada.
- **Sí:** remitente `onboarding@resend.dev`. No requiere verificar un dominio propio para arrancar.
- **No:** dominio propio verificado ahora. Queda para un spec futuro; `onboarding@resend.dev` solo entrega a la cuenta dueña de la key, suficiente para este caso.
- **Sí:** destinatario en variable de entorno `CONTACT_TO_EMAIL`. Evita hardcodear el correo y permite cambiarlo sin tocar código.
- **Sí:** `reply_to` con el email del formulario. Permite responder al remitente directo desde la bandeja.
- **Sí:** honeypot oculto como anti-spam mínimo. Barato, sin fricción para el usuario y sin dependencias externas.
- **No:** rate-limiting/captcha. Overengineering para el volumen esperado; va en otro spec si hace falta.
- **Sí:** validación en cliente y servidor. El cliente mejora la UX (`shake`), el servidor es la autoridad real.
- **Sí:** `.env.example` commiteado + `.env.local` ignorado. Documenta las variables necesarias sin exponer la key.

## Riesgos identificados

| Riesgo | Mitigación |
| --- | --- |
| `onboarding@resend.dev` solo entrega a la cuenta dueña de la API key; a otros destinatarios Resend rechaza el envío. | `CONTACT_TO_EMAIL` apunta a `ctorres014@gmail.com` (la cuenta dueña). Migrar a dominio verificado queda para un spec futuro. |
| `RESEND_API_KEY` ausente o inválida en runtime hace fallar el envío. | El handler devuelve `502`/`{ ok:false }` y la UI muestra el estado de error con reintento; nunca crashea la página. |
| El honeypot no frena bots sofisticados. | Aceptado como protección mínima; rate-limiting/captcha se difieren explícitamente a otro spec. |
| Exponer la key al cliente rompería la seguridad. | El envío ocurre solo en el Route Handler (servidor); la key nunca se importa en el Client Component. |

## What is **not** in this spec

- Rate-limiting, captcha o verificación de dominio propio en Resend.
- Plantilla HTML elaborada del correo.
- Persistencia de mensajes (base de datos, dashboard).
- Autoresponder de confirmación al remitente.
- Internacionalización y tests automatizados.

Cada uno de estos, si se implementa, va en su propio spec.
