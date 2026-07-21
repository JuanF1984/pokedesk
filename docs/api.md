# API

Inventario de todos los Route Handlers del proyecto (`app/api/**/route.js`).
No incluye PokéAPI en sí (es un servicio externo, no parte de esta API).
Todos corren con `export const runtime = "nodejs"` (no Edge).

## `GET /api/pokemon/[id]`

Endpoint principal de datos de un Pokémon. Cambia de forma según los query
params — en la práctica son dos modos distintos bajo la misma ruta.

- **Método:** `GET`
- **Ruta:** `/api/pokemon/[id]`
- **Parámetro de ruta:** `id` — id numérico o nombre de PokéAPI (lo que
  acepte `https://pokeapi.co/api/v2/pokemon/{id}`)
- **Uso previsto:** ambos (web y CYD/TFT), según el modo

### Modo por defecto (sin `?display=tft`) — pensado para web/CYD liviano

- **Query params:**
  - `w` (opcional, default `48`, clamp `[8, 64]`) — ancho del bitmap
  - `h` (opcional, default `48`, clamp `[8, 64]`) — alto del bitmap
  - `debug` (opcional, `"1"`) — agrega el detalle de las 5 estrategias
    de conversión a bitmap y sus scores
- **Respuesta 200 (ejemplo, Bulbasaur sin sprite disponible):**
  ```json
  { "name": "bulbasaur", "type": "grass" }
  ```
  Si el sprite existe y `sharp` pudo procesarlo, se agrega:
  ```json
  {
    "name": "bulbasaur",
    "type": "grass",
    "bitmap": {
      "width": 48,
      "height": 48,
      "format": "adafruit_gfx_1bpp",
      "encoding": "base64",
      "data": "..."
    }
  }
  ```
- **`bitmap` es siempre opcional**: si no hay `sprites.front_default`, si
  el fetch del sprite falla, o si `sharp` no está disponible, la
  respuesta cae de vuelta a `{ name, type }` sin bitmap y sin error.
- **Uso previsto:** este modo no se usa en la web actual (que consume
  PokéAPI directo desde el cliente). Parece pensado para un cliente
  embebido con display monocromo (OLED); **no confirmado desde el código
  si algún cliente real lo consume hoy**.

### Modo `?display=tft` — payload rico para la CYD

- **Query params:** `display=tft` (cualquier otro valor de `display` se
  ignora y cae al modo default)
- **Respuesta 200 (ejemplo, id=1):**
  ```json
  {
    "id": 1,
    "name": "bulbasaur",
    "displayName": "Bulbasaur",
    "types": [{ "name": "grass", "nameEs": "Planta" }, { "name": "poison", "nameEs": "Veneno" }],
    "height": 0.7,
    "weight": 6.9,
    "description": "Una extraña semilla se plantó en su espalda al nacer...",
    "stats": {
      "hp": 45, "attack": 49, "defense": 49,
      "specialAttack": 65, "specialDefense": 65, "speed": 45
    },
    "imageUrl": "https://<host>/api/pokemon/1/image"
  }
  ```
- `description` puede ser `""` si PokéAPI species no respondió (fallo no
  bloqueante).
- `imageUrl` se arma con el `origin` de la propia request — apunta al
  endpoint de imagen de abajo.
- **Uso previsto:** CYD/TFT.

### Errores (ambos modos)

| Código | Causa |
| --- | --- |
| `400` | Falta `id` en la ruta (caso borde, prácticamente inalcanzable con el routing de Next) |
| `404` | PokéAPI devolvió 404 para ese id/nombre |
| `500` | Error de red al llamar a PokéAPI, o PokéAPI devolvió otro error no-2xx |

### Headers relevantes

Ninguno especial — `Response.json(...)` estándar (`Content-Type: application/json`).

### Dependencias externas

`pokeapi.co` (pokemon + pokemon-species), `sharp` (solo modo default, si
hay bitmap).

---

## `GET /api/pokemon/[id]/image`

JPEG chico y ya aplanado del artwork oficial, para dispositivos que no
quieren decodificar PNG con canal alfa.

- **Método:** `GET`
- **Ruta:** `/api/pokemon/[id]/image`
- **Parámetro de ruta:** `id`
- **Query params:** ninguno
- **Respuesta 200:** binario `image/jpeg`, 160x160px, `fit: contain` sobre
  fondo blanco, calidad JPEG 82
- **Headers de la respuesta:**
  - `Content-Type: image/jpeg`
  - `Content-Length: <bytes>`
  - `Connection: close`
  - `Cache-Control: public, max-age=604800, immutable` (7 días)
- **Uso previsto:** CYD/TFT (referenciado como `imageUrl` en el modo
  `?display=tft` de arriba). También podría consumirse desde la web, pero
  hoy la web usa el artwork de PokéAPI directo, sin pasar por este
  endpoint.

### Errores

| Código | Causa |
| --- | --- |
| `400` | Falta `id` |
| `404` | PokéAPI 404, o el Pokémon no tiene `official-artwork` |
| `502` | Error de red o error upstream (PokéAPI o el fetch del artwork) |
| `500` | `sharp` no disponible, o falló el procesamiento de la imagen |

### Dependencias externas

`pokeapi.co` (pokemon), la URL de artwork que devuelve PokéAPI
(`raw.githubusercontent.com` típicamente), `sharp`.

---

## `GET /api/pokemon/[id]/audio`

MP3 hablado (nombre + tipos + descripción en español) generado por TTS y
cacheado en Vercel Blob.

- **Método:** `GET`
- **Ruta:** `/api/pokemon/[id]/audio`
- **Parámetro de ruta:** `id` (id o nombre, lo que acepte PokéAPI)
- **Query params:** ninguno
- **Respuesta 200:** binario `audio/mpeg`
- **Headers de la respuesta:**
  - `Content-Type: audio/mpeg`
  - `Content-Length: <bytes>`
  - `Cache-Control: public, max-age=604800, immutable`
  - `X-Audio-Cache: HIT | MISS` — diagnóstico, no pensado para que el
    cliente (CYD) dependa de él
- **Uso previsto:** CYD (pensado para descargar y guardar en microSD como
  `/pokemon/audio/{id}.mp3`, según el firmware — no confirmado desde este
  lado del código).

### Errores

| Código | Causa |
| --- | --- |
| `400` | Falta `id` |
| `404` | PokéAPI 404 para ese id/nombre |
| `502` | Error de red/upstream con PokéAPI, species no disponible, ninguna descripción disponible (ni ES ni EN), o el proveedor TTS falló |

### Dependencias externas

`pokeapi.co` (pokemon + pokemon-species, vía `lib/pokemonAudioText.ts`),
Vercel AI Gateway (`openai/tts-1`), Vercel Blob (lectura y escritura).

Detalle de texto hablado, hashing, comportamiento HIT/MISS, costos y
cómo probar manualmente el endpoint en la sección **Audio** de
[`docs/deployment-and-environment.md`](deployment-and-environment.md).

---

## `GET /api/audio-test`

MP3 estático de prueba (patrón de beeps corto), sin generación por
request.

- **Método:** `GET`
- **Ruta:** `/api/audio-test`
- **Parámetros / query params:** ninguno
- **Respuesta 200:** binario `audio/mpeg`, contenido fijo
  (`assets/audio/pokedesk-test.mp3`)
- **Headers:** `Content-Type: audio/mpeg`, `Content-Length`,
  `Cache-Control: public, max-age=3600`
- **Errores:** ninguno manejado explícitamente — si el archivo no está
  en el bundle, `fs.readFileSync` tira y Next devuelve un 500 genérico.
- **Dependencias externas:** ninguna (archivo local del repo)
- **Uso previsto:** CYD — probar que el ESP32 puede descargar y
  reproducir un MP3 real vía Wi-Fi, sin la complejidad de TTS/Blob de
  por medio.

## `GET /api/audio-test/wav`

WAV PCM de 8 bits sin comprimir, generado en cada request (tono de
prueba), para reproducir por `dacWrite()` sample a sample sin decoder.

- **Método:** `GET`
- **Ruta:** `/api/audio-test/wav`
- **Parámetros / query params:** ninguno
- **Respuesta 200:** binario `audio/wav` — mono, 16000 Hz, 8-bit
  unsigned PCM, tono de 440 Hz de 0.6s con fade in/out de 10ms
- **Headers:** `Content-Type: audio/wav`, `Content-Length`,
  `Cache-Control: public, max-age=3600`
- **Errores:** ninguno manejado explícitamente (generación pura en
  memoria, no debería fallar salvo error de runtime)
- **Dependencias externas:** ninguna
- **Uso previsto:** CYD — validar reproducción de audio crudo por DAC
  como alternativa a decodificar MP3 en el ESP32.

---

## Resumen

| Endpoint | Método | Uso previsto | Depende de |
| --- | --- | --- | --- |
| `/api/pokemon/[id]` (default) | GET | Web/CYD (bitmap OLED, uso no confirmado) | PokéAPI, sharp |
| `/api/pokemon/[id]?display=tft` | GET | CYD/TFT | PokéAPI |
| `/api/pokemon/[id]/image` | GET | CYD/TFT | PokéAPI, sharp |
| `/api/pokemon/[id]/audio` | GET | CYD | PokéAPI, AI Gateway, Blob |
| `/api/audio-test` | GET | CYD (prueba MP3) | — |
| `/api/audio-test/wav` | GET | CYD (prueba DAC/WAV) | — |
