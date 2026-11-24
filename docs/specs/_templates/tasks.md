# Tareas NNN: <Capacidad>

- **Estado:** borrador <!-- borrador | aprobadas -->
- **Plan:** [plan.md](plan.md) (debe estar `aprobado`)
- **Fecha:** AAAA-MM-DD

<!--
Una tarea es un comportamiento o una pieza que se puede verificar por sí sola:
- lleva un puñado de tests (orientativo: hasta ~1 h de trabajo y ~10 tests);
- acaba en un commit con `pnpm check` en verde, y `pnpm test:e2e` si toca HTTP o la base de datos;
- si necesita más, se parte en dos.

Orden: el de las dependencias. Como máximo 10 tareas por entrega. Si salen más, se agrupan en entregas
(A, B…). Cada entrega tiene su rama, `feat/NNN-capacidad-a`, que sale de main, y su PR, y valida sus
propios RF.

Responsable: `autor` para la lógica de dominio que conviene hacer a mano, `claude` para la infraestructura
y el código repetitivo. Se puede cambiar sobre la marcha.

«Plan:» y «Ficheros:» apuntan al diseño, no lo copian.

Cada tarea: tests primero (en rojo), luego código hasta verde, marcar [x] y parar.
-->

## Entregas

| Entrega | Rama | Valida | Tareas |
|---|---|---|---|
| A | `feat/NNN-capacidad-a` | RF-1, RF-2 | T1–Tn |

## Entrega A

- [ ] **T1. <Descripción>.** RF-1, RF-2 · Responsable: autor
  - Plan: <sección o secciones del plan>.
  - Ficheros: <principales que se crean o tocan (orientativo)>.
  - Hecho cuando: los tests `RF-1` y `RF-2` están en verde y `pnpm check` pasa.
