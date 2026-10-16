# Spec 001 — Crear sala y unirse

- **Estado:** Implementada (aprobada y verificada el 2026-10-16)
- **Versión:** 1.0
- **Fecha:** 2026-10-16

## 1. Contexto
El equipo necesita un espacio común para estimar tareas sin pasar por registros ni cuentas.
Esta feature permite que una persona cree una sala, comparta un link y que el resto del equipo
entre en segundos con solo un apodo, viendo en vivo quién está conectado. Es la base sobre la
que se construyen la votación (002), la revelación (003) y el historial (004).

## 2. Actores y permisos
| Actor | Puede |
|---|---|
| **Moderador** | Crear la sala, ponerle nombre, obtener y copiar el link para compartirla, ver la lista de participantes. Participa como un jugador más (en features posteriores también vota). |
| **Jugador** | Entrar a una sala existente mediante su link eligiendo un apodo, ver la lista de participantes. |

## 3. Alcance
- Crear una sala con nombre y apodo del moderador.
- Obtener y copiar el link de la sala.
- Entrar a una sala mediante su link con un apodo.
- Ver en vivo la lista de participantes y su estado de conexión.
- Recordar la identidad del participante en su navegador para que vuelva tras recargar.

## 4. Fuera de alcance
- Votar, revelar cartas y gestionar tareas (features 002 y 003).
- Historial de salas o de tareas (feature 004).
- Cuentas de usuario y login.
- Expulsar participantes, traspasar o recuperar el rol de moderador, cerrar o borrar salas.
- Caducidad automática de salas.

## 5. Requisitos funcionales

### RF-01 — Crear sala
El sistema debe permitir crear una sala indicando su nombre y el apodo de quien la crea, que
queda registrado como moderador de esa sala.

**Criterios de aceptación**
- **Dado** que estoy en la página de inicio **Cuando** escribo un nombre de sala y un apodo válidos y pulso "Crear sala" **Entonces** se crea la sala, entro en ella y aparezco en la lista como moderador.
- **Dado** que estoy creando una sala **Cuando** el nombre tiene menos de 3 o más de 50 caracteres **Entonces** se muestra un error en el campo y la sala no se crea.
- **Dado** que estoy creando una sala **Cuando** el apodo tiene menos de 2 o más de 20 caracteres **Entonces** se muestra un error en el campo y la sala no se crea.

### RF-02 — Link para compartir
El sistema debe mostrar dentro de la sala su link de acceso y permitir copiarlo con un solo clic.

**Criterios de aceptación**
- **Dado** que estoy dentro de una sala **Cuando** pulso "Copiar link" **Entonces** el link queda en el portapapeles y se muestra una confirmación.

### RF-03 — Link no deducible
El sistema debe identificar cada sala con un identificador que no se pueda deducir a partir de
otros links (no secuencial ni basado en el nombre).

**Criterios de aceptación**
- **Dado** que se crean dos salas seguidas con el mismo nombre **Cuando** comparo sus links **Entonces** los identificadores son distintos y no consecutivos.

### RF-04 — Unirse con apodo
El sistema debe permitir que cualquier persona con el link entre a la sala eligiendo un apodo,
con el rol de jugador.

**Criterios de aceptación**
- **Dado** que abro el link de una sala existente **Cuando** escribo un apodo válido y pulso "Entrar" **Entonces** entro en la sala y aparezco en la lista como jugador.
- **Dado** que estoy entrando a una sala **Cuando** el apodo tiene menos de 2 o más de 20 caracteres **Entonces** se muestra un error en el campo y no entro.

### RF-05 — Apodo único en la sala
El sistema debe impedir que dos participantes de la misma sala tengan el mismo apodo. Dos apodos
se consideran iguales sin distinguir mayúsculas de minúsculas e ignorando los espacios al inicio
y al final.

**Criterios de aceptación**
- **Dado** que en la sala ya está "Juan" **Cuando** intento entrar con el apodo "Juan" **Entonces** se muestra el aviso "Ese apodo ya está en uso" y se me pide otro.
- **Dado** que en la sala ya está "Juan" **Cuando** intento entrar con "  juan " o "JUAN" **Entonces** se muestra el mismo aviso y no entro.
- **Dado** que "Juan" está desconectado desde hace menos de 2 minutos **Cuando** otra persona intenta entrar con "Juan" **Entonces** se muestra el aviso, porque el apodo sigue reservado.

### RF-06 — Límite de participantes
El sistema debe limitar cada sala a un máximo de 15 participantes, contando al moderador. Un
participante desconectado sigue ocupando su lugar mientras no hayan pasado 2 minutos desde su
desconexión (ver RF-10).

**Criterios de aceptación**
- **Dado** que una sala tiene 15 participantes **Cuando** alguien intenta entrar **Entonces** se muestra "La sala está llena (15/15)" y no puede entrar.
- **Dado** que una sala tiene 15 participantes y uno está desconectado desde hace menos de 2 minutos **Cuando** alguien nuevo intenta entrar **Entonces** se muestra "La sala está llena (15/15)".
- **Dado** que una sala tiene 15 participantes y uno lleva más de 2 minutos desconectado **Cuando** alguien nuevo intenta entrar **Entonces** puede entrar.

### RF-07 — Sala inexistente
El sistema debe informar cuando un link no corresponde a ninguna sala.

**Criterios de aceptación**
- **Dado** un link con un identificador que no existe **Cuando** lo abro **Entonces** se muestra "Esta sala no existe" con un botón para crear una nueva sala.

### RF-08 — Lista de participantes en vivo
El sistema debe mostrar a todos los participantes de la sala la lista de participantes, con su
apodo, su estado de conexión y el moderador destacado, actualizada en vivo sin recargar la página.
"En vivo" significa que la entrada de un participante, su salida o el cierre de su pestaña se ven
en todos los demás en **2 segundos o menos**.

**Criterios de aceptación**
- **Dado** que estoy en una sala **Cuando** otro participante entra **Entonces** aparece en mi lista en 2 segundos o menos, sin que yo recargue la página.
- **Dado** que estoy en una sala **Cuando** miro la lista de participantes **Entonces** el moderador aparece identificado como tal.

### RF-09 — Recordar identidad
El sistema debe recordar en el navegador del participante su identidad en cada sala, de modo que
al recargar o volver a abrir el link entre directamente con el mismo apodo y rol.

**Criterios de aceptación**
- **Dado** que estoy en una sala como "Ana" **Cuando** recargo la página **Entonces** vuelvo a la sala como "Ana" sin escribir el apodo.
- **Dado** que soy el moderador **Cuando** cierro la pestaña y vuelvo a abrir el link **Entonces** vuelvo a la sala como moderador.
- **Dado** que "Ana" fue retirada de la lista tras más de 2 minutos desconectada **Cuando** vuelve a abrir el link desde el mismo navegador, el apodo "Ana" sigue libre y hay cupo **Entonces** entra automáticamente como "Ana" con su rol anterior.
- **Dado** que "Ana" fue retirada de la lista **Cuando** vuelve y otra persona ya usa "Ana" **Entonces** se le pide un apodo nuevo.
- **Dado** que "Ana" fue retirada de la lista **Cuando** vuelve y la sala está llena **Entonces** se muestra "La sala está llena (15/15)".

### RF-10 — Desconexión de participantes
El sistema debe marcar como desconectado a un participante que sale de la sala y retirarlo de la
lista si no vuelve en 2 minutos desde que se lo marcó como desconectado. Mientras tanto conserva
su apodo y su lugar en el cupo.

- Si cierra la pestaña o sale de la sala, se lo ve como desconectado en **2 segundos o menos**.
- Si pierde la conexión sin cerrar nada (wifi caído, equipo suspendido), se lo ve como
  desconectado en **30 segundos o menos**.

**Criterios de aceptación**
- **Dado** que "Ana" está en la sala **Cuando** cierra la pestaña **Entonces** los demás la ven como desconectada en 2 segundos o menos.
- **Dado** que "Ana" está en la sala **Cuando** pierde la conexión sin cerrar la pestaña **Entonces** los demás la ven como desconectada en 30 segundos o menos.
- **Dado** que "Ana" está desconectada **Cuando** pasan 2 minutos sin que vuelva **Entonces** desaparece de la lista.
- **Dado** que "Ana" está desconectada **Cuando** vuelve antes de 2 minutos **Entonces** se la vuelve a ver como conectada con el mismo apodo.

### RF-11 — Permanencia de la sala y del moderador
El sistema debe mantener la sala aunque el moderador se desconecte, y devolverle su rol cuando vuelva.

**Criterios de aceptación**
- **Dado** que el moderador se desconecta **Cuando** los jugadores siguen en la sala **Entonces** la sala sigue funcionando para ellos.
- **Dado** que el moderador se desconectó **Cuando** vuelve desde el mismo navegador **Entonces** recupera su rol de moderador.
- **Dado** que el moderador perdió su identidad (borró los datos del navegador o cambió de dispositivo) **Cuando** vuelve a abrir el link **Entonces** entra como jugador con un apodo nuevo y la sala sigue existiendo sin moderador.

**Limitación conocida:** una sala sin moderador no se puede recuperar en esta feature; quien
quiera moderar crea una sala nueva. El traspaso o la recuperación del rol queda para una
feature futura.

## 6. Reglas de negocio y casos borde
- Nombre de la sala: obligatorio, de 3 a 50 caracteres.
- Apodo: obligatorio, de 2 a 20 caracteres, único dentro de la sala sin distinguir mayúsculas
  e ignorando espacios al inicio y al final.
- Máximo 15 participantes por sala, moderador incluido; los desconectados cuentan durante 2 minutos.
- Un solo moderador por sala: quien la creó.
- Solo se puede entrar a una sala teniendo su link.
- Tiempos máximos de actualización: 2 s para entradas, salidas y cierres de pestaña; 30 s para
  pérdidas de conexión.

## 7. Clarificaciones
| # | Pregunta | Respuesta | Fecha |
|---|---|---|---|
| 1 | ¿"Juan" y "juan" cuentan como el mismo apodo? | Sí: se ignoran mayúsculas y espacios al inicio y al final (RF-05). | 2026-10-16 |
| 2 | ¿Un desconectado sigue ocupando su lugar en el cupo de 15? | Sí, y también su apodo, durante 2 minutos; después se liberan (RF-05, RF-06, RF-10). | 2026-10-16 |
| 3 | ¿Qué pasa si alguien vuelve después de los 2 minutos? | Entra automáticamente con el mismo apodo y rol si el apodo sigue libre y hay cupo; si no, se le pide otro apodo o ve "Sala llena" (RF-09). | 2026-10-16 |
| 4 | ¿Qué pasa si el moderador pierde su identidad? | Limitación conocida: la sala sigue sin moderador; la recuperación queda para una feature futura (RF-11). | 2026-10-16 |
| 5 | ¿Cuánto es "en vivo"? | 2 s o menos para entradas, salidas y cierres de pestaña; 30 s o menos para pérdidas de conexión (RF-08, RF-10). | 2026-10-16 |

## 8. Historial de cambios
| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-10-16 | Versión inicial |
