---
name: sdd-clarify
description: Revisa una spec.md existente (borrador o aprobada) para detectar y resolver ambigüedades mediante preguntas al usuario, registrando las respuestas en la propia spec. Úsala cuando el usuario quiera clarificar, revisar, desambiguar o "hacer el clarify" de una spec, o invoque /sdd-clarify. También la invocan sdd-spec (antes de aprobar) y sdd-change (al enmendar). Nunca genera código ni crea specs nuevas.
---

# Skill: sdd-clarify — Clarificación de una spec

## Propósito
Eliminar las ambigüedades de una `specs/NNN-nombre/spec.md` antes de que lleguen al plan o al
código. Se puede ejecutar todas las veces que haga falta y sobre specs en cualquier estado.

## Invariantes
1. **Solo specs existentes:** si la feature no tiene `spec.md`, detente y sugiere `sdd-spec`.
2. **Sin código:** prohibido generar código, pruebas, esquemas o decisiones técnicas
   (el "cómo" pertenece a `plan.md`).
3. **Human in the loop:** las respuestas las da el usuario; nunca inventes una respuesta.
   Puedes sugerir una opción por defecto, pero el usuario la confirma.
4. **Como mucho 5 preguntas por ronda,** priorizadas por impacto. Si quedan más, haz otra ronda.
5. **IDs estables:** nunca renumeres RF existentes.

## Flujo

### Paso 1: Contexto
1. Si el usuario no indicó la feature, lista `specs/` y pregunta cuál clarificar.
2. Lee `spec.md`, `docs/constitution.md` y, si existen, `plan.md` y `verification.md`
   (pueden revelar huecos detectados más tarde).
3. Anota el estado actual de la spec (`Borrador`, `Aprobada`, `En implementación`, `Implementada`).

### Paso 2: Detección
Recorre la spec con esta lista de chequeo y anota cada hallazgo con el RF o sección donde aparece:

| Categoría | Pregunta guía |
|---|---|
| Terminología | ¿Hay términos sin definir o usados con dos significados? |
| Cantidades | ¿Faltan números concretos (límites, tiempos, tamaños, máximos)? |
| Permisos | ¿Está claro qué actor puede hacer cada acción? |
| Concurrencia y conexión | ¿Qué pasa con varios usuarios a la vez, recargas, desconexiones o reconexiones? |
| Estados | ¿Están definidos los estados vacío, cargando y error? |
| Verificabilidad | ¿Hay criterios subjetivos ("rápido", "intuitivo", "fácil")? |
| Completitud | ¿Algún RF no tiene criterio de aceptación Dado/Cuando/Entonces? |
| Coherencia | ¿Hay RF que se contradicen entre sí o con otras specs? |
| Constitución | ¿Algún requisito choca con un artículo de `docs/constitution.md`? |
| Marcas pendientes | ¿Quedan `[NECESITA CLARIFICACIÓN: …]` sin resolver? |

Si no encuentras nada relevante, dilo y termina sin modificar la spec.

### Paso 3: Preguntas
Presenta los hallazgos ordenados por impacto y formula como mucho 5 preguntas. Cada una con:
- El RF o sección afectada.
- Por qué importa (qué podría salir mal si no se aclara).
- Una opción sugerida por defecto.

### Paso 4: Propuesta de cambios
Con las respuestas, prepara el diff de la spec:
- Reescribe los RF y criterios afectados para que sean concretos y verificables.
- Añade una fila por pregunta en la tabla **Clarificaciones** (#, pregunta, respuesta, fecha).
- Lo que siga sin resolver se marca en el texto como `[NECESITA CLARIFICACIÓN: …]`.
- Si una respuesta contradice la constitución, no la apliques: señálala y propón una enmienda
  vía `sdd-change`.

### Paso 5: Aprobación y escritura
1. Muestra el diff y pregunta:
   > *"¿Apruebas estas clarificaciones para aplicarlas a `spec.md`?"*
2. Al aprobarse, escribe los cambios según el estado de la spec:
   - **Borrador:** solo se aplican los cambios; la versión no cambia.
   - **Aprobada o posterior:** si la clarificación cambia el comportamiento esperado, sube la
     versión menor (1.0 → 1.1), añade una fila en el "Historial de cambios" y avisa de que
     `plan.md` y `tasks.md` pueden necesitar actualizarse con `sdd-change`. Si solo precisa la
     redacción sin cambiar el comportamiento, se registra en Clarificaciones y la versión no cambia.
3. Cierra con:
   > **SPEC CLARIFICADA** — quedan N marcas `[NECESITA CLARIFICACIÓN]`.

   Si quedan 0 y la invocó `sdd-spec`, devuélvele el control para la aprobación.
