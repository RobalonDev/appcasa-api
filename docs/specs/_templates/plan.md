# Plan NNN: <Capacidad>

- **Estado:** borrador <!-- borrador | aprobado -->
- **Spec:** [spec.md](spec.md) (debe estar `aprobada`)
- **Fecha:** AAAA-MM-DD
- **ADRs:** —

<!--
CÓMO se implementa. Describe el diseño, no un listado de funciones (eso caduca al programar).
Cada sección indica qué RF/RNF cubre.
Si una decisión afecta a más de esta funcionalidad, se convierte en ADR y aquí solo se enlaza.
-->

## Resumen

El diseño en 3–5 líneas.

## Módulos afectados

Qué bounded context(s) toca, sus piezas principales y qué expone cada uno a los demás (ADR-0003).

## Modelo de datos

Entidades, relaciones, constraints e índices relevantes. Qué invariantes protege la base de datos y cuáles la aplicación.

## Contrato de API

| Método | Ruta | Cubre | Respuestas |
|---|---|---|---|
| `POST` | `/…` | RF-1 | `201`, `400`, `409` |

## Flujos y consistencia

Pasos de los flujos no triviales. Transacciones, concurrencia (qué pasa con dos peticiones a la vez), idempotencia, eventos emitidos.

## Seguridad y autorización

Quién puede hacer qué; cómo se garantiza el aislamiento entre hogares (ADR-0006).

## Decisiones

| Decisión | Alternativa descartada | Por qué |
|---|---|---|
| … | … | … |

## Notas de la spec

Cada punto de «Notas para el plan» de la spec, resuelto o aplazado explícitamente.

| Nota | Resolución | Dónde |
|---|---|---|
| … | … | sección del plan, ADR-NNNN o «aplazada: motivo» |

## Estrategia de tests

Referencia de cobertura: **una fila por cada RF y RNF activo de la spec**.

| RF/RNF | Tipo (unit / e2e) | Qué comprueba |
|---|---|---|
| RF-1 | e2e | … |

## Oportunidades de aprendizaje

Qué piezas del diseño conviene que implemente el autor y por qué (alimenta el `Responsable` de las tareas).

- …

## Riesgos

Qué puede salir mal o qué no sabemos aún.
