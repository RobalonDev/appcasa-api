# Specs (Spec-Driven Development)

Cada funcionalidad de dominio se especifica antes de programarse. Motivos y alcance en [ADR-0007](../adr/0007-spec-driven-development.md); el método completo (fases, reglas y formatos) está en [`.claude/skills/sdd/SKILL.md`](../../.claude/skills/sdd/SKILL.md).

## Estructura

```
docs/specs/NNN-capacidad/
  spec.md    QUÉ y POR QUÉ (lo redacta el autor)
  plan.md    CÓMO: diseño, contrato de API, consistencia, decisiones
  tasks.md   ≤10 tareas con su responsable y su criterio de "hecho"
```

Plantillas en [`_templates/`](_templates/). Las specs se nombran por capacidad (`001-authentication`), no por fase: un cambio posterior modifica la spec existente.

## Índice

| Spec | Capacidad | Estado |
|---|---|---|
| — | — | — |
