---
name: sdd-change
description: Gestiona modificaciones, mejoras y correcciones de bugs sobre features ya especificadas o implementadas, siguiendo Spec-Driven Development: primero enmienda la spec (o la constitución), después actualiza plan y tareas, y solo entonces se toca el código. Úsala cuando el usuario quiera cambiar, mejorar, ampliar, corregir un bug o ajustar el comportamiento de algo que ya existe, o invoque /sdd-change. Fase 4 del ciclo SDD.
---

# Skill: sdd-change — Modificaciones y Mejoras

## Propósito
Evitar que un cambio vaya directo al código. Todo cambio sobre algo existente actualiza
primero los documentos que lo gobiernan y deja trazabilidad. Después devuelve el trabajo a
`sdd-implement` solo con las tareas nuevas.

## Invariantes
1. **Spec antes que código:** prohibido modificar código de aplicación en esta skill.
2. **Human in the loop:** cada documento modificado (spec, plan, tasks o constitución) se
   muestra como diff y se aprueba por separado.
3. **IDs estables:** los `RF-NN` y `TNNN` existentes nunca se renumeran. Los RF eliminados se
   marcan `~~RF-NN~~ (eliminado en vX.Y)`; los nuevos toman el siguiente número libre.
4. **Historial obligatorio:** toda modificación incrementa la versión de la spec y añade una
   fila en su "Historial de cambios".
5. **Constitución:** solo se modifica si el usuario lo aprueba explícitamente y queda
   registrada en la tabla "Enmiendas" con fecha, artículo, cambio y motivo.

## Flujo

### Paso 1: Entender y clasificar
1. Pide al usuario que describa el cambio y su motivo.
2. Identifica la(s) feature(s) afectada(s) en `specs/` y lee su `spec.md`, `plan.md`,
   `tasks.md` y `verification.md`.
3. Clasifica el cambio y confírmalo con el usuario:

| Tipo | Señal | Qué se actualiza |
|---|---|---|
| **Bug** | La spec ya dice lo correcto; el código no lo cumple | `tasks.md` (tarea con prueba de regresión) |
| **Cambio de comportamiento** | Lo que dice la spec ya no es lo deseado | `spec.md` → `plan.md` → `tasks.md` |
| **Mejora técnica** | Mismo comportamiento, otro "cómo" (rendimiento, refactor) | `plan.md` → `tasks.md` |
| **Feature nueva** | No encaja en ninguna spec existente | Derivar a `sdd-spec` y terminar aquí |
| **Enmienda constitucional** | El cambio choca con un artículo | `docs/constitution.md` primero y después lo demás |

### Paso 2: Análisis de impacto
Presenta antes de tocar nada:
- RF afectados: nuevos, modificados y eliminados.
- Pruebas existentes que cambiarán o dejarán de tener sentido.
- Archivos de código y modelo de datos afectados (incluidas migraciones).
- Otras features que dependen de lo que cambia.

### Paso 3: Enmendar documentos (en este orden y solo los necesarios)
1. **Constitución** (si aplica): diff del artículo + nueva fila en "Enmiendas". Aprobación.
2. **`spec.md`:** diff de los RF y criterios de aceptación, nueva versión y fila en el
   historial. Antes de aprobarla, pasa la spec enmendada por **`sdd-clarify`**. Aprobación.
   Al aprobarse, el estado pasa a `En implementación`.
3. **`plan.md`:** solo las secciones afectadas, con el chequeo de constitución y la matriz de
   trazabilidad actualizados. Aprobación.
4. **`tasks.md`:** añade al final una sección `## Cambio vX.Y — <resumen>` con tareas nuevas que
   continúan la numeración existente. Para un bug, la primera tarea siempre es la **prueba de
   regresión** que reproduce el fallo citando su RF. Las tareas ya hechas no se desmarcan; si
   hay que rehacer algo, se crea una tarea nueva. Aprobación.

### Paso 4: Traspaso
Cierra con:
> **CAMBIO REGISTRADO** — tareas `TNNN–TNNN` listas. Siguiente paso: `sdd-implement`,
> que al terminar lanza `sdd-verify` sobre toda la feature (no solo sobre el cambio).

## Formato del historial en `spec.md`

```markdown
## 8. Historial de cambios
| Versión | Fecha | Tipo | Cambio | RF afectados |
|---|---|---|---|---|
| 1.0 | 2026-10-15 | Inicial | Versión inicial | — |
| 1.1 | AAAA-MM-DD | Comportamiento | <resumen> | RF-03 (mod.), RF-07 (nuevo) |
```
