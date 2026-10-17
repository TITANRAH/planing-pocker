# Spec 004 — Historial de tareas estimadas

- **Estado:** Aprobada (2026-10-17)
- **Versión:** 1.0
- **Fecha:** 2026-10-17

## 1. Contexto
Con las features 001 a 003 el equipo estima tareas una a una, pero lo estimado se pierde de vista
en cuanto se carga la siguiente. Esta feature reúne en la propia sala las tareas ya estimadas, con
su valor, el total de la sesión y el detalle de cómo se votó, para no repetir trabajo y para
llevarse el resultado a la herramienta de backlog del equipo. Solo muestra rondas ya reveladas
(Constitución, Art. VI).

## 2. Actores y permisos
| Actor | Puede |
|---|---|
| **Moderador** | Ver el historial, su detalle y exportarlo. |
| **Jugador** | Ver el historial, su detalle y exportarlo. |

Nadie edita ni borra el historial desde esta feature; la estimación se cambia como permite la
spec 003.

## 3. Alcance
- Lista de las tareas de la sala con estimación final.
- Resumen: número de tareas estimadas y suma de puntos.
- Detalle de cada tarea con sus rondas reveladas.
- Exportación a CSV.

## 4. Fuera de alcance
- Historial entre salas o por usuario (no hay cuentas).
- Editar, reordenar o borrar entradas del historial.
- Otros formatos de exportación (Excel, PDF) o envío directo a Jira/Linear.
- Gráficos o estadísticas de la sesión (velocidad, desviación).
- Caducidad o archivado de salas.

## 5. Requisitos funcionales

### RF-01 — Lista de tareas estimadas
El sistema debe mostrar en la sala una sección "Historial" con las tareas que tienen estimación
final, ordenadas por la hora de su última estimación (la más reciente primero), con su título, su
estimación y esa hora ("14:32", en la hora local de cada participante). Si se cambia una
estimación antigua, la tarea sube al principio.

**Criterios de aceptación**
- **Dado** que se estimaron "Login" con 5 y después "Logout" con 3 **Cuando** miro el historial **Entonces** veo primero "Logout · 3" y después "Login · 5", cada una con su hora.
- **Dado** que "Login" se estimó antes que "Logout" **Cuando** el moderador cambia la estimación de "Login" **Entonces** "Login" pasa a ser la primera.

### RF-02 — Resumen de la sesión
El sistema debe mostrar cuántas tareas se estimaron y la suma de sus estimaciones.

**Criterios de aceptación**
- **Dado** las estimaciones 5, 3 y 8 **Cuando** miro el historial **Entonces** veo "3 tareas · 16 puntos".

### RF-03 — Solo tareas con estimación vigente
El sistema debe incluir solo las tareas con estimación final fijada, mostrando el último valor
fijado. Si al volver a votar se borra la estimación, la tarea sale del historial hasta que se fije
de nuevo.

**Criterios de aceptación**
- **Dado** que "Login" se reemplazó por otra tarea sin fijar estimación **Cuando** miro el historial **Entonces** "Login" no aparece.
- **Dado** que "Login" tenía 5 y el moderador la cambió a 8 **Cuando** miro el historial **Entonces** veo "Login · 8".
- **Dado** que "Login" tenía 5 y el moderador volvió a votar **Cuando** miro el historial **Entonces** "Login" no aparece.

### RF-04 — Detalle de rondas
El sistema debe mostrar, al abrir una tarea del historial, sus rondas reveladas de la más antigua
a la más reciente, cada una con la carta de cada participante (o "No votó"), el promedio y si hubo
consenso, calculados como en la spec 003. Solo cuentan las rondas reveladas: una ronda reemplazada
sin revelar no aparece.

**Criterios de aceptación**
- **Dado** que "Login" se votó dos veces (5 y 8; después 8 y 8) **Cuando** abro su detalle **Entonces** veo "Ronda 1: Ana 5 · Beto 8 · Promedio 6,5" y "Ronda 2: Ana 8 · Beto 8 · ¡Consenso!".

### RF-05 — Exportar a CSV
El sistema debe permitir descargar el historial como CSV con las columnas `Tarea`, `Detalle`,
`Estimación`, `Fecha` y `Rondas`, una fila por tarea, en el mismo orden que la pantalla:
- Separador punto y coma (`;`); los campos con `;`, comillas o saltos de línea van entre comillas.
- Codificación UTF-8 con BOM.
- `Fecha` = fecha y hora de la última estimación ("2026-10-17 14:32"), en la hora local de quien exporta.
- `Rondas` = número de rondas reveladas de la tarea.
- Nombre del archivo: `planning-poker-<sala>-<AAAA-MM-DD>.csv`, sin caracteres especiales
  (p. ej. `planning-poker-sprint-12-2026-10-17.csv`).

**Criterios de aceptación**
- **Dado** un historial con 2 tareas **Cuando** pulso "Exportar CSV" **Entonces** se descarga un archivo con la cabecera y 2 filas, y las tildes y la "ñ" se ven bien al abrirlo en Excel.
- **Dado** una tarea con el título `Login; "fase 1"` **Cuando** exporto **Entonces** el CSV la conserva entera en la columna `Tarea`.

### RF-06 — Historial vacío
El sistema debe indicar cuando todavía no hay tareas estimadas y desactivar la exportación.

**Criterios de aceptación**
- **Dado** que no se estimó ninguna tarea **Cuando** miro el historial **Entonces** veo "Todavía no hay tareas estimadas" y "Exportar CSV" está desactivado.

### RF-07 — Historial en vivo
El sistema debe actualizar el historial de todos los participantes en 2 segundos o menos cuando
el moderador fija, cambia o borra una estimación.

**Criterios de aceptación**
- **Dado** que estoy en la sala **Cuando** el moderador fija la estimación de una tarea **Entonces** la veo en mi historial en 2 s o menos.

### RF-08 — Secreto de la ronda abierta
El sistema no debe mostrar en el historial ninguna carta de una ronda abierta.

**Criterios de aceptación**
- **Dado** que "Login" tiene estimación y se está votando de nuevo **Cuando** abro su detalle **Entonces** solo veo las rondas ya reveladas.

### RF-09 — Historial completo para quien llega tarde
El sistema debe mostrar el historial completo a quien entra a la sala en cualquier momento.

**Criterios de aceptación**
- **Dado** que se estimaron 3 tareas **Cuando** Dani entra a la sala **Entonces** ve las 3 en su historial.

### RF-10 — Historial de la sala
El sistema debe mostrar solo las tareas de la propia sala.

**Criterios de aceptación**
- **Dado** dos salas con tareas estimadas **Cuando** miro el historial de una **Entonces** no aparece ninguna tarea de la otra.

## 6. Reglas de negocio y casos borde
- Entran solo las tareas con estimación final vigente, con su último valor.
- Suma de puntos = suma de las estimaciones del historial (todas numéricas, spec 003).
- El detalle muestra solo rondas reveladas, de la más antigua a la más reciente.
- Todos los participantes ven y exportan el historial; nadie lo edita aquí.
- Tiempos: ≤ 2 s para reflejar una estimación nueva, cambiada o borrada.
- Sin datos nuevos: el historial se construye con lo que guardan las specs 002 y 003.
- Orden y hora: los de la última estimación (local de cada participante).
- CSV: separador `;`, UTF-8 con BOM, comillas cuando hace falta, nombre `planning-poker-<sala>-<AAAA-MM-DD>.csv`.
- Solo cuentan las rondas reveladas (detalle y columna `Rondas`).

## 7. Clarificaciones
| # | Pregunta | Respuesta | Fecha |
|---|---|---|---|
| 1 | ¿Qué separador usa el CSV? | Punto y coma, comillas cuando haga falta y UTF-8 con BOM, para abrirlo bien en Excel en español (RF-05). | 2026-10-17 |
| 2 | ¿Qué fecha y hora se muestran y exportan? | La de la última estimación; en pantalla "14:32" y en el CSV "2026-10-17 14:32", en hora local (RF-01, RF-05). | 2026-10-17 |
| 3 | ¿Cómo se ordena el historial? | Por la hora de la última estimación, la más reciente primero; al cambiar una estimación la tarea sube (RF-01). | 2026-10-17 |
| 4 | ¿Cómo se llama el archivo exportado? | `planning-poker-<sala>-<AAAA-MM-DD>.csv`, sin caracteres especiales (RF-05). | 2026-10-17 |
| 5 | ¿Cuentan las rondas no reveladas? | No; solo las reveladas, en el detalle y en la columna `Rondas` (RF-04, RF-05). | 2026-10-17 |

## 8. Historial de cambios
| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-10-17 | Versión inicial |
