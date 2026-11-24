---
name: sdd-tasks
description: Break an approved technical plan (docs/specs/NNN-capacidad/plan.md) into ordered, verifiable tasks (tasks.md). Claude drafts the full list from the plan, checks coverage and dependencies, and asks the author only how to split it into deliveries and which tasks they want to write themselves.
disable-model-invocation: true
argument-hint: <NNN-capacidad>
---

# /sdd-tasks

Sigue el método de `.claude/skills/sdd/SKILL.md` (léelo si no está ya cargado).

Argumentos: `$ARGUMENTS`. La primera palabra es la carpeta de la spec (`NNN-capacidad`, a la que llamamos `$spec` abajo). Si falta, pídela.

Tareas: `docs/specs/$spec/tasks.md`. Plan: `docs/specs/$spec/plan.md`. Spec: `docs/specs/$spec/spec.md`.

## Pasos

1. **Comprobar y preparar.**
   - Si el plan no está en estado `aprobado`, para y explícaselo al autor.
   - Si `tasks.md` no existe, créalo desde `docs/specs/_templates/tasks.md`, con estado `borrador` y la fecha de hoy. Si existe, léelo y continúa desde donde está.
   - Actualiza `docs/STATUS.md` para indicar que las tareas están en curso.
2. **Leer antes de trocear.**
   - El plan completo: módulos, modelo de datos, flujos, estrategia de tests, oportunidades de aprendizaje y estimación.
   - La lista de RF y RNF activos de la spec.
   - El código actual, para saber qué existe ya.
3. **Redactar la propuesta completa.** La redactas tú entera, sin preguntar (decisión T1):
   - **Orden:** el de las dependencias. Primero la infraestructura que necesitan las demás tareas.
   - **Tamaño:** una tarea es un comportamiento o una pieza que se puede verificar por sí sola (decisión T2):
     - lleva un puñado de tests (orientativo: hasta ~1 h de trabajo y ~10 tests);
     - acaba en un commit con `pnpm check` en verde, y `pnpm test:e2e` si toca HTTP o la base de datos;
     - si necesita más, se parte en dos.
   - **Formato:** el de la plantilla. La tarea apunta al plan con «Plan:» y «Ficheros:», y no copia el diseño (decisión T4).
   - **Responsable:** lo propones según las «Oportunidades de aprendizaje» del plan.
   - **Nada que no esté en el plan:** una tarea no introduce nada nuevo. Si falta algo en el plan, para y vuelve al plan (regla 3).
4. **Comprobar antes de presentar** (decisión T3; no hay reviewer en esta fase). Comprueba:
   - que cada RF y RNF activo, y cada fila de la estrategia de tests del plan, está en al menos una tarea;
   - que ninguna tarea depende de otra posterior;
   - que cada entrega valida sus propios RF sin necesitar la siguiente;
   - que cada «Hecho cuando» se puede verificar sin interpretación.

   Informa al autor del resultado, también si todo está bien.
5. **Preguntar solo lo que es del autor** (decisión T1):
   - Si hay más de 10 tareas: 2 o 3 formas de cortarlas en entregas, con sus trade-offs. El autor elige (D14 de la spec 001, P3 de ADR-0007).
   - Qué tareas quiere programar él. Parte de las que propone el plan y deja que cambie cualquiera.

   Nada más se pregunta: lo demás lo revisa el autor sobre la propuesta.
6. **Cerrar.**
   - El autor aprueba las tareas y su estado pasa a `aprobadas`.
   - Git, según la decisión T5:
     1. La rama de la spec (`feat/$spec`) se cierra con una PR solo de documentación (spec, plan, ADRs y tasks), que se mergea a main.
     2. Cada entrega sale de main en su propia rama: `feat/$spec-a`, `feat/$spec-b`… Si no hay entregas, hay una sola entrega A.
   - Siguiente paso: implementar la primera tarea de la entrega A (`/sdd-implement` cuando exista; mientras tanto, en conversación).

**Trabajo por rondas:** mientras dura la ronda, la propuesta se escribe en el fichero del modo plan. `tasks.md` solo se toca cuando el autor aprueba la ronda.

## Prohibido en esta fase

- Escribir código o tocar `src/`, `prisma/` y `test/`.
- Cambiar la spec o el plan: un cambio entra por arriba (regla 3).
- Añadir tareas que no se deduzcan del plan.
- Marcar las tareas como `aprobadas`: solo lo hace el autor.

## Cómo trabaja mejor Claude en esta fase

Notas reunidas con el autor al diseñar este comando (2026-11-24):

1. **Las tareas se derivan del plan; no lo rediseñan.** Si al trocear aparece un hueco de diseño, se para y se vuelve al plan.
2. **El tamaño se mide en comportamiento verificable, no en minutos.** Con «20–30 min», el plan 001 salía en 25–30 tareas, y algunas no cabían ni así.
3. **Comprobar la cobertura antes de presentar**, como en el plan. Trocear es donde un RF se pierde sin que nadie lo note.
4. **Preguntar solo las entregas y los responsables.** Lo demás es mecánico: preguntarlo convierte la fase en ceremonia.
5. **Apuntar al plan en vez de copiarlo.** Si el diseño está en dos sitios, se desincroniza.
6. **Cada entrega se puede mergear sola y valida sus propios RF**, para que su PR tenga sentido por sí misma.
