# Notas de desarrollo

## Decisiones técnicas relevantes

- **`images.unoptimized: true`**: se optó por no usar el optimizador de
  imágenes de Next para simplificar el manejo de múltiples hosts externos
  (PokéAPI, GitHub) sin configurar `remotePatterns` por cada uno, y para
  evitar el costo de optimización on-demand en Vercel. Ver
  [`architecture.md`](architecture.md).
- **`serverExternalPackages` + `outputFileTracingIncludes` para `sharp`**:
  necesario porque el binding nativo de `sharp` se carga con `dlopen()`
  en runtime, invisible al tracing estático de Vercel. Sin esto, el
  deploy funciona pero los endpoints que usan `sharp` fallan en
  producción con `ERR_DLOPEN_FAILED`. Los globs apuntan directo al
  content-store de pnpm (`.pnpm/@img+sharp-linux-x64@*/...`) en vez de
  a través del symlink de `node_modules/@img/*`, porque empaquetar el
  symlink directamente produjo el error de Vercel "invalid deployment
  package... symlinked directories" en un intento anterior.
- **`allowBuilds.sharp: true` en `pnpm-workspace.yaml`**: pnpm 11 mueve
  las aprobaciones de scripts de build desde `package.json` a
  `pnpm-workspace.yaml`; el campo viejo en `package.json` se ignora en
  silencio. Sin esto, `sharp` no compila su binario al instalar.
- **Bitmap monocromo con múltiples estrategias + scoring** en
  `lib/spriteBitmap.js`: en vez de una sola técnica de binarización
  (threshold fijo), se corren 5 estrategias (threshold fijo, Otsu, Otsu +
  contorno, Floyd-Steinberg, Atkinson) y se puntúan con una heurística
  (proporción de píxeles encendidos, cobertura del contorno, tamaño del
  componente conexo más grande, cantidad de detalle interno, penalización
  por ruido/blobs sueltos) porque ninguna técnica sola funciona bien para
  todos los sprites (claros, oscuros, de bajo contraste, muy detallados).
- **Dos implementaciones independientes de fetch de descripción de
  especie** (`app/api/pokemon/[id]/route.js` y
  `lib/pokemonAudioText.ts`): decisión deliberada al agregar el endpoint
  de audio, para no modificar el comportamiento ni el código del
  endpoint `/api/pokemon/[id]` ya existente. Es una duplicación
  conocida, no un descuido — ver "Duplicaciones" más abajo.

## Pruebas realizadas (según lo documentado en el proyecto)

- `npx tsc --noEmit` y `pnpm build` sin errores tras agregar el endpoint
  de audio.
- Deploy de Preview con prueba real en navegador: Bulbasaur (id 1)
  reprodujo correctamente nombre + tipos + descripción en español.
- Confirmación de caché de Blob vía `vercel logs`: primer pedido a un
  Pokémon nunca antes generado (Squirtle, id 7) logueó `cache=MISS`;
  pedidos siguientes al mismo id logueron `cache=HIT`.
- Tamaño de referencia observado: Pikachu (id 25),
  `Content-Length: 155040` (~151 KB).

**No confirmable desde este repo:** no hay tests automatizados (no hay
`pnpm test` ni carpeta de tests), y no hay evidencia en el código de que
se haya probado el endpoint `/api/pokemon/[id]?display=tft` o el modo
bitmap default contra un firmware real de la CYD.

## Problemas ya resueltos

- `ERR_DLOPEN_FAILED` en producción por el binding nativo de `sharp` no
  detectado por el tracing automático → resuelto con
  `outputFileTracingIncludes` (ver arriba).
- Error "invalid deployment package... symlinked directories" al incluir
  `sharp` → resuelto apuntando los globs al content-store real de pnpm en
  vez de al symlink.
- `pnpm install` bloqueando el build script de `sharp` bajo pnpm 11 →
  resuelto con `allowBuilds.sharp: true` en `pnpm-workspace.yaml`.

## Limitaciones conocidas

- **PWA incompleta**: `next-pwa` está en `package.json` pero **no está
  configurado en `next.config.ts`** (no envuelve `nextConfig`). No hay
  `public/sw.js` generado ni service worker registrado. La app es
  instalable (gracias al `manifest.json` y a la metadata de
  `app/layout.tsx`) pero **no tiene caché offline real** — si el
  dispositivo pierde conexión, no va a poder cargar Pokémon nuevos ni
  reusar assets cacheados por un service worker, porque no existe. Esto
  contradice la intención original documentada en
  `.claude/commands/pokedex-init.md` ("Service Worker básico via
  next-pwa"). No se corrigió como parte de esta tarea de documentación
  (no es un link roto, es una brecha de funcionalidad que requiere
  decisión de producto/implementación).
- El endpoint `/api/pokemon/[id]/audio` no tiene rate limiting propio.
- El modo bitmap de `/api/pokemon/[id]` (sin `?display=tft`) no tiene
  consumidor confirmado en el código de este repo.
- No hay manejo de Pokémon con `id` fuera de rango de forma distinta a
  cualquier otro 404 de PokéAPI (comportamiento delegado enteramente a
  la respuesta de PokéAPI).

## Deuda técnica y duplicaciones

- **Duplicación de lógica de fetch/descripción**: `route.js` de
  `/api/pokemon/[id]` y `lib/pokemonAudioText.ts` obtienen y procesan
  `flavor_text_entries` de forma independiente, con normalización de
  texto ligeramente distinta (uno solo colapsa saltos de línea/espacios,
  el otro además filtra caracteres de control y Private Use Area).
  Unificar requeriría tocar el endpoint existente, lo cual se evitó a
  propósito — ver nota sobre la CYD más abajo antes de encararlo.
- **`next-pwa` sin usar** (ver Limitaciones arriba) — o se termina de
  configurar, o se remueve la dependencia para no confundir a quien lea
  `package.json` esperando una PWA con caché offline funcional.
- **Blob stores huérfanos**: durante las pruebas del endpoint de audio se
  crearon por error varios Blob stores adicionales al vincular el
  proyecto por CLI en un shell no interactivo. Solo uno
  (`pokedesk-audio`) quedó conectado y en uso; los demás quedaron sueltos
  sin usar y deberían borrarse a mano desde el dashboard de Vercel
  (Storage) — **confirmar en el dashboard actual cuáles siguen existiendo**,
  ya que esta nota viene de un estado anterior del proyecto y no se
  revalidó como parte de esta documentación.
- **Vercel Blob no conectado a Development**: obliga a cualquiera que
  quiera developear el endpoint de audio localmente a configurar un
  token manual. Conectar el store a Development eliminaría ese paso.
- `public/` conserva SVGs default de `create-next-app`
  (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) que
  no se referencian en ningún componente — candidatos a limpieza si se
  confirma que no se usan.

## Tareas futuras sugeridas

- Decidir el destino de `next-pwa`: configurarlo de verdad (caché offline
  real) o quitarlo.
- Si se confirma que ningún cliente usa el modo bitmap default de
  `/api/pokemon/[id]`, evaluar si vale la pena mantenerlo o documentarlo
  como experimental/deprecado.
- Conectar el Blob store `pokedesk-audio` a Development.
- Revisar y borrar los Blob stores huérfanos desde el dashboard.
- Si se decide unificar la obtención de descripción entre `route.js` y
  `pokemonAudioText.ts`, hacerlo como cambio explícito y probado, no
  como efecto colateral de otra tarea — afecta tanto a la web como al
  contrato que consume la CYD.
- Agregar un script de lint/test a `package.json` si el proyecto crece
  (hoy no hay ninguno configurado).

## Cambios que no deberían hacerse sin revisar impacto en la CYD

- Cualquier cambio en la forma del JSON de `?display=tft`
  (`displayName`, `types[].nameEs`, `stats.*`, `imageUrl`, etc.): es un
  contrato consumido por un cliente embebido externo a este repo.
- Cambios en el tamaño (160x160), formato (JPEG) o headers
  (`Content-Length`, `Content-Type`) de `/api/pokemon/[id]/image`.
- Cambios en el formato de audio (`audio/mpeg`), en la voz/modelo TTS, o
  en la política de `Cache-Control` de `/api/pokemon/[id]/audio` — un
  cliente que ya cacheó un MP3 en microSD asumiendo estos headers podría
  comportarse distinto.
- Cambios en `lib/spriteBitmap.js` (formato `adafruit_gfx_1bpp`, tamaño
  máximo `MAX_SIZE = 64`) si en algún momento se confirma un consumidor
  real de ese modo.
- Renombrar o mover cualquiera de las rutas bajo `app/api/pokemon/[id]/**`
  o `app/api/audio-test/**` sin coordinar con quien mantiene el firmware.

## Relación con el firmware

Sin analizar ni documentar el contenido de `arduino/` (fuera de
alcance), esto es lo que se puede afirmar **desde el lado web** sobre
qué consumiría o podría consumir un cliente tipo CYD:

- **Endpoints pensados explícitamente para la CYD**, según los propios
  comentarios del código:
  - `GET /api/pokemon/[id]?display=tft` — payload JSON liviano en
    español.
  - `GET /api/pokemon/[id]/image` — JPEG 160x160 ya aplanado.
  - `GET /api/pokemon/[id]/audio` — MP3 TTS cacheado, mencionado en el
    código como pensado para guardarse en microSD como
    `/pokemon/audio/{id}.mp3` vía `HTTPClient::GET` simple (sin
    `Range`) — **esto describe la intención documentada en el código
    de este repo, no algo confirmado dentro de `arduino/`**.
  - `GET /api/audio-test` y `GET /api/audio-test/wav` — endpoints de
    prueba explícitamente para validar reproducción de audio en el
    ESP32 (MP3 vía librería decodificadora, y WAV crudo vía DAC
    respectivamente).
- **Formatos y headers esperados:**
  - Todas las respuestas binarias incluyen `Content-Length` de forma
    explícita (no dependen de chunked transfer), lo cual es más simple
    de manejar para un cliente HTTP embebido con memoria limitada.
  - `Content-Type` siempre correcto (`image/jpeg`, `audio/mpeg`,
    `audio/wav`) para que un cliente pueda decidir el path de decodeo
    sin inspeccionar bytes.
- **Restricciones de tamaño:**
  - La imagen se fuerza a 160x160 y JPEG calidad 82 específicamente para
    mantener el archivo chico y evitar que el ESP32 tenga que manejar
    canal alfa.
  - La descripción hablada se recorta a 400 caracteres antes de mandarse
    a TTS, lo que además acota el tamaño del MP3 resultante.
  - El bitmap monocromo tiene un tamaño máximo de 64x64 (`MAX_SIZE`),
    pensado para displays chicos tipo OLED, no para el TFT de mayor
    resolución (que en cambio usa el JPEG).
- **Imágenes adaptadas:** confirmado que existe una ruta dedicada
  (`/image`) que reprocesa el artwork oficial específicamente para
  reducir su complejidad de decodeo en el dispositivo, en vez de que la
  CYD consuma el PNG con alfa que sirve PokéAPI directamente.
- **MP3 cacheados:** confirmado que el endpoint de audio evita
  regenerar el mismo audio en cada pedido gracias al cacheo en Vercel
  Blob — relevante para el firmware porque pedidos repetidos al mismo
  id van a ser rápidos (solo lectura de Blob) después del primer MISS.
- **Consideraciones de compatibilidad con ESP32** (inferidas del lado
  del servidor, no verificadas contra `arduino/`):
  - `Content-Length` explícito en todas las respuestas binarias facilita
    a un cliente embebido reservar buffer o hacer streaming a SD con
    tamaño conocido de antemano.
  - El WAV de `/api/audio-test/wav` está deliberadamente en un formato
    "cero decodificación" (PCM 8-bit sin comprimir) como alternativa al
    MP3, que sí requiere una librería decodificadora en el firmware.
  - No hay compresión HTTP (gzip/br) evidente en el código de estos
    endpoints — los binarios (imagen, audio) no se beneficiarían de eso
    de todos modos al ya estar comprimidos en su propio formato.

**No confirmable desde este repo:** qué endpoints consume realmente el
firmware hoy, con qué frecuencia, ni si maneja reintentos/errores de red
de alguna forma particular — todo eso vive en `arduino/`, fuera del
alcance de esta documentación.
