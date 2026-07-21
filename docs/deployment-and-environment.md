# Despliegue y entorno

## Vercel

Proyecto vinculado vía `vercel link` (`.vercel/project.json`, ignorado por
git): nombre de proyecto **`pokedesk`**. No se copian aquí `projectId` ni
`orgId` reales aunque no son secretos sensibles — usá `vercel project
inspect pokedesk` o el dashboard para consultarlos.

Deploy:

```bash
vercel deploy         # preview
vercel deploy --prod  # production
```

**No confirmable desde el código:** si hay un deploy automático conectado
al push a `main`, o si el proyecto ya tiene algún deploy promovido a
Production. La última nota conocida (heredada de la documentación previa
de este repo) es que, a esa fecha, todos los deploys habían sido Preview.
Verificalo con `vercel ls` o el dashboard antes de asumir una URL de
producción.

## Variables de entorno

Definidas en `.env.example` (sin valores reales):

- **`AI_GATEWAY_API_KEY`** — usada por `app/api/pokemon/[id]/audio/route.js`
  vía el paquete `ai` (`gateway.speech(...)`) para generar voz con
  `openai/tts-1` a través de Vercel AI Gateway.
  - En Vercel (Preview/Production) **no hace falta seteada a mano**: la
    plataforma inyecta un token OIDC que el AI Gateway acepta
    automáticamente.
  - En local (`pnpm dev`) sí hace falta, salvo que se use
    `vercel env pull .env.local` con un proyecto ya vinculado que tenga
    OIDC habilitado para Development.
- **`BLOB_READ_WRITE_TOKEN`** — usado por `@vercel/blob` (`head`, `put`)
  en el mismo endpoint de audio.
  - En Vercel no hace falta: el store está conectado al proyecto y se
    autentica solo.
  - Hace falta un token clásico para usar `vercel blob ...` por CLI, o
    para correr `pnpm dev` local sin depender de un deployment real.

No hay otras variables de entorno en el proyecto (no hay DB, no hay auth,
no hay claves de terceros adicionales).

### `.env.example`

Ya existe en la raíz del repo con ambas variables documentadas y sin
valores. Mantenelo así — nunca commitear `.env.local` ni valores reales
(el `.gitignore` ya excluye `.env*` salvo `.env.example`).

## Vercel Blob

- Store activo: **`pokedesk-audio`** (id `store_wSlJji0OyXtFMGeS`, según
  la última verificación conocida — confirmar en el dashboard si cambió).
- **Conectado solo a Preview y Production, no a Development.** Esto es la
  causa más probable de que `pnpm dev` falle al pedir
  `/api/pokemon/[id]/audio` con un error de Blob no autenticado.
  Para desarrollar localmente con audio real, conectar el store también a
  Development desde el dashboard de Vercel (Storage → pokedesk-audio →
  Connect Project → marcar Development), o pegar un
  `BLOB_READ_WRITE_TOKEN` de ese store en `.env.local`.
- El pathname de cada blob es determinístico
  (`pokemon/audio/{id}-{hash}.mp3`), así que no hay riesgo de duplicar
  archivos por reintentos — `put(..., allowOverwrite: true)` reemplaza al
  mismo pathname si hiciera falta.

## AI Gateway

- Modelo: `openai/tts-1`, voz `alloy`, formato de salida `mp3`.
- Se invoca con `generateSpeech()` del paquete `ai` (Vercel AI SDK),
  contra `gateway.speech(SPEECH_MODEL)` — no se usa el SDK de OpenAI
  directo ni una API key de OpenAI propia.
- Autenticación: OIDC automático en Vercel; `AI_GATEWAY_API_KEY` solo
  para local (ver arriba).

## Diferencias entre local, Preview y Production

| | Local (`pnpm dev`) | Preview | Production |
| --- | --- | --- | --- |
| PokéAPI, imagen, bitmap | Funciona sin config | Funciona | Funciona |
| Audio TTS/Blob | Falla salvo token manual en `.env.local` (store no conectado a Development) | Funciona (OIDC + Blob conectado) | Funciona (OIDC + Blob conectado) |
| Acceso externo (curl/navegador anónimo) | Libre | **Requiere sesión de Vercel (SSO)** | Libre (público) |

### Protección SSO de deployments Preview

Los deployments de Preview de este proyecto están protegidos por el SSO
de Vercel: para abrirlos (navegador o `curl`) hace falta estar logueado a
Vercel con acceso al team/proyecto. Un `curl` anónimo a una URL de
Preview va a devolver una redirección/challenge de autenticación en vez
del JSON o binario esperado — **no es un bug del endpoint**, es la
protección de la plataforma.

Para probar un endpoint de Preview sin navegador autenticado, usar
`vercel deploy` y abrir la URL logueado, o promover a Production si se
quiere una URL pública sin SSO.

### Cómo verificar un deployment

```bash
vercel ls                    # deployments recientes
vercel inspect <url>         # detalle de un deployment puntual
vercel logs <url>            # logs en vivo/recientes (útil para ver cache=HIT|MISS del endpoint de audio)
```

En el navegador (logueado si es Preview):
`https://<deployment-url>/api/pokemon/1?display=tft` para chequear el
payload TFT rápido, o `/api/pokemon/1/image` para la imagen.

### Cómo evitar exponer secretos

- Nunca commitear `.env.local` (ya cubierto por `.gitignore`).
- No pegar valores reales de `AI_GATEWAY_API_KEY` ni
  `BLOB_READ_WRITE_TOKEN` en código, commits, issues o esta
  documentación.
- Si se necesita compartir cómo probar algo con curl, usar placeholders
  (`<token>`) en vez de valores reales, incluso en notas internas.

---

## Audio (detalle operativo)

Esta sección amplía la referencia de
[`docs/api.md`](api.md#get-apipokemonidaudio) para `GET /api/pokemon/[id]/audio`.

### Cómo se construye el texto hablado

`lib/pokemonAudioText.ts` (`buildPokemonAudioText`):

1. Fetch a `pokeapi.co/api/v2/pokemon/{id}` y a `pokemon-species`.
2. Nombre capitalizado (`capitalize()` de `lib/api.ts`).
3. Tipos en español vía `TYPE_NAMES_ES`: `"Tipo Planta"` o
   `"Tipos Planta y Veneno"`.
4. Descripción: primera entrada de `flavor_text_entries` en `es`; si no
   hay ninguna en español, cae a la primera en `en`. Se recorta a 400
   caracteres (`MAX_DESCRIPTION_LENGTH`) y se normaliza:
   - se eliminan caracteres de control (saltos de línea, tabs, etc.)
   - se eliminan codepoints de la Unicode Private Use Area
     (`0xE000`–`0xF8FF`) que PokéAPI a veces arrastra de textos viejos de
     los juegos
   - se colapsan espacios múltiples
5. Texto final: `"{Nombre}. Tipo(s) {tipos}. {descripción}."`

### Proveedor y modelo TTS

Vercel AI Gateway, modelo `openai/tts-1`, voz `alloy`, salida `mp3`. No
hay selección de voz ni de modelo configurable por request.

### Hash y caché en Vercel Blob

- `sha256(texto_final)`, primeros 16 caracteres hex.
- Pathname: `pokemon/audio/{id}-{hash}.mp3`.
- `HEAD` al pathname antes de generar: si existe, se descarga y se sirve
  tal cual (**HIT**, no se vuelve a llamar al TTS). Si no existe, se
  genera con `generateSpeech()`, se sube a Blob y se sirve (**MISS**).
- El header de respuesta `X-Audio-Cache: HIT|MISS` refleja este resultado
  — es diagnóstico, no es necesario para que un cliente consuma el
  endpoint.

### Comportamiento HIT/MISS confirmado

Según pruebas previas registradas en el proyecto: un id nunca antes
pedido generó `cache=MISS` en los logs de servidor
(`vercel logs`); pedidos posteriores al mismo id generaron `cache=HIT`.
Tamaño de referencia observado: Pikachu (id 25) devolvió
`Content-Length: 155040` (~151 KB).

### Costos potenciales

Cada **MISS** implica una llamada real a TTS a través del AI Gateway
(costo por caracter/uso según el plan de Vercel AI Gateway vigente). Como
la clave de caché es el texto final, el costo por Pokémon se paga como
máximo una vez por combinación de id + texto de descripción — pedidos
repetidos al mismo id son gratis (solo lectura de Blob). Un cambio en
`MAX_DESCRIPTION_LENGTH`, en la lógica de selección de idioma, o una
actualización de `flavor_text_entries` en PokéAPI generaría un hash
nuevo y, por lo tanto, un MISS nuevo.

### Limitaciones conocidas

- Sin invalidación manual de caché: para forzar una regeneración hay que
  cambiar el texto (lo cual cambia el hash) o borrar el blob a mano.
- Sin límite de tasa (rate limiting) propio sobre este endpoint — un
  cliente que pida muchos ids nunca antes generados en poco tiempo puede
  generar varias llamadas a TTS seguidas.
- Depende de que PokéAPI tenga al menos una descripción en `es` o `en`;
  si no hay ninguna, el endpoint responde `502` (`Description
  unavailable`).

### Funcionamiento en Preview, Production y Development

Ver la tabla de la sección anterior — en resumen, funciona en Preview y
Production porque el store de Blob está conectado ahí; en Development
(`pnpm dev`) falla salvo configuración manual de `BLOB_READ_WRITE_TOKEN`.

### Configuración OIDC / tokens

- **Vercel (Preview/Production):** OIDC automático para AI Gateway y
  Blob — no requiere variables seteadas manualmente en el dashboard.
- **Local:** requiere `AI_GATEWAY_API_KEY` (creada en
  `vercel.com/[team]/~/ai-gateway/api-keys`) y/o `BLOB_READ_WRITE_TOKEN`
  del store `pokedesk-audio`, pegados en `.env.local`.

### Cómo probar manualmente el endpoint

```bash
# Local (requiere las env vars configuradas, ver arriba)
curl -i http://localhost:3000/api/pokemon/1/audio -o bulbasaur.mp3

# Preview (requiere sesión de Vercel logueada en el navegador por SSO;
# un curl anónimo no va a funcionar)
# abrir directamente en el navegador logueado:
# https://<deployment-url>/api/pokemon/1/audio

# Production (si está promovido, sin SSO)
curl -i https://<dominio-de-produccion>/api/pokemon/1/audio -o bulbasaur.mp3
```

Revisar el header `X-Audio-Cache` en la respuesta (`curl -i`) para
confirmar HIT vs MISS, y `vercel logs <url>` para ver la línea
`[pokemon/audio] id=... cache=...` del lado servidor.
