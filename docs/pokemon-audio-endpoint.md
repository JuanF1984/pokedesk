# Audio de Pokemon (TTS) para la CYD

Endpoint: `GET /api/pokemon/[id]/audio`

Devuelve un MP3 hablado con nombre, tipos y descripcion en espanol de un
Pokemon, pensado para que la CYD lo descargue por Wi-Fi y lo guarde en la
microSD como `/pokemon/audio/{id}.mp3`. No modifica ningun endpoint ni
comportamiento existente (`/api/pokemon/[id]`, `/api/pokemon/[id]/image`,
el front).

## Como funciona

1. `lib/pokemonAudioText.ts` arma el texto a partir de PokeAPI: nombre
   capitalizado, tipos en espanol (`TYPE_NAMES_ES`) y la primera entrada de
   `flavor_text_entries` en `es` (fallback a `en` si no hay). El texto se
   normaliza (sin caracteres de control, sin glyphs de la Zona de Uso
   Privado que a veces trae PokeAPI en textos viejos, espacios colapsados,
   tope de 400 caracteres en la descripcion).
2. El texto final se hashea (sha256, primeros 16 hex) y arma un pathname
   deterministico en Vercel Blob: `pokemon/audio/{id}-{hash}.mp3`.
3. Si ese blob ya existe (`head()`), se sirve tal cual — no se vuelve a
   llamar al TTS. Si no existe, se genera con `generateSpeech()` (paquete
   `ai`) contra `openai/tts-1` via **Vercel AI Gateway**, se sube a Blob
   (`access: public`, `addRandomSuffix: false`) y se sirve.
4. La respuesta siempre es `Content-Type: audio/mpeg` +
   `Content-Length` + `Cache-Control: public, max-age=604800, immutable`.
   Incluye ademas un header de diagnostico `X-Audio-Cache: HIT|MISS` (no
   es necesario para la CYD, solo para debug).

Archivos: `app/api/pokemon/[id]/audio/route.js`,
`lib/pokemonAudioText.ts`, `.env.example`.

## Variables de entorno

- `AI_GATEWAY_API_KEY` — opcional en Vercel (usa el OIDC token de la
  plataforma automaticamente); hace falta solo si se corre localmente sin
  `vercel env pull`.
- `BLOB_READ_WRITE_TOKEN` — no hace falta en Vercel: el store esta
  conectado al proyecto via OIDC (`BLOB_STORE_ID` se inyecta solo). Hace
  falta un token clasico solo para usar la Vercel CLI (`vercel blob ...`)
  o para correr `pnpm dev` local sin un deployment real.

**Importante:** el Blob store (`pokedesk-audio`, `store_wSlJji0OyXtFMGeS`)
esta conectado solo a **Preview y Production**, no a Development. Correr
`pnpm dev` local va a fallar al generar audio (o vas a necesitar pegar un
`BLOB_READ_WRITE_TOKEN` manualmente en `.env.local`) hasta que se conecte
tambien a Development desde el dashboard de Vercel
(Storage -> pokedesk-audio -> Connect Project).

## Verificado

- `npx tsc --noEmit` y `pnpm build` sin errores.
- Deploy de preview y prueba real en navegador: Bulbasaur (id 1) reproduce
  bien (nombre + tipos + descripcion en espanol).
- Cache de Blob confirmada via logs del servidor (`vercel logs`): primer
  pedido a un Pokemon nunca antes generado (Squirtle, id 7) logueo
  `cache=MISS`; pedidos siguientes al mismo id loguearon `cache=HIT`.
- Tamano real de referencia: Pikachu (id 25) devolvio
  `Content-Length: 155040` (~151 KB).
- URL de ejemplo probada (preview, requiere estar logueado a Vercel por la
  proteccion SSO de las previews):
  `https://pokedesk-j0l5p33jo-juan-ferreyras-projects.vercel.app/api/pokemon/{id}/audio`

## URL en produccion

El proyecto todavia no tiene ningun deploy promovido a Production (todos
los deploys hasta ahora fueron preview). Una vez que se haga
`vercel deploy --prod` (o se conecte el deploy automatico de Vercel al
push a `main`), el endpoint va a quedar en:

```
https://pokedesk.vercel.app/api/pokemon/{id}/audio
```

(confirmar el dominio exacto con `vercel project inspect pokedesk` despues
del primer deploy a Production — puede variar segun disponibilidad del
subdominio).

## Pendiente / para retomar

- **Limpieza manual:** durante las pruebas de este endpoint se crearon 5
  Blob stores por error (problemas linkeando por CLI en un shell no
  interactivo). Solo `pokedesk-audio` (`store_wSlJji0OyXtFMGeS`) quedo
  conectado al proyecto y es el que usa el endpoint. Los otros 4 quedaron
  sueltos, sin usar, y hay que borrarlos a mano desde el dashboard
  (Storage): `store_RlewR5BjVOb5yXMx`, `store_KgZW7ZYdcA6tLbLX`,
  `store_alrRSdnBfcdvtU8I`, `store_xyD16sRZ3m6xvqXz`.
- Conectar el Blob store a Development si se quiere probar con
  `pnpm dev` local sin depender de un deployment.
- Promover a Production cuando se decida.
- Firmware de la CYD: todavia no se toco (a proposito, pedido explicito
  de no modificarlo en esta sesion). El proximo paso natural es que
  descargue `GET /api/pokemon/{id}/audio` con un `HTTPClient::GET` normal
  (sin `Range`) y lo guarde en `/pokemon/audio/{id}.mp3`.
- Digimon: no integrado, tal como se pidio.
