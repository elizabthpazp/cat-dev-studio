# 🐱 Cat Dev Studio: The Bug Hunters

Un juego de gestión en 3D donde lideras un equipo de gatos desarrolladores para sacar un sprint a producción antes de que acabe la jornada.

![Babylon.js](https://img.shields.io/badge/Babylon.js-7.x-e8785e?logo=babylondotjs) ![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178c6?logo=typescript) ![Vite](https://img.shields.io/badge/Vite-6.x-646cff?logo=vite)

---

## Sobre el juego

Tienes hasta las 18:00 para completar cinco hitos de un sprint real: definir el encargo, construir la feature, revisar el código, hacer QA y desplegar. En cada hito aparece un **pergamino con una decisión técnica**: acierta para avanzar, falla y el bug count sube.

### El equipo

| Personaje | Rol | Especialidad |
|-----------|-----|-------------|
| **Michi PM** | Project Manager | Aterrizar el encargo del cliente |
| **Michi Jr.** | Dev Junior | Construir la feature |
| **Gatardo** | Dev Senior | Revisión de código y despliegue |
| **Doña QA** | QA Engineer | Pruebas antes de producción |

### Mecánicas

- **Energía y estrés** — cada gato se desgasta mientras trabaja; si el estrés sube demasiado, la moral del equipo cae.
- **Café** — envía a un gato a la máquina de café (+30 energía, −15 estrés) a cambio de presupuesto.
- **Decisiones técnicas** — cinco preguntas de programación real que determinan si el hito avanza limpio o introduce un bug.
- **Condiciones de derrota** — se acaba la jornada, la moral llega a cero, o se acumulan 5 bugs en producción.
- **Estrellas** — de 1 a 3 según los bugs acumulados y la moral final.

---

## Stack técnico

- **[Babylon.js 7](https://www.babylonjs.com/)** — motor 3D (escena, cámara arc-rotate, sombras, animaciones GLB)
- **TypeScript 5** — tipado estricto en todo el código
- **Vite 6** — dev server y build
- **Modelos GLB** — personajes y props propios en `/public/assets/`

---

## Instalación y desarrollo

```bash
# Instalar dependencias
npm install

# Servidor de desarrollo
npm run dev

# Build de producción
npm run build

# Previsualizar el build
npm run preview
```

> Requiere Node.js 18+ o Bun.

---

## Estructura del proyecto

```
src/
├── assets/         # Registro de assets y cargador de modelos GLB
├── characters/     # CatActor: animaciones, caminar, sentarse, celebrar
├── engine/         # OfficeScene: escena 3D, iluminación, tablero kanban
├── game/
│   ├── Game.ts     # Bucle principal, fases y acciones del jugador
│   ├── store.ts    # Estado global, guardado en localStorage
│   ├── challenges.ts # Preguntas técnicas por hito
│   └── layout.ts   # Posiciones y orientaciones de cada puesto
└── ui/
    ├── GameUI.ts   # Toda la UI HTML superpuesta al canvas
    ├── sfx.ts      # Efectos de sonido
    └── styles.css  # Estilos del HUD y los modales

public/assets/
├── characters/     # junior_cat, senior_cat, project_manager_cat, qa_cat (.glb)
└── props/          # Escritorios, monitores, sillas, teclados, café (.glb)
```

---

## Controles

| Tecla | Acción |
|-------|--------|
| `1` `2` `3` `4` | Seleccionar gato (PM, Junior, Senior, QA) |
| `Espacio` / `Enter` | Abrir hito activo |
| `C` | Enviar al gato seleccionado por café |
| `V` | Vista general de la oficina |
| `Escape` | Pausar / cerrar modal |
| `M` | Silenciar / activar sonido |
| Clic en gato o monitor | Seleccionar / abrir hito |
| Clic en cafetera | Café para el gato seleccionado |

---

## Guardado

El progreso se guarda automáticamente en `localStorage` cada 5 segundos y al pausar. Al volver a abrir el juego puedes retomar la partida desde el título.

---

## Licencia

Proyecto privado — todos los assets y código son originales del equipo.
