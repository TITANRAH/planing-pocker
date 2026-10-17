# Verificación 003 — Revelar, consensuar y repetir

- **Fecha:** 2026-10-16
- **Spec verificada:** versión 1.0 (plan v1.0)
- **Tareas:** las 16 hechas (T001–T016)
- **Resultado:** ✅ Aprobada

## 1. Comandos
| Comando | Resultado | Detalle |
|---|---|---|
| `pnpm lint` | ✅ | ESLint sin errores ni avisos (`--max-warnings=0`) |
| `pnpm typecheck` | ✅ | `next typegen` + `tsc --noEmit` sin errores |
| `pnpm test` | ✅ | 18 archivos, 176 pruebas (unit + integración contra Supabase dev) |
| `pnpm test:e2e` | ✅ | 37 pruebas (001 + 002 + 003) contra el build de producción, 2 workers. En T016: 111/111 con `--repeat-each=3` |

## 2. Matriz RF → prueba
Contada en los archivos de pruebas de la 003 (los ID de RF se repiten entre specs). En
`realtime/voting.test.ts` solo cuenta el bloque "con revelado", y en `voting-secret.spec.ts`
solo la prueba "(003)". El e2e principal se llama "RF-01 a RF-05" y comprueba además RF-02,
RF-03 y RF-04, que se indican aparte.

| RF | Prueba(s) | Resultado |
|---|---|---|
| RF-01 Revelar (≤ 2 s) | unit (2) · integración (2) · e2e (3: botón desactivado sin votos, todos ven las cartas en ≤ 2 s, la carta llega solo tras revelar) | ✅ |
| RF-02 Ronda cerrada | unit (1) · integración (2: no se revela dos veces, voto tras revelar → `ROUND_CLOSED`) · e2e (cartas desactivadas tras revelar, dentro de "RF-01 a RF-05") | ✅ |
| RF-03 Carta de cada uno | unit (2) · integración (2: foto con "No votó"; quien entra después no aparece) · e2e (1, más "Carla: No votó" en "RF-01 a RF-05") | ✅ |
| RF-04 Promedio | unit (4: "5,3", "5,0", sin numéricas, "No votó" no cuenta) · e2e ("Promedio: 6,5" en "RF-01 a RF-05") | ✅ |
| RF-05 Mínimo y máximo | unit (1) · e2e (1) | ✅ |
| RF-06 Consenso | unit (3: misma carta, "?"/"☕" lo rompen, 1 voto) · e2e (1: "¡Consenso!"; "Solo votó 1 persona" en RF-10) | ✅ |
| RF-07 Estimación final (≤ 2 s) | unit (6: sugerencia, empates, sin promedio, esquema) · integración (3: fija y cambia con quién/cuándo, rechaza "?") · e2e (1: sugerida marcada, los demás la ven en ≤ 2 s) | ✅ |
| RF-08 Volver a votar | unit (3) · integración (4: ronda nueva, la revelada intacta, `ESTIMATE_PRESENT`, confirmación) · e2e (1: con y sin estimación) | ✅ |
| RF-09 Nueva tarea tras revelar | integración (1) · e2e (1: sin confirmación) | ✅ |
| RF-10 Entrar después de revelar | unit (1) · integración (1) · e2e (1) | ✅ |
| RF-11 Desconexión tras revelar | integración (1: retirado sigue en la foto) | ✅ |
| RF-12 Rechazos | unit (1) · integración (5: jugador no revela/fija/vuelve a votar, sin votos, **voto y revelado simultáneos en 10 casos**) | ✅ |
| RF-13 Sin moderador | integración (1: moderador retirado no revela) · e2e (1: sin controles, reloj simulado) | ✅ |

No hay pruebas que citen RF inexistentes. Las 4 pruebas sin RF son de infraestructura del
modelo de datos (T001, `reveal-db.test.ts`).

## 3. Chequeo de constitución
| Artículo | Cumple | Evidencia |
|---|---|---|
| I. Primacía de la spec | ✅ | Implementa RF-01…RF-13. Historial, exportación, revelado automático y estadísticas avanzadas no existen. |
| II. Tipado estricto | ✅ | Ningún `any` ni `@ts-*` en los archivos de la 003 (grep). La foto y la estimación se tipan desde Zod (`RevealEntryView`, `NumericCard`). |
| III. UI y formularios | ✅ | Solo shadcn/ui (`button`, `alert-dialog`, `badge`) + Tailwind. La estimación se elige con botones (sin formulario de texto, como prevé el plan). Móvil: comprobación con viewport de iPhone 13 (390 px), con la foto, el resumen, la estimación y "Volver a votar" dentro de la tarjeta. |
| IV. Validación y persistencia | ✅ | `revealRound`, `setEstimate` y `revote` validan con Zod. Broadcasts `reveal`/`estimate` validados al enviar (`revealEventPayload`/`estimateEventPayload`) y al recibir (reducer). Foto y estimación validadas con `cardSchema`/`estimateSchema` al leerlas de la BD. Migración `reveal`. |
| V. TDD | ✅ | Los 13 RF con pruebas en verde que los citan, escritas antes del código salvo infraestructura (T001) y el refactor del bus (T011, cubierto por e2e). La prueba de concurrencia se ejecutó 10 veces sin fallos. |
| VI. Integridad del voto | ✅ | VI.1–2: `getRoomState` solo devuelve cartas ajenas (`entries`) con la ronda `REVEALED`; e2e "(003)": la carta de Ana **no** llega a Beto antes de revelar y **sí** después (control). VI.3: `revealRound`, `setEstimate` y `revote` exigen `role = MODERATOR` (`NOT_MODERATOR`). Un voto simultáneo al revelado no se cuela: `FOR SHARE` al votar y `FOR UPDATE` al revelar. VI.4: estimación con `estimateSchema` (solo numéricas). |

## 4. Problemas y acciones propuestas
Sin problemas que incumplan la spec o la constitución.

## 5. Observaciones
- **Usabilidad (propuesta de mejora):** tras revelar, la baraja de votación desactivada sigue
  visible debajo del selector de estimación, así que el moderador ve dos rejillas de cartas casi
  iguales. Cumple RF-02 (la baraja queda cerrada), pero se entendería mejor ocultándola o
  plegándola mientras la ronda está revelada. Iría por `sdd-change` (cambio de la UI, plan 003).
- **Los ID de RF se repiten entre specs** (ya anotado en la verificación de la 002); la matriz
  tuvo que filtrarse por archivo y por bloque. Sigue pendiente la propuesta de citar
  `NNN/RF-NN` en las pruebas, que requiere una enmienda.
- **Coste del bloqueo de la ronda**, decidido en el plan: votar tarda ≈ 0,9–1,1 s en dev con la
  BD en `ca-central-1`; en producción (`sa-east-1` + Vercel `gru1`) aún no se ha medido.
- **Restos de datos de prueba:** al verificar quedaban 3 salas `test-…-revelar-concurrente-*` en
  la BD de dev, de una ejecución anterior en la que la prueba de concurrencia agotó su plazo de
  20 s y su bucle siguió creando salas después de la limpieza. Se borraron (la BD quedó con 0
  salas de prueba) y la prueba tiene ahora un plazo de 90 s. Las ejecuciones completas
  posteriores no dejaron restos.
