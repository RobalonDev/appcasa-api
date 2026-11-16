# ADR-0006: El hogar como tenant; un usuario puede pertenecer a varios

- **Estado:** Aceptado
- **Fecha:** 2026-11-16

## Contexto

Los datos (tareas, gastos, listas) pertenecen a un hogar y solo sus miembros deben verlos. Una misma persona puede compartir piso y, a la vez, formar parte del hogar familiar.

## Opciones consideradas

1. **Un usuario = un hogar**: modelo más simple, pero obliga a duplicar cuentas en un caso de uso real.
2. **Relación N:M usuario–hogar mediante una membresía con rol**: el hogar actúa como *tenant* lógico.

## Decisión

Opción 2. Existe una entidad de membresía (usuario, hogar, rol). Todo dato de dominio pertenece a un hogar, y toda operación se autoriza comprobando la membresía del usuario en ese hogar. Aislamiento por columna (`householdId`) en una base de datos compartida.

## Consecuencias

- Las rutas y casos de uso operan siempre en el contexto de un hogar concreto.
- Olvidar el filtro por hogar sería una fuga de datos entre tenants: la autorización debe centralizarse (guard/política) y cubrirse con tests. Valorar Row-Level Security de Postgres como segunda barrera más adelante.
- Roles y permisos concretos se definirán en la fase 1.
