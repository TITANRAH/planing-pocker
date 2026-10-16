# Constitución del Proyecto — Planning Poker

Principios innegociables. Cualquier spec, prueba o línea de código que los contradiga
se rechaza. Solo se modifican con aprobación explícita del equipo, dejando registrado
el cambio en la sección "Enmiendas".

---

## Artículo I — Primacía de la Especificación

1. **Ninguna funcionalidad se programa sin una especificación previa aprobada en `specs/`.**
2. Cada feature vive en su carpeta `specs/NNN-nombre/`. Su `spec.md` contiene contexto,
   alcance, fuera de alcance, requisitos funcionales numerados (`RF-01`, `RF-02`…) y
   criterios de aceptación; `plan.md` y `tasks.md` se derivan de ella y nunca la contradicen.
3. Si el código y la spec divergen, gana la spec: se corrige el código o se enmienda
   primero la spec.

## Artículo II — Tipado Estricto y Calidad

1. TypeScript con `"strict": true`.
2. **Prohibidos** `any`, `@ts-ignore` y `@ts-expect-error` sin justificación documentada.
3. Los tipos de dominio se derivan de los esquemas Zod (`z.infer`) o del cliente de Prisma;
   no se duplican a mano.
4. `pnpm lint` (ESLint) y Prettier deben pasar sin errores ni advertencias para integrar un cambio.

## Artículo III — Límites de UI y Formularios

1. La UI se construye **solo** con componentes `shadcn/ui` y utilidades de Tailwind CSS.
   No se permiten otras librerías de componentes ni CSS suelto (salvo `globals.css`).
2. Todo formulario usa **React Hook Form + Zod** (`zodResolver`); no hay validación ad hoc.
3. La interfaz debe ser responsive y usable desde el móvil (votar desde el teléfono es un
   caso de uso de primera clase).
4. Textos de UI en español.

## Artículo IV — Validación en Fronteras y Persistencia

1. **Todo dato que cruza una frontera se valida con Zod:** entradas de Server Actions,
   Route Handlers, parámetros de URL y mensajes de Supabase Realtime (tanto al enviar
   como al recibir).
2. Los esquemas Zod viven en `src/lib/schemas` y se comparten entre cliente y servidor.
3. **`prisma/schema.prisma` es la única fuente de verdad de la base de datos.** Todo cambio
   de esquema se hace con una migración de Prisma; nunca a mano en el panel de Supabase.
4. Las claves y secretos solo viven en variables de entorno; la `service_role` key de
   Supabase nunca llega al cliente.

## Artículo V — Desarrollo Guiado por Pruebas (TDD)

1. **Cada requisito funcional (RF) de una spec tiene al menos una prueba** que lo referencia
   por su identificador (p. ej. `it("RF-03: revela todos los votos a la vez")`).
2. Lógica de dominio pura (cálculo de promedio, detección de consenso, validación de cartas)
   → prueba unitaria con **Vitest**.
3. Flujos de usuario (crear sala, unirse, votar, revelar, nueva ronda) → prueba e2e con
   **Playwright**, que incluye escenarios con varios jugadores.
4. La prueba se escribe **antes** de la implementación. No se integra código con pruebas en rojo.

## Artículo VI — Integridad del Voto

1. **Ningún jugador puede conocer el valor del voto de otro antes del "revelar".**
2. Mientras la ronda está abierta, solo se difunde *quién* votó, nunca *qué* votó.
   Los valores no viajan por canales Realtime ni aparecen en respuestas al cliente
   hasta la revelación.
3. Solo el moderador de la sala puede revelar votos, iniciar una nueva ronda o fijar la
   estimación final; el servidor lo verifica en cada acción.
4. Solo se aceptan votos con cartas de la baraja vigente
   (`0, 1, 2, 3, 5, 8, 13, 21, ?, ☕`).

---

## Enmiendas

| # | Fecha | Artículo | Cambio | Motivo |
|---|---|---|---|---|
| 1 | 2026-10-15 | I.2 | Las specs pasan de un archivo `specs/NNN-nombre.md` a una carpeta `specs/NNN-nombre/` con `spec.md`, `plan.md` y `tasks.md`. | Las fases de plan y tareas del ciclo SDD necesitan sus propios documentos por feature. |
