---
name: sdd-clarify
description: QA review by the read-only reviewer subagent, of a feature spec (default) or of its technical plan (second argument "plan"). Finds ambiguities, contradictions, gaps, missing coverage and conflicts with CLAUDE.md, the ADRs or the existing code. Detects only; proposes no solutions.
disable-model-invocation: true
argument-hint: <NNN-capacidad> [plan]
context: fork
agent: reviewer
background: false
---

# Revisión de QA (`/sdd-clarify`)

Argumentos: `$ARGUMENTS`. La primera palabra es la carpeta de la spec (`NNN-capacidad`, a la que llamamos `$spec` abajo). Si hay una segunda palabra y es `plan`, el objetivo es el **plan**; si no, el objetivo es la **spec**.

No tienes acceso a la conversación con el autor: todo lo que cuenta está en los ficheros. Lee también, como referencia de lo que no se puede contradecir: `CLAUDE.md`, los ADRs de `docs/adr/` que apliquen y las demás specs de `docs/specs/` relacionadas.

## Objetivo: la spec (`docs/specs/$spec/spec.md`)

Qué buscar:

1. **Ambigüedad:** términos sin definir o que admiten dos lecturas; palabras vagas sin criterio («rápido», «adecuado», «etc.»).
2. **No verificable:** RF/RNF para los que no se puede escribir un test que pase o falle sin interpretación.
3. **Mezcla:** un RF que describe más de un comportamiento.
4. **Contradicciones** entre requisitos, o entre la spec y `CLAUDE.md`, los ADRs u otras specs (p. ej. aislamiento por hogar, ADR-0006).
5. **Casos límite ausentes:** concurrencia, orden de eventos, estados intermedios, el último o único elemento, borrados, permisos, datos de otro hogar.
6. **Huecos:** HU sin RF que la cubra, RF sin HU, flujos de error sin definir.
7. **Fuga de tecnología:** tablas, endpoints, librerías o ficheros dentro de la spec.
8. **Formato:** RF que no siguen EARS, ids duplicados o saltados sin justificar, secciones vacías.

Ciclo: tras resolver una revisión se lanza otra, con el criterio de parada de la regla 8 de `sdd`.

## Objetivo: el plan (`docs/specs/$spec/plan.md`)

Revísalo frente a la spec, los ADRs y **el código existente** (`src/`, `prisma/schema.prisma`). Qué buscar:

1. **Cobertura:** RF o RNF activos de la spec sin diseño o sin fila en la estrategia de tests.
2. **Tests que no prueban el requisito:** la fila de la estrategia de tests no comprobaría lo que dice el RF.
3. **Contradicciones** entre el plan y la spec, o entre el plan y los ADRs.
4. **Encaje con el código:** diseño que ignora lo que ya existe, lo duplica o rompe sus convenciones (`CLAUDE.md`).
5. **Decisiones sin alternativa descartada** en la tabla de decisiones.
6. **Decisiones transversales sin ADR** (afectan a más que esta spec).
7. **«Notas para el plan» de la spec** que no aparecen resueltas ni aplazadas en «Notas de la spec».
8. **Concurrencia y seguridad:** transacciones, carreras, idempotencia, aislamiento entre hogares o requisitos de seguridad de la spec sin tratar en el diseño.

Ciclo: **una sola pasada** (decisión P4, ADR-0007). El autor corrige los bloqueantes y aprueba el plan; no se relanza la revisión.

## Reglas

- **Solo detectas.** No propongas soluciones ni redacciones alternativas: la decisión es del autor.
- No modifiques ningún fichero.
- Cita siempre el id (`RF-3`, `HU-2`) o la sección y línea afectada.

## Formato de respuesta

```
OBJETIVO: spec | plan
VEREDICTO: LISTA PARA APROBAR | NECESITA CAMBIOS

Problemas (bloquean la aprobación):
- [categoría] RF-n / sección (línea) — qué falla — qué pregunta debe responder el autor

Observaciones (opcionales, no bloquean):
- …
```

Si no hay problemas, dilo explícitamente. Ordena los problemas de más a menos grave.
