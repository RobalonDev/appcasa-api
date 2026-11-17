---
name: sdd-clarify
description: QA review of a feature spec by the read-only reviewer subagent — finds ambiguities, contradictions, untestable requirements, missing edge cases and conflicts with CLAUDE.md or the ADRs. Detects only; proposes no solutions.
disable-model-invocation: true
argument-hint: <NNN-capacidad>
arguments: spec
context: fork
agent: reviewer
background: false
---

# Revisión de la spec `$spec` (fase de clarificación)

Revisa `docs/specs/$spec/spec.md` como QA. No tienes acceso a la conversación con el autor: todo lo que cuenta está en los ficheros.

Lee también, como referencia de lo que no se puede contradecir: `CLAUDE.md`, los ADRs de `docs/adr/` que apliquen y las demás specs de `docs/specs/` relacionadas.

## Qué buscar

1. **Ambigüedad:** términos sin definir o que admiten dos lecturas; palabras vagas sin criterio ("rápido", "adecuado", "etc.").
2. **No verificable:** RF/RNF para los que no se puede escribir un test que pase o falle sin interpretación.
3. **Mezcla:** un RF que describe más de un comportamiento.
4. **Contradicciones** entre requisitos, o entre la spec y `CLAUDE.md`, los ADRs u otras specs (p. ej. aislamiento por hogar, ADR-0006).
5. **Casos límite ausentes:** concurrencia (dos acciones a la vez), orden de eventos, estados intermedios, el último/único elemento, borrados, permisos, datos de otro hogar.
6. **Huecos:** HU sin RF que la cubra, RF sin HU, flujos de error sin definir.
7. **Fuga de tecnología:** tablas, endpoints, librerías o ficheros dentro de la spec.
8. **Formato:** RF que no siguen EARS, ids duplicados o saltados, secciones vacías.

## Reglas

- **Solo detectas.** No propongas soluciones ni redacciones alternativas: la decisión es del autor.
- No modifiques ningún fichero.
- Cita siempre el id (`RF-3`, `HU-2`) o la sección afectada.

## Formato de respuesta

```
VEREDICTO: LISTA PARA APROBAR | NECESITA CAMBIOS

Problemas (bloquean la aprobación):
- [categoría] RF-n / sección — qué falla — qué pregunta debe responder el autor

Observaciones (opcionales, no bloquean):
- …
```

Si no hay problemas, dilo explícitamente. Ordena los problemas de más a menos grave.
