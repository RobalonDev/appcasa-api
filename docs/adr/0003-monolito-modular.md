# ADR-0003: Empezar con un monolito modular

- **Estado:** Aceptado
- **Fecha:** 2026-11-16

## Contexto

El dominio tiene varias áreas bastante independientes (identidad, hogares, tareas, gastos, listas, notificaciones). Queremos aprender sistemas distribuidos, pero el equipo es una persona, el tráfico esperado es bajo y aún no conocemos bien los límites del dominio.

## Opciones consideradas

1. **Microservicios desde el inicio**: aprendizaje inmediato de red, mensajería y despliegue, pero con todo el coste operativo (consistencia distribuida, observabilidad, despliegues coordinados) antes de tener un problema que lo justifique. Partir mal los servicios al principio es caro de corregir.
2. **Monolito sin estructura**: rápido al principio, se degrada en acoplamiento.
3. **Monolito modular**: un único desplegable con módulos por *bounded context*, fronteras explícitas y comunicación entre módulos a través de interfaces públicas o eventos.

## Decisión

Monolito modular. Reglas:

- Un módulo Nest por *bounded context* (`identity`, `households`, `chores`, `expenses`, `shopping`, `notifications`...).
- Un módulo no accede a las tablas ni a los providers internos de otro; usa su API pública (servicio exportado) o reacciona a sus eventos de dominio.
- Las piezas transversales (`config`, `database`, `health`) son infraestructura compartida, no dominio.

## Consecuencias

- Desarrollo y despliegue simples; transacciones locales donde haga falta.
- Las fronteras limpias permiten extraer un módulo a un proceso aparte (p. ej. un *worker* de notificaciones) cuando exista una razón concreta: escalado independiente, aislamiento de fallos o tiempos de ejecución distintos. Cada extracción tendrá su propio ADR.
- Hay que vigilar la disciplina de fronteras: el compilador no la impone por sí solo (valorar una regla de lint de imports más adelante).
