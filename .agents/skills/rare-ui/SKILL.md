---
name: rare-ui
description: >-
  Guía y catálogo para instalar y usar componentes interactivos y animados de Rare UI
  (https://github.com/swamimalode07/rare-ui) en aplicaciones Next.js/React con Tailwind CSS y Motion.
---

# Rare UI Integration Skill

Esta skill proporciona las instrucciones y referencias para utilizar e instalar componentes de **Rare UI** (`swamimalode07/rare-ui`) en este proyecto.

## ¿Qué es Rare UI?
Rare UI es un registro abierto de componentes visuales avanzados para React / Next.js creados con:
- **Tailwind CSS** (estilos utilitarios)
- **Framer Motion / Motion** (animaciones fluidas)
- **TypeScript**
- Compatible con el registro de **shadcn/ui**.

## Repositorio Oficial
- GitHub: https://github.com/swamimalode07/rare-ui
- Documentación y catálogo en vivo: https://rareui.com

---

## 1. Configuración de Registro en el Proyecto (`apps/web`)

Si el proyecto usa `components.json` de shadcn, se puede registrar el endpoint remoto en la raíz del frontend (`apps/web/components.json`):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  },
  "registries": {
    "@rare-ui": "https://raw.githubusercontent.com/swamimalode07/rare-ui/main/public/r/{name}.json"
  }
}
```

---

## 2. Instalación de Componentes

### Vía CLI de shadcn:
```bash
npx shadcn@latest add "https://raw.githubusercontent.com/swamimalode07/rare-ui/main/public/r/<component-name>.json"
```
O usando el alias si `components.json` está configurado:
```bash
npx shadcn@latest add @rare-ui/<component-name>
```

### Dependencias habituales de Rare UI:
La mayoría de los componentes de Rare UI requieren `motion` o `framer-motion`:
```bash
npm install motion clsx tailwind-merge
```

---

## 3. Componentes Destacados disponibles en Rare UI:
- `fluid-orb`: Esfera líquida con shaders y animaciones interactivas.
- `animated-folder`: Carpeta expandible interactiva.
- `fluid-cursor`: Efecto de cursor fluido y dinámico.
- `magnetic-button`: Botón con atracción magnética hacia el puntero.
- `glow-card`: Tarjetas con borde interactivo con gradientes de luz.
- `dock`: Barra estilo macOS Dock con magnificación de íconos.
- `tilt-card`: Tarjeta con inclinación 3D en base al movimiento del mouse.
