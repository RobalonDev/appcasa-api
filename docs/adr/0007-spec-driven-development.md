# ADR-0007: Spec-Driven Development ligero para funcionalidades de dominio

- **Estado:** Aceptado
- **Fecha:** 2026-11-17

## Contexto

Las fases 1–5 tienen reglas de negocio reales (autenticación, permisos por hogar, dinero compartido, concurrencia). Las ambigüedades descubiertas mientras se programa acaban decididas de forma implícita en el código, sin revisión. Además, el proyecto busca entrenar la especificación de requisitos, y Claude produce mejores resultados y verificables cuando trabaja contra una spec explícita.

El autor ya usa en otro proyecto un SDD completo: constitución, spec/plan/tareas, comandos por fase y un modo orquestado con coordinator y tres subagentes (planner, implementer, reviewer) restringidos por hooks.

## Opciones consideradas

1. **Sin specs** (plan en conversación y código): rápido, pero las decisiones de negocio quedan implícitas y no hay forma de verificar "está terminado".
2. **Herramienta externa (GitHub Spec Kit, Kiro, OpenSpec)**: método probado, pero más ceremonia y ficheros de los que necesita un proyecto de una persona.
3. **Replicar el SDD del otro proyecto completo**: buen diseño, pero dos modos (manual y orquestado) que mantener a la vez; subagentes que arrancan sin contexto y cuyo trabajo el autor no ve (malo para aprender); y una constitución que duplicaría `CLAUDE.md` y los ADRs.
4. **SDD ligero propio**: el mismo flujo, en modo manual, con un único subagente donde aporta independencia (el reviewer).

## Decisión

Opción 4:

- `docs/specs/NNN-capacidad/{spec,plan,tasks}.md`, nombradas por capacidad, no por fase; un cambio posterior modifica la spec existente.
- Requisitos en **EARS**, cada uno verificable; los tests lo citan por su id (`RF-n`) para la trazabilidad.
- **El autor redacta la spec**; Claude entrevista, ofrece opciones y hace de QA. Puede cambiarse a "Claude redacta el borrador" si conviene.
- Modo **manual**: comandos (skills con `disable-model-invocation`) que solo lanza el autor. Método único en la skill `sdd`.
- Un solo subagente, **`reviewer`**, de solo lectura, para revisar specs y, más adelante, validar implementaciones.
- **Sin `constitution.md`**: ese papel lo cumplen `CLAUDE.md` y los ADRs.
- Estado en tres niveles sin copiar datos entre ellos: proyecto (`docs/STATUS.md`, apunta a la spec activa), funcionalidad (estado de `spec.md`), tarea (casillas de `tasks.md`).
- **Construcción incremental**: hoy solo existen `/sdd-spec` y `/sdd-clarify`. `/sdd-plan`, `/sdd-implement`, `/sdd-validate`, `/sdd-change` y el script de estado/trazabilidad se crean al llegar a esas fases, con lo aprendido en la primera spec.
- SDD no se aplica a infraestructura (→ ADR) ni a cambios pequeños (→ rama + PR).

## Consecuencias

- Las reglas de negocio quedan explícitas y revisadas antes del código; "terminado" se puede comprobar.
- Más tiempo antes de la primera línea de código de cada funcionalidad.
- Riesgo de ceremonia: si una fase no aporta, se simplifica en lugar de seguirla por inercia.
- Revisar tras la spec 001 y tras la fase 1: qué fases sobran o faltan, y si merece la pena probar el modo orquestado (es, en pequeño, un problema de sistemas distribuidos: qué contexto viaja en cada mensaje).

## Seguimiento

Notas añadidas después de aceptar el ADR. No cambian la decisión: registran cómo se ha aplicado.

- **2026-11-23, redacción.** Se activa la variante prevista: Claude redacta los requisitos tras cada decisión y explica qué revisar; el autor decide, revisa y corrige. Motivo: en la práctica el autor pedía la redacción casi siempre, y revisar críticamente también entrena el criterio.
- **2026-11-23, criterio de parada de `/sdd-clarify`.** Tras resolver una revisión se lanza otra; si solo quedan detalles de implementación o de redacción menor, van a «Notas para el plan» o se aceptan, y el autor aprueba la spec. Motivo: la spec 001 pasó de 12 problemas en la primera revisión a 7, casi todos detalles, en la segunda; sin criterio se pulirían detalles indefinidamente. Recogido como regla 8 de la skill `sdd`.
- **2026-11-23, retrospectiva de la spec 001.** Resultado: 4 rondas de entrevista, 4 revisiones (12 → 7 → 3 → 1 problemas), 38 RF y 19 decisiones; se detectaron antes del código el secuestro por pre-registro, varias vías de enumeración (por mensaje y por tiempo) y la fuerza bruta acumulada. Funcionó: entrevistar con opciones y trade-offs, buscar huecos combinando requisitos, el reviewer con contexto limpio (cazó dos contradicciones introducidas por Claude al corregir) y el criterio de parada. Pesó, según el autor: el número de revisiones y el tamaño de la spec. Cambios: reglas 9 (spec o plan), 10 (pasada de coherencia antes del reviewer) y 11 (objetivo de ≤ 15 RF por spec) en la skill `sdd`. El autor mantiene el modo plan en cada ronda.
