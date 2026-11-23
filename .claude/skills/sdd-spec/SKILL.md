---
name: sdd-spec
description: Start or continue a feature spec (docs/specs/NNN-capacidad/spec.md) by interviewing the author. The author decides and reviews; Claude asks, offers options and drafts the requirements.
disable-model-invocation: true
argument-hint: <NNN-capacidad> [idea]
---

# /sdd-spec

Sigue el método de `.claude/skills/sdd/SKILL.md` (léelo si no está ya cargado).

Argumentos: `$ARGUMENTS`. La primera palabra es la carpeta de la spec (`NNN-capacidad`, a la que llamamos `$spec` abajo); el resto, si lo hay, es la idea inicial del autor. Si falta la carpeta, pídela proponiendo el siguiente número libre de `docs/specs/`.

Spec: `docs/specs/$spec/spec.md`.

## Pasos

1. **Preparar.** Si `docs/specs/$spec/` no existe, créala copiando `docs/specs/_templates/spec.md` (estado `borrador`, fecha de hoy, número y capacidad en el título) y añade la spec al índice de `docs/specs/README.md`. Si ya existe, léela y continúa desde donde está. Actualiza "Spec activa" en `docs/STATUS.md`.
2. **Entender.** Lee el contexto relevante: `CLAUDE.md`, los ADRs que apliquen y las specs relacionadas. Resume al autor en 3–5 líneas qué entiendes que debe resolver la spec y pídele que lo corrija.
3. **Entrevistar.** Haz preguntas **de una en una**, como máximo 5 por ronda, empezando por las que más afectan al diseño (reglas de negocio, permisos, casos límite). En cada pregunta:
   - explica por qué importa (qué se rompe si no se decide);
   - ofrece 2–3 opciones con sus trade-offs y, si tienes una recomendación, dila;
   - espera la respuesta: **la decisión es del autor**.
4. **Redactar para que el autor revise.** Tras cada decisión (o al cerrar la ronda), redacta tú los requisitos en EARS y preséntalos al autor indicando qué revisar en cada uno: qué hueco cierra cada parte y qué pasaría si se quitara. El autor los confirma o corrige. Si el autor quiere escribir alguno él mismo, dale el patrón y revísalo. Señala cuando un RF no sea verificable o mezcle dos comportamientos, y busca huecos que aparezcan al combinar requisitos.
5. **No inventar.** No añadas reglas de negocio que el autor no haya decidido. Lo pendiente va a "Dudas abiertas" como `[NECESITA ACLARACIÓN]`.
6. **Cerrar la ronda.** Guarda los cambios en `spec.md` y resume: qué quedó decidido, qué dudas siguen abiertas y si conviene otra ronda o pasar a `/sdd-clarify $spec`.

## Prohibido en esta fase

- Escribir código, tocar `prisma/` o `src/`.
- Incluir tecnología en la spec (tablas, endpoints, librerías).
- Cambiar el estado a `aprobada`: solo lo hace el autor.
