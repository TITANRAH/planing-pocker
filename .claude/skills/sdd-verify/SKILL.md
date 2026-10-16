---
name: sdd-verify
description: Verifica en modo solo lectura que una feature cumple su spec y la constitución: ejecuta lint, typecheck y pruebas, arma la matriz RF → prueba → resultado, audita el código contra cada artículo y escribe verification.md. Úsala cuando el usuario quiera verificar, auditar, validar o comprobar una feature ("¿está lista?", "¿cumple la spec?", antes de desplegar o después de un cambio), o invoque /sdd-verify. También la invoca sdd-implement al terminar las tareas. Nunca modifica código.
---

# Skill: sdd-verify — Verificación de una feature

## Propósito
Demostrar con evidencia que una feature hace lo que dice su `spec.md` y respeta
`docs/constitution.md`. Se puede ejecutar en cualquier momento: al terminar la implementación,
después de un `sdd-change`, antes de desplegar o para auditar features antiguas.

## Invariantes
1. **Solo lectura sobre el código:** prohibido modificar código de aplicación, pruebas o
   esquemas. Lo único que escribe es `verification.md` y, si corresponde, el estado de la spec.
2. **Evidencia, no opiniones:** cada ✅ o ❌ va acompañado de la salida del comando, la ruta
   del archivo o la prueba que lo demuestra.
3. **Honestidad:** si un comando falla o no se puede ejecutar (p. ej. no hay BD para e2e),
   regístralo como ❌ o ⚠️ con su motivo. Nunca lo des por bueno.
4. **Los fallos no se arreglan aquí:** se listan y se proponen tareas (vía `sdd-change` si
   implica cambiar la spec o el plan, o como tareas nuevas en `tasks.md` si es un bug).

## Flujo

### Paso 1: Contexto
1. Si el usuario no indicó la feature, lista `specs/` y pregunta cuál verificar
   (o "todas" para una auditoría completa, una tras otra).
2. Lee `spec.md`, `plan.md`, `tasks.md` y `docs/constitution.md`. Toma nota de la versión
   de la spec que se verifica.
3. Si hay tareas sin marcar en `tasks.md`, avisa: el resultado será parcial.

### Paso 2: Comandos
Ejecuta y registra el resultado (✅ / ❌ y un resumen de la salida) de:
`pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e`.

### Paso 3: Matriz RF → prueba
Para cada RF de la spec (excepto los marcados como eliminados):
1. Busca las pruebas que lo citan por su ID (p. ej. `grep -rn "RF-03" tests/`).
2. Cruza con el resultado de la ejecución.
3. Clasifica: ✅ cubierto y en verde · ❌ prueba en rojo · ⚠️ sin prueba.

Comprueba también la dirección contraria: las pruebas que citan RF que no existen o están
eliminados se reportan como ⚠️.

### Paso 4: Chequeo de constitución
Audita el código tocado por la feature (archivos de `plan.md` y `tasks.md`), artículo por artículo:

| Artículo | Qué comprobar |
|---|---|
| I. Primacía de la spec | No hay funcionalidad en el código que no esté en un RF. |
| II. Tipado estricto | Ni `any`, ni `@ts-ignore`, ni `@ts-expect-error` sin justificar; `strict` activo. |
| III. UI y formularios | Solo shadcn/ui + Tailwind; formularios con React Hook Form + Zod; responsive. |
| IV. Validación y persistencia | Toda entrada de Server Action, Route Handler y mensaje Realtime pasa por Zod; cambios de BD solo en `schema.prisma` con migración; sin secretos en el cliente. |
| V. TDD | Cada RF con prueba (resultado del Paso 3). |
| VI. Integridad del voto | Ningún valor de voto se envía al cliente ni por Realtime antes de revelar; las acciones de moderador se validan en el servidor. |

### Paso 5: Informe
1. Escribe (o sobrescribe) `specs/NNN-nombre/verification.md` con la plantilla de abajo.
2. Actualiza el estado de la spec:
   - Todo ✅ y todas las tareas hechas → `Implementada`.
   - Algún ❌ o ⚠️ → `En implementación` (si estaba `Implementada`, se registra la regresión).
3. Muestra el resumen y cierra con:
   > **FEATURE VERIFICADA ✅** — o — **VERIFICACIÓN CON FALLOS ❌**: N problemas.

   Si hay fallos, propón las tareas correctivas y qué skill usar para cada una.

## Plantilla de `verification.md`

```markdown
# Verificación NNN — <Nombre de la feature>

- **Fecha:** AAAA-MM-DD
- **Spec verificada:** versión X.Y
- **Resultado:** ✅ Aprobada | ❌ Con fallos

## 1. Comandos
| Comando | Resultado | Detalle |
|---|---|---|
| `pnpm lint` | | |
| `pnpm typecheck` | | |
| `pnpm test` | | |
| `pnpm test:e2e` | | |

## 2. Matriz RF → prueba
| RF | Prueba(s) | Resultado |
|---|---|---|

## 3. Chequeo de constitución
| Artículo | Cumple | Evidencia |
|---|---|---|

## 4. Problemas y acciones propuestas
| # | Problema | Acción | Skill |
|---|---|---|---|
```
