# agents.md — Planning Poker

Guía operativa para agentes de IA y desarrolladores que trabajan en este repositorio.
Antes de cualquier cambio, lee `docs/constitution.md`: sus principios son innegociables.

## 1. Descripción general

Aplicación web de **Planning Poker** para el equipo de desarrollo. Cada jugador estima
una tarea eligiendo en secreto una carta virtual, y el moderador revela todos los votos
a la vez para discutir y acordar la estimación final.

- **Usuarios:** equipo interno, sin registro.
- **Acceso:** link de la sala + apodo. Quien crea la sala es el **moderador**.
- **Baraja:** Fibonacci → `0, 1, 2, 3, 5, 8, 13, 21, ?, ☕`
- **Persistencia:** se guardan salas, tareas y estimaciones finales (historial).
- **Despliegue:** Vercel.

## 2. Arquitectura

App **Next.js full-stack** (App Router) desplegada en Vercel.

- **Lecturas y escrituras de negocio:** Server Actions y Route Handlers → Prisma → Postgres (Supabase).
- **Tiempo real:** Supabase Realtime (canal por sala).
  - `presence`: qué jugadores están conectados.
  - `broadcast`: eventos de la sala (votó, revelar, nueva ronda, cambio de tarea).
- Vercel no mantiene WebSockets en sus funciones serverless, así que **todo el tiempo real
  pasa por Supabase**, nunca por un servidor propio.

### Estructura de carpetas

```
.
├── agents.md
├── docs/
│   └── constitution.md
├── .claude/skills/        # Skills del ciclo SDD (sdd-spec, sdd-clarify, sdd-plan, sdd-implement, sdd-verify, sdd-change)
├── specs/                 # Una carpeta por feature
│   └── 001-nombre/
│       ├── spec.md        # Qué y por qué (RF-01…)
│       ├── plan.md        # Cómo (diseño técnico)
│       ├── tasks.md       # Tareas ordenadas (T001…)
│       └── verification.md  # Resultado de la verificación
├── prisma/
│   ├── schema.prisma      # Única fuente de verdad de la BD
│   └── migrations/
├── src/
│   ├── app/               # Rutas, layouts y páginas (App Router)
│   ├── components/        # Componentes de UI (shadcn/ui en components/ui)
│   ├── lib/               # Lógica de dominio pura, esquemas Zod, cliente Supabase
│   └── server/            # Server Actions y acceso a datos
└── tests/
    ├── unit/              # Vitest
    └── e2e/               # Playwright
```

## 3. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Lenguaje | TypeScript (strict) |
| Framework | Next.js (App Router) |
| UI | Tailwind CSS + shadcn/ui |
| Formularios | React Hook Form + Zod |
| Base de datos | PostgreSQL (Supabase) |
| ORM | Prisma |
| Tiempo real | Supabase Realtime (broadcast + presence) |
| Pruebas | Vitest (unitarias) + Playwright (e2e) |
| Paquetes | pnpm |
| Hosting | Vercel |

## 4. Comandos principales

| Acción | Comando |
|---|---|
| Servidor de desarrollo | `pnpm dev` |
| Pruebas unitarias | `pnpm test` |
| Pruebas e2e | `pnpm test:e2e` |
| Lint y formato | `pnpm lint` · `pnpm format` |
| Chequeo de tipos | `pnpm typecheck` (`tsc --noEmit`) |
| Crear/aplicar migración | `pnpm prisma migrate dev` |
| Regenerar cliente Prisma | `pnpm prisma generate` |

## 5. Convenciones

### Idioma

- **Código** (variables, funciones, tipos, nombres de archivo): inglés.
- **Comentarios, textos de UI, specs y documentación:** español.

### Nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Variables y funciones | `camelCase` | `revealVotes` |
| Componentes, tipos y clases | `PascalCase` | `VotingCard` |
| Archivos y carpetas | `kebab-case` | `voting-card.tsx` |
| Constantes | `UPPER_SNAKE_CASE` | `FIBONACCI_DECK` |

## 6. Flujo de trabajo SDD

Cada fase tiene su skill y termina con la aprobación explícita de un humano.

| Fase | Skill | Resultado |
|---|---|---|
| 0. Setup (una vez) | `sdd-generator` | `agents.md`, `docs/constitution.md` |
| 1. Especificación | `sdd-spec` | `specs/NNN-nombre/spec.md` |
| 2. Clarificación | `sdd-clarify` | spec sin ambigüedades (sección "Clarificaciones") |
| 3. Plan técnico + tareas | `sdd-plan` | `plan.md`, `tasks.md` |
| 4. Implementación (TDD) | `sdd-implement` | código y pruebas |
| 5. Verificación | `sdd-verify` | `verification.md` |
| 6. Modificaciones y mejoras | `sdd-change` | spec enmendada + nuevas tareas → vuelve a la fase 4 |

`sdd-spec` lanza `sdd-clarify` antes de aprobar y `sdd-implement` lanza `sdd-verify` al terminar.
Las dos se pueden ejecutar también por separado en cualquier momento.

Estados de una spec: `Borrador` → `Aprobada` → `En implementación` → `Implementada`.

Reglas del ciclo:
- Sin `spec.md` aprobada no hay plan; sin `tasks.md` aprobado no hay código.
- Cada tarea se hace en TDD: prueba en rojo → implementación mínima → verde.
- La verificación exige `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde.
- Cualquier cambio en una feature ya implementada pasa por `sdd-change`, nunca directo al código.

## 7. Reglas para agentes

- No implementes nada que no esté en una spec aprobada.
- Ante una ambigüedad en la spec, **pregunta**; no la resuelvas por tu cuenta.
- No modifiques `docs/constitution.md` sin aprobación explícita.
- No edites la BD fuera de `prisma/schema.prisma` + migraciones.
- No subas secretos: las claves de Supabase van en `.env.local` y en las variables de entorno de Vercel.
