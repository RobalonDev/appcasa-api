# ADR-0001: Registrar decisiones de arquitectura con ADRs

- **Estado:** Aceptado
- **Fecha:** 2026-11-16

## Contexto

AppCasa es, además de un producto, un proyecto de aprendizaje de arquitectura y diseño de sistemas. Las decisiones técnicas y sus motivos son tan importantes como el código, y se olvidan rápido si solo viven en conversaciones o en mensajes de commit.

## Opciones consideradas

1. **No documentar**: cero esfuerzo, pero el "por qué" se pierde.
2. **Wiki o documento único**: tiende a desactualizarse y no refleja la evolución.
3. **ADRs en el repositorio**: ficheros pequeños, versionados junto al código, revisables en PR.

## Decisión

Usar ADRs en `docs/adr/`, en español, con la plantilla `0000-plantilla.md`. Toda decisión que afecte a la estructura del sistema, a una dependencia relevante o a un patrón transversal lleva su ADR.

## Consecuencias

- Queda un historial explicable de la arquitectura, útil para retomar el proyecto y como portfolio.
- Pequeño coste por decisión (10–15 minutos).
- Riesgo de documentar trivialidades: si la decisión es fácil de revertir y no afecta a nada más, no necesita ADR.
