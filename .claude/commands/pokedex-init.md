# Pokedex para Bauti — Proyecto Next.js PWA

## Objetivo
Crear una Pokédex PWA completa en Next.js + TypeScript + Tailwind.
Pública, sin auth, sin backend. Deploy en Vercel.
Pensada para un nene de 6 años en celular: sin búsqueda de texto, navegación visual.

## Antes de escribir cualquier código
Leer `/mnt/skills/public/frontend-design/SKILL.md` completo y aplicar sus criterios.

## Stack
- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- PokéAPI: https://pokeapi.co/api/v2 (sin auth)
- pnpm

## Estructura de pantallas

### Pantalla principal — Grid
- Grid 2 columnas en móvil, 3-4 en desktop
- Scroll infinito: carga los primeros 20, agrega 20 más al llegar al final
- Cada tarjeta:
  - Fondo de color según tipo primario del Pokémon
  - Imagen oficial: `sprites.other["official-artwork"].front_default`
  - Número (#001)
  - Nombre
  - Badge(s) de tipo con ícono SVG inline + nombre del tipo

### Pantalla detalle — /pokemon/[id]
- Imagen grande centrada
- Número y nombre grandes
- Badges de tipo con ícono + nombre
- Barras de stats (HP, Ataque, Defensa, Ataque Esp., Defensa Esp., Velocidad)
  - Coloreadas, con label y valor numérico
  - Max referencia: 255
- Altura y peso con íconos (📏 y ⚖️ o SVG)
- Botones ← → grandes y táctiles para ir al anterior/siguiente Pokémon
- Botón volver al grid

## Estética — Pokédex roja clásica
- Color dominante: rojo `#CC0000` con degradado a `#AA0000`
- Bordes negros gruesos, estilo plástico
- "Pantalla" interna con fondo `#1a1a2e` o azul oscuro donde se muestra el Pokémon
- Tipografía: `Press Start 2P` de Google Fonts para títulos/números,
  `Nunito` para textos secundarios (legible y redondeada)
- Luz decorativa azul circular en el header (detalle icónico de la Pokédex)
- Sombras y bordes que den profundidad al panel

## Colores por tipo (fondo de tarjeta y badges)
Usar estos hex:
normal: #A8A878, fire: #F08030, water: #6890F0,

electric: #F8D030, grass: #78C850, ice: #98D8D8,

fighting: #C03028, poison: #A040A0, ground: #E0C068,

flying: #A890F0, psychic: #F85888, bug: #A8B820,

rock: #B8A038, ghost: #705898, dragon: #7038F8,

dark: #705848, steel: #B8B8D0, fairy: #EE99AC

## Íconos de tipo
Usar los SVG oficiales de https://www.serebii.net/pokedex-sv/type/ NO.
En cambio, crear componente `<TypeIcon type="fire" />` que renderice
íconos SVG inline simples y reconocibles para cada tipo.
Alternativamente, usar imágenes de:
`https://raw.githubusercontent.com/duiker101/pokemon-type-svg-icons/master/icons/{type}.svg`

## PWA
- `public/manifest.json` con nombre "Pokédex de Bauti", short_name "Pokédex",
  theme_color "#CC0000", background_color "#CC0000", display "standalone",
  orientation "portrait"
- Íconos en `public/icons/`: al menos 192x192 y 512x512 (puede ser placeholder rojo con Poké Ball)
- Service Worker básico via `next-pwa` para cacheo de assets estáticos

## API — PokéAPI
Endpoints a usar:
- Lista: `GET https://pokeapi.co/api/v2/pokemon?limit=20&offset=N`
- Detalle: `GET https://pokeapi.co/api/v2/pokemon/{id}`

Para el grid, cada tarjeta necesita datos del detalle (imagen + tipos).
Estrategia: al cargar el grid, fetch paralelo de los 20 pokémon del lote.
Cachear en memoria (o usar SWR/React Query si lo ves conveniente).

## Estructura de archivos sugerida
app/

page.tsx              ← grid principal

pokemon/[id]/

page.tsx            ← detalle

components/

PokemonCard.tsx

TypeBadge.tsx

TypeIcon.tsx

StatBar.tsx

PokedexFrame.tsx      ← wrapper con estética de Pokédex

lib/

api.ts                ← funciones fetch a PokéAPI

types.ts              ← tipos TypeScript

typeColors.ts         ← mapa de colores por tipo

public/

manifest.json

icons/

## Consideraciones UX (nene de 6 años en celular)
- Botones táctiles mínimo 56px de alto
- Tap targets grandes en las tarjetas
- Sin ningún input de texto
- Animación suave al abrir detalle (fade o slide)
- Loading state con Poké Ball animada o skeleton

## Notas finales
- Usar `pnpm` para todo
- El proyecto debe quedar listo para `vercel deploy`
- Testear mentalmente que funcione sin JS deshabilitado no es necesario,
  pero sí que el primer render sea rápido (Next.js SSR/SSG donde aplique)
- Los nombres de Pokémon capitalizarlos (la API los devuelve en minúscula)