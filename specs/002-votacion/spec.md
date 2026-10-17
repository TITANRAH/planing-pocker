# Spec 002 — Cargar tarea y votar

- **Estado:** Implementada (aprobada y verificada el 2026-10-16)
- **Versión:** 1.0
- **Fecha:** 2026-10-16

## 1. Contexto
Con la feature 001 el equipo ya puede reunirse en una sala. Falta el núcleo del Planning Poker:
poner sobre la mesa la tarea que se va a estimar y que cada participante elija su carta **en
secreto**, viendo en vivo quién ya votó pero sin conocer el voto de nadie. El secreto evita que
las primeras opiniones influyan en las demás (efecto ancla) y es un principio innegociable del
proyecto (Constitución, Art. VI). Revelar los votos queda para la feature 003.

## 2. Actores y permisos
| Actor | Puede |
|---|---|
| **Moderador** | Cargar o cambiar la tarea que se estima. Votar como un jugador más. |
| **Jugador** | Ver la tarea actual, elegir su carta, cambiarla o quitarla mientras la ronda está abierta y ver quién ya votó. |

## 3. Alcance
- Cargar la tarea a estimar (título y detalle opcional) y cambiarla.
- Votar con una carta de la baraja Fibonacci, y cambiar o quitar el voto.
- Ver en vivo la tarea actual, quién ya votó y cuántos votaron.
- Mantener en secreto el valor de cada voto.

## 4. Fuera de alcance
- Revelar las cartas, el promedio y el consenso, fijar la estimación final y empezar una nueva
  ronda con la misma tarea (feature 003).
- Historial de tareas estimadas (feature 004).
- Barajas configurables (T-shirt, personalizadas).
- Temporizador o cuenta atrás para votar.
- Importar tareas desde Jira, Linear u otras herramientas.

## 5. Requisitos funcionales

### RF-01 — Cargar la tarea a estimar
El sistema debe permitir al moderador cargar la tarea que se va a estimar, con un título
obligatorio y un detalle opcional, y abrir con ella una ronda de votación.

**Criterios de aceptación**
- **Dado** que soy el moderador y no hay tarea **Cuando** escribo el título "Login con Google" y pulso "Empezar votación" **Entonces** la tarea queda como tarea actual y se abre una ronda.
- **Dado** que soy el moderador **Cuando** el título tiene menos de 3 o más de 100 caracteres, o el detalle más de 300 **Entonces** se muestra un error en el campo y no se carga la tarea.

### RF-02 — Ver la tarea actual en vivo
El sistema debe mostrar a todos los participantes la tarea actual (título y detalle) y
actualizarla en vivo cuando el moderador la carga, la edita o la cambia: todos los
participantes ven el cambio en 2 segundos o menos.

**Criterios de aceptación**
- **Dado** que estoy en la sala **Cuando** el moderador carga una tarea **Entonces** la veo en 2 s o menos, sin recargar la página.

### RF-03 — Votar con una carta
El sistema debe permitir a cada participante elegir una carta de la baraja
`0, 1, 2, 3, 5, 8, 13, 21, ?, ☕` mientras la ronda está abierta, y marcarla como su elección.
Las cartas "?" (no sé) y "☕" (necesito un descanso) cuentan como voto.

**Criterios de aceptación**
- **Dado** que hay una ronda abierta **Cuando** toco la carta "5" **Entonces** queda marcada como mi voto.

### RF-04 — Cambiar o quitar el voto
El sistema debe permitir cambiar el voto por otra carta, o quitarlo, mientras la ronda está abierta.

**Criterios de aceptación**
- **Dado** que voté "5" **Cuando** toco "8" **Entonces** mi voto pasa a ser "8".
- **Dado** que voté "5" **Cuando** vuelvo a tocar "5" **Entonces** mi voto se quita y vuelvo a figurar como "no votó".

### RF-05 — Voto secreto
El sistema debe mantener en secreto el valor de cada voto: solo quien lo emitió puede verlo.
El valor no debe llegar al navegador de ningún otro participante mientras la ronda está abierta.

**Criterios de aceptación**
- **Dado** que Ana votó "13" **Cuando** Beto mira la sala **Entonces** ve que Ana ya votó, pero no ve el valor.
- **Dado** que Ana votó "13" **Cuando** se inspecciona todo lo que recibe el navegador de Beto **Entonces** el valor "13" de Ana no aparece en ningún mensaje.

### RF-06 — Quién ya votó
El sistema debe mostrar en la lista de participantes quién ya votó y quién no, y un contador
"N de M votaron", actualizados en 2 segundos o menos. M son los participantes que están en la
sala: los conectados y los desconectados hace menos de 2 minutos (la misma regla del cupo de la
spec 001). Quien es retirado de la sala deja de contar.

**Criterios de aceptación**
- **Dado** que hay 5 participantes **Cuando** 3 votan **Entonces** todos ven "3 de 5 votaron" y el indicador "ya votó" junto a esos 3, en 2 s o menos.
- **Dado** que Ana eligió "?" **Cuando** los demás miran la sala **Entonces** Ana figura como "ya votó".
- **Dado** que Beto se desconectó hace 1 minuto **Cuando** se calcula el contador **Entonces** Beto sigue contando en M.

### RF-07 — Recordar mi voto al recargar
El sistema debe recordar el voto de cada participante, de modo que al recargar la página siga
viendo marcada su carta.

**Criterios de aceptación**
- **Dado** que voté "8" **Cuando** recargo la página **Entonces** sigo viendo marcada la carta "8".

### RF-08 — Nueva tarea
El sistema debe permitir al moderador reemplazar la tarea actual por una nueva. Al hacerlo, la ronda
anterior se cierra, sus votos se descartan y se abre una ronda nueva. Si ya había votos, el
sistema debe pedir confirmación antes.

**Criterios de aceptación**
- **Dado** que hay una ronda con votos **Cuando** el moderador carga una nueva tarea **Entonces** se le pide confirmación avisando de que se perderán los votos.
- **Dado** que el moderador confirma **Cuando** se carga la nueva tarea **Entonces** todos ven la nueva tarea y "0 de M votaron", y nadie tiene carta marcada.

### RF-09 — Sin tarea no se vota
El sistema debe impedir votar mientras no haya una tarea cargada.

**Criterios de aceptación**
- **Dado** que el moderador no cargó ninguna tarea **Cuando** miro la sala **Entonces** las cartas no se pueden elegir y se indica que se espera a que el moderador cargue una tarea.

### RF-10 — Entrar con la ronda empezada
El sistema debe permitir que quien entra a la sala con una ronda abierta vea la tarea actual,
quién ya votó, y pueda votar.

**Criterios de aceptación**
- **Dado** que hay una ronda abierta con 2 votos **Cuando** entro a la sala **Entonces** veo la tarea, "2 de M votaron" y puedo elegir una carta.

### RF-11 — Votos de quien se desconecta
El sistema debe conservar el voto de quien se desconecta mientras siga en la sala, y descartarlo
cuando sea retirado de la sala (a los 2 minutos de desconexión, RF-10 de la spec 001).

**Criterios de aceptación**
- **Dado** que Ana votó y se desconecta **Cuando** pasa menos de 2 minutos **Entonces** sigue figurando "ya votó".
- **Dado** que Ana votó y se desconecta **Cuando** es retirada de la sala **Entonces** su voto deja de contar y el contador se actualiza.

### RF-12 — Rechazo de acciones inválidas
El sistema debe rechazar los votos con valores fuera de la baraja, los votos de quien no
pertenece a la sala o sin ronda abierta, y los intentos de un jugador de cargar o cambiar la tarea.

**Criterios de aceptación**
- **Dado** una petición de voto con el valor "4" **Cuando** llega al sistema **Entonces** se rechaza y no se registra.
- **Dado** que soy jugador **Cuando** intento cargar una tarea por cualquier medio **Entonces** el sistema lo rechaza.

### RF-13 — Editar la tarea
El sistema debe permitir al moderador corregir el título o el detalle de la tarea actual sin
cerrar la ronda ni borrar los votos.

**Criterios de aceptación**
- **Dado** que hay una ronda con 3 votos **Cuando** el moderador corrige el título "Lgoin" → "Login" **Entonces** todos ven el título corregido en 2 s o menos y siguen "3 de M votaron" con sus cartas marcadas.
- **Dado** que soy el moderador **Cuando** edito el título a menos de 3 o más de 100 caracteres **Entonces** se muestra el error en el campo y no se guarda.

### RF-14 — Sala sin moderador
Si el moderador fue retirado de la sala (más de 2 minutos desconectado, RF-10 de la spec 001),
el sistema debe permitir seguir votando la tarea actual, impedir cargar, editar o reemplazar la
tarea, e indicar que la sala no tiene moderador.

**Criterios de aceptación**
- **Dado** que el moderador fue retirado y hay una ronda abierta **Cuando** miro la sala **Entonces** veo "Esta sala no tiene moderador" y puedo votar la tarea actual.
- **Dado** que el moderador fue retirado y no hay tarea **Cuando** miro la sala **Entonces** veo "Esta sala no tiene moderador" y no se puede votar.

**Limitación conocida:** la recuperación o el traspaso del rol de moderador quedan para una
feature futura.

## 6. Reglas de negocio y casos borde
- Título de la tarea: obligatorio, de 3 a 100 caracteres. Detalle: opcional, hasta 300 caracteres.
- Una sola tarea actual y una sola ronda abierta por sala.
- Baraja fija: `0, 1, 2, 3, 5, 8, 13, 21, ?, ☕` (Constitución, Art. VI.4).
- Un voto por participante y ronda.
- Solo el moderador carga o cambia la tarea; el sistema lo verifica en cada acción (Art. VI.3).
- El valor de un voto solo lo conoce quien lo emitió mientras la ronda está abierta (Art. VI.1-2).
- "En vivo" = 2 segundos o menos (tarea, "ya votó" y contador).
- M del contador = participantes en la sala (conectados + desconectados hace menos de 2 minutos).
- "Editar tarea" no toca los votos; "Nueva tarea" los descarta (con confirmación si había votos).
- "?" y "☕" cuentan como voto.
- Sin moderador en la sala no se puede cargar, editar ni reemplazar la tarea.

## 7. Clarificaciones
| # | Pregunta | Respuesta | Fecha |
|---|---|---|---|
| 1 | ¿Cuánto es "en vivo"? | 2 s o menos para la tarea, el "ya votó" y el contador, como en la 001 (RF-02, RF-06, RF-13). | 2026-10-16 |
| 2 | ¿A quiénes cuenta el M de "N de M votaron"? | A los que están en la sala: conectados y desconectados hace menos de 2 min; los retirados dejan de contar (RF-06, RF-11). | 2026-10-16 |
| 3 | ¿Corregir la tarea también borra los votos? | No: "Editar tarea" conserva los votos; "Nueva tarea" los borra con confirmación (RF-08, RF-13). | 2026-10-16 |
| 4 | ¿Qué pasa en una sala sin moderador? | Limitación conocida: se puede votar la tarea actual, pero no cargar, editar ni reemplazar; se muestra "Esta sala no tiene moderador" (RF-14). | 2026-10-16 |
| 5 | ¿"?" y "☕" cuentan como voto? | Sí; su efecto en el promedio se decide en la feature 003 (RF-03, RF-06). | 2026-10-16 |

## 8. Historial de cambios
| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-10-16 | Versión inicial |
