# Spec 003 — Revelar, consensuar y repetir

- **Estado:** Aprobada (2026-10-16)
- **Versión:** 1.0
- **Fecha:** 2026-10-16

## 1. Contexto
Con la feature 002 cada participante vota en secreto. Falta cerrar el ciclo del Planning Poker:
mostrar todas las cartas **a la vez**, ver si hubo acuerdo, hablar sobre las diferencias y fijar
una estimación final, o volver a votar la misma tarea si no hubo acuerdo. Revelar es el único
momento en que el valor de los votos llega a los demás participantes (Constitución, Art. VI).

## 2. Actores y permisos
| Actor | Puede |
|---|---|
| **Moderador** | Revelar los votos, fijar la estimación final de la tarea y empezar una nueva ronda con la misma tarea. |
| **Jugador** | Ver las cartas reveladas, el resumen (promedio, mínimo, máximo y consenso) y la estimación final. |

## 3. Alcance
- Revelar los votos de la ronda abierta.
- Mostrar la carta de cada participante y un resumen de la ronda.
- Sugerir y fijar la estimación final de la tarea.
- Volver a votar la misma tarea.

## 4. Fuera de alcance
- Historial de tareas estimadas y exportación (feature 004).
- Revelar automáticamente cuando todos votaron.
- Estadísticas avanzadas (mediana, desviación, gráficos).
- Temporizador.
- Comentarios o discusión escrita sobre los votos.

## 5. Requisitos funcionales

### RF-01 — Revelar las cartas
El sistema debe permitir al moderador revelar los votos de la ronda abierta cuando tiene al menos
un voto. Todos los participantes deben ver las cartas reveladas a la vez, en 2 segundos o menos.

**Criterios de aceptación**
- **Dado** que hay una ronda abierta con 2 votos **Cuando** el moderador pulsa "Revelar cartas" **Entonces** todos ven las cartas en 2 s o menos.
- **Dado** que nadie votó **Cuando** el moderador mira la sala **Entonces** "Revelar cartas" está desactivado e indica que nadie votó todavía.

### RF-02 — Ronda revelada cerrada
El sistema debe cerrar la ronda al revelarla: nadie puede votar, cambiar ni quitar su carta.

**Criterios de aceptación**
- **Dado** que la ronda fue revelada **Cuando** un participante intenta elegir una carta **Entonces** no puede hacerlo.

### RF-03 — Carta de cada participante
El sistema debe mostrar, tras revelar, la carta de cada participante junto a su apodo; quien no
votó aparece como "No votó". La ronda revelada es una foto fija de quienes estaban en la sala al
revelar: quien entra después no aparece en ella.

**Criterios de aceptación**
- **Dado** que Ana votó "5", Beto "8" y Carla no votó **Cuando** se revela **Entonces** todos ven "Ana: 5", "Beto: 8" y "Carla: No votó".
- **Dado** que Dani entra después de revelar **Cuando** mira la ronda revelada **Entonces** Dani no aparece en ella.

### RF-04 — Promedio
El sistema debe mostrar el promedio de las cartas numéricas reveladas, siempre con un decimal y
coma decimal (p. ej. "5,0", "5,3"). "?" y "☕" no cuentan. Si no hay cartas numéricas, debe mostrar "Sin promedio".

**Criterios de aceptación**
- **Dado** los votos 3, 5, 8 y "?" **Cuando** se revela **Entonces** el promedio es "5,3".
- **Dado** los votos 5 y 5 **Cuando** se revela **Entonces** el promedio es "5,0".
- **Dado** que todos votaron "?" o "☕" **Cuando** se revela **Entonces** se muestra "Sin promedio".

### RF-05 — Mínimo y máximo
El sistema debe mostrar la carta numérica más baja y la más alta de la ronda revelada.

**Criterios de aceptación**
- **Dado** los votos 3, 5 y 13 **Cuando** se revela **Entonces** se muestran mínimo "3" y máximo "13".

### RF-06 — Consenso
El sistema debe indicar que hubo consenso cuando todos los que votaron eligieron la misma carta
numérica, con al menos 2 votos. Un "?" o un "☕" rompe el consenso.

**Criterios de aceptación**
- **Dado** que Ana y Beto votaron "8" **Cuando** se revela **Entonces** se indica "¡Consenso!".
- **Dado** que Ana votó "8" y Beto "?" **Cuando** se revela **Entonces** no se indica consenso.
- **Dado** que solo Ana votó "8" **Cuando** se revela **Entonces** no se indica consenso y se muestra "Solo votó 1 persona".

### RF-07 — Estimación final
El sistema debe permitir al moderador fijar la estimación final de la tarea con una carta
numérica de la baraja, tras revelar. Debe sugerir la carta más cercana al promedio (si empatan
dos, la mayor); si no hay promedio, no sugiere ninguna y el moderador elige libremente. El moderador puede cambiarla mientras la tarea siga siendo la actual. Todos ven
la estimación fijada en 2 segundos o menos.

**Criterios de aceptación**
- **Dado** un promedio de 5,3 **Cuando** el moderador va a fijar la estimación **Entonces** se le sugiere "5".
- **Dado** un promedio de 6,5 **Cuando** se calcula la sugerencia **Entonces** es "8" (empate entre 5 y 8: la mayor).
- **Dado** que el moderador fija "8" **Cuando** los demás miran la sala **Entonces** ven "Estimación final: 8" en 2 s o menos.
- **Dado** que el moderador intenta fijar "?" **Cuando** lo envía **Entonces** se rechaza.
- **Dado** que todos votaron "?" o "☕" **Cuando** el moderador va a fijar la estimación **Entonces** no hay sugerencia y puede elegir cualquier carta numérica.

### RF-08 — Volver a votar
El sistema debe permitir al moderador abrir una ronda nueva con la misma tarea tras revelar. Los
votos empiezan de cero y la estimación final, si estaba fijada, se borra. Si hay una estimación
final fijada, el sistema debe pedir confirmación antes, indicando cuál se borrará.

**Criterios de aceptación**
- **Dado** una ronda revelada **Cuando** el moderador pulsa "Volver a votar" **Entonces** todos ven la misma tarea, "0 de M votaron" y ninguna carta marcada.
- **Dado** que la estimación final es "8" **Cuando** el moderador pulsa "Volver a votar" **Entonces** se le pide confirmar con "Se borrará la estimación final: 8".

### RF-09 — Nueva tarea tras revelar
El sistema debe permitir al moderador cargar una nueva tarea tras revelar sin pedir
confirmación; los votos revelados se conservan con su ronda.

**Criterios de aceptación**
- **Dado** una ronda revelada **Cuando** el moderador carga una nueva tarea **Entonces** no se le pide confirmación y se abre la ronda nueva.

### RF-10 — Entrar después de revelar
El sistema debe mostrar a quien entra a la sala con la ronda ya revelada las cartas, el resumen
y la estimación final si ya se fijó. Quien entra no aparece en la ronda revelada (RF-03).

**Criterios de aceptación**
- **Dado** una ronda revelada con estimación "8" **Cuando** entro a la sala **Entonces** veo las cartas, el resumen y "Estimación final: 8".

### RF-11 — Desconexiones después de revelar
El sistema debe seguir mostrando la carta revelada de quien se desconecta o es retirado de la sala
después de revelar.

**Criterios de aceptación**
- **Dado** que Beto votó "8" y se reveló **Cuando** Beto es retirado de la sala **Entonces** "Beto: 8" sigue visible en la ronda revelada.

### RF-12 — Rechazo de acciones inválidas
El sistema debe rechazar que un jugador revele, fije la estimación o vuelva a votar; los votos
que llegan después de revelar; y revelar sin votos.

**Criterios de aceptación**
- **Dado** que soy jugador **Cuando** intento revelar por cualquier medio **Entonces** el sistema lo rechaza.
- **Dado** que la ronda se reveló **Cuando** llega un voto **Entonces** se rechaza y no se registra.

### RF-13 — Sala sin moderador
Si el moderador fue retirado de la sala, el sistema debe impedir revelar, fijar la estimación y
volver a votar, y mantener el aviso "Esta sala no tiene moderador" (RF-14 de la spec 002).

**Criterios de aceptación**
- **Dado** que el moderador fue retirado **Cuando** miro la sala **Entonces** no hay opción de revelar ni de volver a votar.

## 6. Reglas de negocio y casos borde
- Solo se revela una ronda abierta con al menos 1 voto; tras revelarla queda cerrada.
- Promedio: solo cartas numéricas, con un decimal; "?" y "☕" no cuentan.
- Consenso: todos los votos son la misma carta numérica, con al menos 2 votos.
- Estimación final: una carta numérica de la baraja; sugerida la más cercana al promedio (empate → la mayor).
- Volver a votar borra la estimación final; nueva tarea tras revelar no pide confirmación.
- Revelar, fijar y volver a votar: solo el moderador, verificado por el sistema (Art. VI.3).
- Los votos revelados se conservan con su ronda.
- La ronda revelada es una foto fija de quienes estaban en la sala al revelar.
- Promedio con coma decimal y siempre un decimal ("5,0").
- Sin consenso con un solo voto ("Solo votó 1 persona").
- Sin promedio no hay estimación sugerida.
- "Volver a votar" pide confirmación si hay estimación fijada.

## 7. Clarificaciones
| # | Pregunta | Respuesta | Fecha |
|---|---|---|---|
| 1 | ¿Quiénes aparecen en la lista de la ronda revelada? | Foto fija de quienes estaban en la sala al revelar; quien entra después no aparece (RF-03, RF-10, RF-11). | 2026-10-16 |
| 2 | ¿"Volver a votar" pide confirmación si hay estimación fijada? | Sí, indicando la estimación que se borrará; sin estimación no se pregunta (RF-08). | 2026-10-16 |
| 3 | ¿Qué se sugiere si no hay cartas numéricas? | Nada; el moderador elige libremente una carta numérica (RF-07). | 2026-10-16 |
| 4 | ¿Hay consenso con un solo voto? | No; se muestra "Solo votó 1 persona" (RF-06). | 2026-10-16 |
| 5 | ¿Cómo se muestra el promedio? | Coma decimal y siempre un decimal: "5,0", "5,3" (RF-04). | 2026-10-16 |

## 8. Historial de cambios
| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-10-16 | Versión inicial |
