---
name: sdd-implement
description: Implementa las tareas aprobadas de una feature en TDD (prueba en rojo → código mínimo → verde) y, al terminar todas, lanza sdd-verify. Úsala cuando el usuario quiera implementar, programar, "ejecutar las tasks" o continuar con la siguiente tarea, o invoque /sdd-implement. Para verificar sin implementar usa sdd-verify. Fase 3 del ciclo SDD.
---

# Skill: sdd-implement — Implementación (TDD) + Verificación

## Propósito
Ejecutar `tasks.md` tarea por tarea con TDD y, al terminar, entregar la feature a `sdd-verify`
para que demuestre que cada RF está cubierto y en verde. Es la fase 3 del ciclo SDD:
`sdd-spec` → `sdd-clarify` → `sdd-plan` → **`sdd-implement`** → `sdd-verify`.

## Invariantes
1. **Precondición:** existen `spec.md` (`Aprobada` o `En implementación`), `plan.md` y
   `tasks.md` aprobados. Si falta alguno, detente y sugiere la skill correspondiente.
2. **Solo lo que está en `tasks.md`:** nada de funcionalidades, refactors ni dependencias que no
   figuren en una tarea. Si una tarea revela un hueco en la spec o en el plan, **detente** y
   propón `sdd-change`; no lo resuelvas por tu cuenta.
3. **TDD estricto:** primero la prueba, que debe fallar por la razón correcta; después el
   código mínimo para que pase. Nunca modifiques una prueba para que pase sin aprobación.
4. **Constitución siempre:** sin `any` ni `@ts-ignore`, solo shadcn/ui + Tailwind, Zod en todas
   las fronteras, cambios de BD solo con migraciones de Prisma, y los votos ocultos hasta revelar.
5. **Informa con honestidad:** si algo falla, muestra la salida real. No marques una tarea como
   hecha si sus pruebas no están en verde.
6. **Sin commits ni despliegues** salvo que el usuario lo pida.

## Modo de trabajo
Al empezar, pregunta al usuario:
- **Paso a paso** (por defecto): una tarea a la vez, con pausa para revisión después de cada una.
- **Por fase:** todas las tareas de una fase de `tasks.md` y pausa al terminar la fase.

## Flujo por tarea

1. **Seleccionar:** toma la primera tarea sin marcar (o la que indique el usuario). Comprueba
   que sus dependencias estén hechas. Anuncia: ID, título, RF que cubre y archivos.
2. **Rojo:** escribe la prueba indicada en "Prueba primero". El nombre de la prueba cita el RF
   (p. ej. `it("RF-03: revela todos los votos a la vez")`). Ejecútala y confirma que falla
   por el motivo esperado.
3. **Verde:** implementa el código mínimo para que pase. Ejecuta la prueba de nuevo.
4. **Calidad:** ejecuta `pnpm lint` y `pnpm typecheck`, y corrige lo que toque a esta tarea.
5. **Marcar:** cambia `- [ ]` por `- [x]` en `tasks.md`.
6. **Reportar:** archivos cambiados, pruebas añadidas y su resultado, y la siguiente tarea.

## Cierre: verificación (delegada a `sdd-verify`)

Cuando todas las tareas de `tasks.md` estén marcadas:
1. Ejecuta el flujo de la skill **`sdd-verify`** sobre la feature. Es la única fuente de los
   comandos, la matriz RF → prueba, el chequeo de constitución y la plantilla de
   `verification.md`.
2. Si `sdd-verify` termina en ✅, la spec queda `Implementada` y se cierra con:
   > **FEATURE IMPLEMENTADA Y VERIFICADA** — para cambios futuros usa `sdd-change`.
3. Si termina en ❌, la spec queda `En implementación`. Las correcciones que no cambian la spec
   se añaden como tareas nuevas en `tasks.md` (con aprobación) y se implementan con este mismo
   flujo; las que la cambian van por `sdd-change`. Después se vuelve a ejecutar `sdd-verify`.
