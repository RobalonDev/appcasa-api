---
name: sdd-plan
description: Start or continue the technical plan (docs/specs/NNN-capacidad/plan.md) of an approved spec through a design interview. The author decides the architecture; Claude maps the decisions, asks one at a time, drafts the plan and the ADRs, and proposes the mechanical parts.
disable-model-invocation: true
argument-hint: <NNN-capacidad>
---

# /sdd-plan

Sigue el método de `.claude/skills/sdd/SKILL.md` (léelo si no está ya cargado).

Argumentos: `$ARGUMENTS`. La primera palabra es la carpeta de la spec (`NNN-capacidad`, a la que llamamos `$spec` abajo). Si falta, pídela.

Plan: `docs/specs/$spec/plan.md`. Spec: `docs/specs/$spec/spec.md`.

## Pasos

1. **Comprobar y preparar.** Si la spec no está en estado `aprobada`, para y explícaselo al autor. Si `plan.md` no existe, créalo desde `docs/specs/_templates/plan.md` (estado `borrador`, fecha de hoy); si existe, léelo y continúa desde donde está. Actualiza `docs/STATUS.md` («plan en curso»).
2. **Leer antes de diseñar.** Lee la spec completa (incluidas sus «Notas para el plan»), los ADRs aplicables y **el código real**: `src/` (módulos, servicios, configuración, base de datos), `prisma/schema.prisma` y las convenciones de `CLAUDE.md`. Reutiliza lo que exista; no inventes estructura.
3. **Presentar el mapa de decisiones** antes de la primera pregunta: la lista completa de decisiones de arquitectura, ordenadas por dependencia (las que condicionan a otras, primero), indicando para cada una qué RF/RNF afecta y si es **transversal** (afecta a más que esta spec → llevará ADR). El autor puede reordenarla, añadir o quitar.
4. **Entrevista de diseño.** Una pregunta cada vez, como mucho 5 por ronda. En cada pregunta:
   - por qué importa (qué se rompe o se complica si se decide mal);
   - 2–3 opciones con sus trade-offs y, si la tienes, tu recomendación;
   - los RF/RNF afectados;
   - espera la respuesta: **la decisión es del autor**.
5. **Proponer lo mecánico.** Lo que se deduce de las decisiones y de la spec (contrato de API, tabla de módulos, estrategia de tests) lo redactas tú directamente y lo presentas para revisión, sin convertirlo en preguntas.
6. **Notas de la spec.** Cada punto de «Notas para el plan» queda en la sección «Notas de la spec» del plan: resuelto (dónde) o aplazado con su motivo. Ninguno se queda sin tratar.
7. **ADRs.** Cada decisión transversal se escribe como ADR con `docs/adr/0000-plantilla.md` (siguiente número libre) y se añade al índice de `docs/adr/README.md`. El plan enlaza el ADR en lugar de repetirlo.
8. **Cerrar cada ronda.**
   - Pasada de coherencia (regla 10 de `sdd`): todo término, id o cifra que hayas tocado dice lo mismo en el resto del plan, la spec y los ADRs.
   - Comprobación de cobertura: cada RF y RNF activo de la spec aparece en la estrategia de tests y en al menos una sección de diseño. Informa de lo que falte.
   - Resume qué quedó decidido, qué falta y si conviene otra ronda.
9. **Terminar.** Cuando no queden decisiones abiertas y la cobertura esté completa, estima el número de tareas (si salen más de 10, se agruparán en entregas en `/sdd-tasks`) y propón `/sdd-clarify $spec plan`. Tras corregir los bloqueantes de esa única pasada, el autor aprueba el plan (estado `aprobado`) y el siguiente paso es `/sdd-tasks $spec`.

**Trabajo por rondas:** durante una ronda las decisiones se registran (en este proyecto, en el fichero del modo plan) y los ficheros del repo solo se tocan cuando el autor aprueba la ronda.

## Prohibido en esta fase

- Escribir código o tocar `src/` y `prisma/`.
- Cambiar la spec: un cambio de requisitos entra primero por la spec (regla 3; `/sdd-change` cuando exista, en conversación mientras tanto).
- Tomar una decisión de arquitectura sin preguntarla, o convertir lo mecánico en preguntas.
- Marcar el plan como `aprobado`: solo lo hace el autor.

## Cómo trabaja mejor Claude en esta fase

Notas reunidas con el autor al diseñar este comando (2026-11-24):

1. **Leer el código antes de diseñar.** Un plan escrito solo desde la spec inventa estructura que ya existe.
2. **ADR antes que plan** para las decisiones transversales, igual que la spec necesitó decisiones antes de los requisitos.
3. **Cada parte del plan cita los RF** que cubre; sin eso no se puede comprobar que nada queda fuera.
4. **Umbral de tamaño explícito:** Claude tiende a abarcar demasiado.
5. **Separar lo que se pregunta de lo que se propone:** la arquitectura se pregunta; lo mecánico se propone. Si no, el autor acaba decidiendo el código de estado de cada endpoint.
6. **El tamaño en tareas se estima al terminar el plan**, no antes: Claude lo estima mal sin el diseño delante.
7. **Mapa de decisiones antes de la primera pregunta**, para que el autor vea todo el terreno y el orden.
8. **Resolver explícitamente todas las «Notas para el plan»**, para que no se pierdan entre fases.
9. **Coherencia y cobertura antes del reviewer:** en la spec 001, dos correcciones de Claude introdujeron contradicciones que solo cazó el reviewer.
