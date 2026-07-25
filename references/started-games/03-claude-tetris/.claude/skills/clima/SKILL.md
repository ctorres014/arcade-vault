---
name: clima
description: Consulta el clima actual y el pronóstico de una ciudad usando wttr.in (servicio gratuito, sin API key). Úsalo cuando el usuario pida el clima, tiempo, temperatura o pronóstico de una ubicación, ej. "/clima Madrid" o "qué clima hace en Buenos Aires".
---

# Clima (wttr.in)

Este skill consulta el clima usando **wttr.in**, un servicio HTTP gratuito que no requiere API key y devuelve texto legible directamente.

## Cómo obtener la ubicación

- Si el usuario pasó un argumento (ciudad, ej. `/clima Madrid`), usá ese valor como ubicación.
- Si no se indicó ninguna ubicación, preguntale al usuario qué ciudad quiere consultar antes de continuar.
- Reemplazá espacios en el nombre de la ciudad por `+` al construir la URL (ej. "Buenos Aires" → `Buenos+Aires`).

## Cómo consultar

Usá la tool **Bash** (no PowerShell) para ejecutar `curl`, ya que wttr.in funciona mejor con su cliente de texto plano.

### Consulta rápida (una línea)

Para una respuesta corta tipo "¿qué clima hace ahora":

```bash
curl -s "wttr.in/<ciudad>?format=3&lang=es&m"
```

Devuelve algo como: `Madrid: 🌦 +18°C`

### Consulta detallada (pronóstico de varios días)

Si el usuario pide más detalle, pronóstico extendido, o "cómo va a estar" los próximos días:

```bash
curl -s "wttr.in/<ciudad>?lang=es&m"
```

Esto devuelve el reporte visual completo en ASCII con el pronóstico de hoy, mañana y pasado. Mostrale la salida tal cual (es texto preformateado, respetá los saltos de línea) o resumila si es muy larga.

### Consulta en formato JSON (si necesitás datos estructurados)

Si necesitás extraer valores específicos (humedad, viento, sensación térmica, etc.) para hacer cálculos o mostrarlos en una tabla:

```bash
curl -s "wttr.in/<ciudad>?format=j1"
```

Parseá el JSON resultante (`current_condition`, `weather[].hourly`, etc.).

## Manejo de errores

- Si `curl` falla por falta de conexión, informale al usuario que no se pudo contactar wttr.in y sugerí verificar la conexión a internet.
- Si la respuesta contiene "Unknown location" o similar, la ciudad no fue reconocida: pedile al usuario que aclare el nombre (podés sugerir agregar el país, ej. "Springfield, US").
- `wttr.in` puede tardar unos segundos o fallar intermitentemente; si el comando no responde en ~10s, informalo y proponé reintentar.

## Presentación de la respuesta

Para la consulta rápida, respondé con una sola línea clara (ciudad, condición, temperatura).
Para la consulta detallada, mostrá el bloque ASCII de wttr.in dentro de un bloque de código para que se vea alineado, y agregá un resumen breve en texto normal debajo (temperatura actual, condición, y algo destacable del pronóstico).
