# PokeDesk

Pokédex progresiva (PWA) construida en Next.js, pensada originalmente como
regalo/proyecto de aprendizaje para un nene de 6 años: navegación 100%
visual, sin buscador de texto, con la estética de una Pokédex roja clásica.

El mismo backend además sirve datos, imágenes y audio pensados para un
dispositivo físico basado en **ESP32 + pantalla TFT (CYD — "Cheap Yellow
Display")** que consume estos endpoints por Wi-Fi.

> **El firmware de la CYD vive en `arduino/` y queda completamente fuera del
> alcance de esta documentación.** Todo lo que sigue describe únicamente el
> proyecto web (Next.js) y sus endpoints, desde el lado del servidor.

## Funcionalidades principales

- Grid principal con scroll infinito de todos los Pokémon (PokéAPI), 2
  columnas en mobile y hasta 4 en desktop.
- Página de detalle por Pokémon: artwork, tipos, altura/peso, stats y
  cadena de evolución.
- Narración por voz del nombre, tipo y descripción usando la Web Speech
  API del navegador (solo en la web, ver [`docs/architecture.md`](docs/architecture.md)).
- Instalable como PWA (manifest + metadata; ver limitaciones conocidas en
  [`docs/development-notes.md`](docs/development-notes.md)).
- API JSON/imagen/audio pensada para un cliente embebido (ESP32 + TFT):
  payload liviano en español, JPEG chico ya procesado, bitmap monocromo
  1bpp y audio TTS cacheado.

## Stack tecnológico

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS v4**
- **pnpm** como gestor de paquetes
- **sharp** para procesamiento de imágenes server-side (JPEG y bitmap 1bpp)
- **Vercel AI Gateway** (paquete `ai`) para texto-a-voz (`openai/tts-1`)
- **Vercel Blob** para cachear los MP3 generados
- **PokéAPI** (`https://pokeapi.co/api/v2`) como única fuente de datos de
  Pokémon, sin autenticación
- Deploy en **Vercel**

Ver el detalle completo de arquitectura, flujos y endpoints en:
[`docs/architecture.md`](docs/architecture.md) y [`docs/api.md`](docs/api.md).

## Requisitos

- Node.js 20+ (recomendado, acorde a `@types/node ^20`)
- pnpm
- Una cuenta de Vercel con el proyecto vinculado si se quiere probar el
  endpoint de audio localmente (ver más abajo y
  [`docs/deployment-and-environment.md`](docs/deployment-and-environment.md))

## Instalación

```bash
pnpm install
```

`pnpm` 11+ bloquea scripts de build de dependencias nativas por defecto.
`sharp` los necesita para instalar su binario; este repo ya trae
`pnpm-workspace.yaml` con `allowBuilds.sharp: true`, así que no hace falta
ningún paso manual adicional en una instalación limpia.

## Ejecución local

```bash
pnpm dev
```

Abrí [http://localhost:3000](http://localhost:3000).

**Importante:** el endpoint `GET /api/pokemon/[id]/audio` depende de
Vercel Blob y del AI Gateway. El store de Blob del proyecto
(`pokedesk-audio`) hoy está conectado solo a **Preview** y **Production**,
no a **Development**, así que generar audio en `pnpm dev` va a fallar salvo
que se pegue un `BLOB_READ_WRITE_TOKEN` manual en `.env.local` (ver
[`docs/deployment-and-environment.md`](docs/deployment-and-environment.md)).
El resto de la app (grid, detalle, imagen, bitmap) funciona sin ninguna
variable de entorno.

## Comandos disponibles

| Comando      | Descripción                          |
| ------------ | ------------------------------------- |
| `pnpm dev`   | Servidor de desarrollo (Next.js)      |
| `pnpm build` | Build de producción                   |
| `pnpm start` | Sirve el build de producción          |

No hay script de test ni de lint configurado en `package.json` actualmente.

## Variables de entorno

Ver `.env.example`. Ambas son opcionales en Vercel (usan el token OIDC de
la plataforma automáticamente) y solo hacen falta en local si se quiere
probar el endpoint de audio sin un deployment real:

- `AI_GATEWAY_API_KEY`
- `BLOB_READ_WRITE_TOKEN`

Detalle completo en [`docs/deployment-and-environment.md`](docs/deployment-and-environment.md).

## Despliegue

El proyecto está vinculado a Vercel (`vercel link`), proyecto `pokedesk`.
Deploy estándar:

```bash
vercel deploy         # preview
vercel deploy --prod  # production
```

Detalles de entorno, protección SSO de los deployments Preview, y cómo
verificar un deploy en [`docs/deployment-and-environment.md`](docs/deployment-and-environment.md).

## Documentación detallada

- [`docs/architecture.md`](docs/architecture.md) — estructura del proyecto,
  flujos de datos/imagen/audio, decisiones de renderizado.
- [`docs/api.md`](docs/api.md) — inventario completo de endpoints.
- [`docs/deployment-and-environment.md`](docs/deployment-and-environment.md) —
  Vercel, variables de entorno, Blob, AI Gateway, diferencias entre entornos.
- [`docs/development-notes.md`](docs/development-notes.md) — decisiones
  técnicas, deuda técnica, limitaciones y relación con el firmware de la CYD.
