# Plan NNN: <Capacidad>

- **Spec:** [spec.md](spec.md) (debe estar `aprobada`)
- **Fecha:** AAAA-MM-DD

<!--
CÓMO se implementa. Describe el diseño, no un listado de ficheros y funciones (eso caduca al
programar). Cada sección indica qué RF/RNF cubre.
Si una decisión afecta a más de esta funcionalidad, se convierte en ADR y aquí solo se enlaza.
-->

## Resumen

El diseño en 3–5 líneas.

## Módulos afectados

Qué bounded context(s) toca y qué expone cada uno a los demás (ADR-0003).

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

## Estrategia de tests

| RF/RNF | Tipo (unit / e2e) | Qué comprueba |
|---|---|---|
| RF-1 | e2e | … |

## Riesgos

Qué puede salir mal o qué no sabemos aún.
