---
name: sdd-spec
description: Redacta la especificación (spec.md) de una nueva feature siguiendo Spec-Driven Development y la pasa por sdd-clarify antes de aprobarla. Úsala cuando el usuario quiera especificar, definir o describir una funcionalidad nueva ("nueva feature", "escribir la spec", "especificar X"), o invoque /sdd-spec. Para clarificar una spec que ya existe usa sdd-clarify. Fase 1 del ciclo SDD; nunca genera código.
---

# Skill: sdd-spec — Especificación + Clarificación

## Propósito
Convertir la idea de una feature en un `specs/NNN-nombre/spec.md` sin ambigüedades, que
describa **qué** se construye y **por qué**, nunca **cómo**. Es la fase 1 del ciclo SDD:
**`sdd-spec`** → `sdd-clarify` → `sdd-plan` → `sdd-implement` → `sdd-verify`
(y `sdd-change` para modificaciones).

## Invariantes
1. **Human in the loop:** la spec solo pasa a `Aprobada` con aprobación explícita del usuario.
   Antes de eso solo existe como `Borrador`.
2. **Sin código:** prohibido generar código de aplicación, pruebas o esquemas.
3. **Qué, no cómo:** la spec no menciona frameworks, tablas, endpoints ni componentes.
   Esas decisiones pertenecen a `plan.md`.
4. **Respeta la constitución:** ningún requisito puede contradecir `docs/constitution.md`.
   Si el usuario pide algo que la contradice, señálalo y propón alternativas o una enmienda.
5. **Preguntas por bloques:** como mucho 5 preguntas por mensaje, con una opción por defecto
   sugerida en cada una.

## Flujo

### Paso 0: Contexto
1. Lee `agents.md` y `docs/constitution.md`. Si no existen, detente y sugiere `sdd-generator`.
2. Lista `specs/` y calcula el siguiente número (`001`, `002`…). Lee los `spec.md` existentes
   para no duplicar features ni contradecir requisitos ya aprobados.
3. Propón un slug corto en `kebab-case` (p. ej. `001-crear-sala`).

### Paso 1: Bloque A — Qué y para quién
1. **Objetivo:** ¿qué problema resuelve esta feature y qué valor aporta?
2. **Actores:** ¿quién la usa? ¿Qué puede hacer cada rol (p. ej. moderador vs. jugador)?
3. **Flujo principal:** describe paso a paso el camino feliz.

### Paso 2: Bloque B — Límites
1. **Reglas de negocio:** restricciones, límites numéricos y permisos.
2. **Casos borde y errores:** entradas inválidas, desconexiones, concurrencia, estados vacíos.
3. **Fuera de alcance:** qué NO incluye esta feature (explícitamente).
4. **Datos:** qué información se crea, muestra o guarda (en lenguaje de negocio).

### Paso 3: Borrador
Redacta `spec.md` con la plantilla de abajo. Cada requisito:
- Tiene ID estable `RF-NN` (nunca se renumera; si se elimina, se marca como eliminado).
- Es atómico, verificable y usa "El sistema debe…".
- Tiene al menos un criterio de aceptación en formato **Dado / Cuando / Entonces**.

### Paso 4: Clarificación (delegada a `sdd-clarify`)
1. Guarda el borrador como `specs/NNN-nombre/spec.md` con `Estado: Borrador`
   (avisa al usuario de que es un borrador, todavía no aprobado).
2. Ejecuta el flujo de la skill **`sdd-clarify`** sobre ese borrador. Es la única fuente de la
   lista de chequeo y del registro en la sección **Clarificaciones**.
3. Repite las rondas de `sdd-clarify` hasta que no quede ninguna marca
   `[NECESITA CLARIFICACIÓN: …]`; con esas marcas la spec no puede pasar a `Aprobada`.

### Paso 5: Aprobación
1. Muestra el borrador completo y pregunta:
   > *"¿Apruebas `specs/NNN-nombre/spec.md` para guardarla con estado `Aprobada`?"*
2. Aplica los cambios que pida el usuario y vuelve a mostrarla.
3. Tras la aprobación, actualiza el archivo a `Estado: Aprobada` con la fecha, y cierra con:
   > **SPEC APROBADA** — siguiente paso: `sdd-plan` para el plan técnico y las tareas.

## Plantilla de `spec.md`

```markdown
# Spec NNN — <Nombre de la feature>

- **Estado:** Borrador | Aprobada | En implementación | Implementada
- **Versión:** 1.0
- **Fecha:** AAAA-MM-DD

## 1. Contexto
Problema que resuelve y valor que aporta.

## 2. Actores y permisos
| Actor | Puede |
|---|---|

## 3. Alcance
Lo que incluye esta feature.

## 4. Fuera de alcance
Lo que explícitamente NO incluye.

## 5. Requisitos funcionales
### RF-01 — <Título corto>
El sistema debe…

**Criterios de aceptación**
- **Dado** … **Cuando** … **Entonces** …

## 6. Reglas de negocio y casos borde
- …

## 7. Clarificaciones
| # | Pregunta | Respuesta | Fecha |
|---|---|---|---|

## 8. Historial de cambios
| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | AAAA-MM-DD | Versión inicial |
```
