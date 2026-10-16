---
name: sdd-plan
description: Genera el plan técnico (plan.md) y el desglose en tareas (tasks.md) de una feature cuya spec ya está aprobada, siguiendo Spec-Driven Development. Úsala cuando el usuario quiera planificar, diseñar la solución técnica, "hacer el plan", "sacar las tasks" o desglosar una spec en tareas, o invoque /sdd-plan. Fase 2 del ciclo SDD; nunca genera código de aplicación.
---

# Skill: sdd-plan — Plan técnico + Tareas

## Propósito
Traducir una `spec.md` aprobada en **cómo** se construye (`plan.md`) y en una lista ordenada
de pasos pequeños y verificables (`tasks.md`). Es la fase 2 del ciclo SDD:
`sdd-spec` → `sdd-clarify` → **`sdd-plan`** → `sdd-implement` → `sdd-verify`.

## Invariantes
1. **Precondición:** la `spec.md` debe tener `Estado: Aprobada` y ninguna marca
   `[NECESITA CLARIFICACIÓN]`. Si no se cumple, detente y sugiere `sdd-spec`.
2. **Human in the loop:** `plan.md` y `tasks.md` se aprueban **por separado** y no se escriben
   sin aprobación explícita.
3. **Sin código de aplicación:** el plan puede incluir firmas, esquemas Zod de ejemplo, modelos
   Prisma propuestos y payloads de eventos, pero no implementaciones.
4. **Fidelidad a la spec:** el plan no añade funcionalidades fuera de la spec. Si descubres que
   falta algo, detente y propón actualizar la spec (con `sdd-spec` o `sdd-change`).
5. **Respeta la constitución y el stack de `agents.md`:** cualquier desviación se rechaza o se
   lleva como propuesta de enmienda.

## Flujo

### Paso 0: Contexto
1. Lee `agents.md`, `docs/constitution.md` y `specs/NNN-nombre/spec.md`.
2. Revisa el estado actual del código: `prisma/schema.prisma`, `src/lib/schemas`, rutas y
   componentes existentes, y los `plan.md` de otras features para reutilizar y no duplicar.
3. Si hay decisiones técnicas abiertas con varias opciones razonables, pregúntalas
   (como mucho 5, con una recomendación en cada una).

### Paso 1: Borrador de `plan.md`
Redacta el plan con la plantilla de abajo. Obligatorio:
- **Chequeo de constitución:** una fila por artículo con ✅ o ❌ y su justificación. Si hay
  algún ❌, el plan no puede aprobarse.
- **Trazabilidad:** cada RF de la spec aparece en la matriz RF → diseño → prueba.

### Paso 2: Aprobación del plan
> *"¿Apruebas `plan.md` para guardarlo y pasar al desglose en tareas?"*

Aplica cambios hasta obtener la aprobación y escribe el archivo.

### Paso 3: Borrador de `tasks.md`
Desglosa el plan en tareas con estas reglas:
- ID `T001`, `T002`… en orden de ejecución, agrupadas en fases:
  **Preparación** (dependencias, migraciones) → **Dominio** → **Servidor** → **Tiempo real** → **UI** → **E2E**.
- Cada tarea es pequeña (unas horas como mucho) y declara los RF que cubre, los archivos que
  toca, la prueba que se escribe primero y su criterio de "hecho".
- Marca con `[P]` las tareas que pueden hacerse en paralelo (no tocan los mismos archivos ni
  dependen entre sí).
- Todo RF debe quedar cubierto por al menos una tarea; indica la cobertura al final.

### Paso 4: Aprobación de las tareas
> *"¿Apruebas `tasks.md` para guardarlo y dejar la feature lista para implementar?"*

Tras la aprobación, escribe el archivo, cambia el estado de la spec a `En implementación`
y cierra con:
> **PLAN Y TAREAS APROBADOS** — siguiente paso: `sdd-implement`.

## Plantilla de `plan.md`

```markdown
# Plan NNN — <Nombre de la feature>

- **Spec:** ./spec.md (versión X.Y)
- **Fecha:** AAAA-MM-DD

## 1. Resumen técnico
Enfoque general en 3-5 frases.

## 2. Chequeo de constitución
| Artículo | Cumple | Justificación |
|---|---|---|
| I. Primacía de la spec | ✅ | |
| II. Tipado estricto | ✅ | |
| III. UI y formularios | ✅ | |
| IV. Validación y persistencia | ✅ | |
| V. TDD | ✅ | |
| VI. Integridad del voto | ✅ | |

## 3. Modelo de datos
Cambios propuestos en `prisma/schema.prisma` y migración asociada.

## 4. Contratos
- **Esquemas Zod** (`src/lib/schemas`): …
- **Server Actions / Route Handlers:** nombre, entrada, salida, errores, quién puede llamarlas.
- **Eventos Realtime:** canal, tipo (`broadcast` / `presence`), payload y quién lo emite.

## 5. UI
Rutas, componentes (shadcn/ui) y estados: cargando, vacío, error.

## 6. Matriz de trazabilidad
| RF | Diseño | Prueba (tipo y archivo) |
|---|---|---|

## 7. Riesgos y decisiones
| Decisión | Alternativas descartadas | Motivo |
|---|---|---|
```

## Plantilla de `tasks.md`

```markdown
# Tareas NNN — <Nombre de la feature>

- **Plan:** ./plan.md
- **Fecha:** AAAA-MM-DD

## Fase 1 — Preparación
- [ ] **T001** <Título>
  - **RF:** RF-01
  - **Archivos:** …
  - **Prueba primero:** `tests/unit/...` — qué debe fallar antes de implementar
  - **Hecho cuando:** …

## Fase 2 — Dominio
- [ ] **T002** [P] …

## Cobertura
| RF | Tareas |
|---|---|
```
