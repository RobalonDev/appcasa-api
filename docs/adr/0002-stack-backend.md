# ADR-0002: Stack backend: NestJS, Prisma y PostgreSQL

- **Estado:** Aceptado
- **Fecha:** 2026-11-16

## Contexto

AppCasa necesita una API para clientes web y móvil con usuarios, hogares compartidos, tareas, gastos y listas de la compra. El objetivo explícito del proyecto es **aprender backend**: autenticación, autorización, modelado de datos, consistencia, tiempo real, colas y despliegue. El autor ya conoce Node, TypeScript, NestJS, Prisma y PostgreSQL.

## Opciones consideradas

1. **Supabase (BaaS)**: Postgres gestionado con auth, API autogenerada, RLS, realtime y storage. Muy rápido para sacar producto, pero resuelve justo lo que queremos aprender a construir; la lógica acabaría repartida entre RLS, funciones y el cliente.
2. **NestJS + Prisma + PostgreSQL propios**: más trabajo, control total, todo el backend es nuestro y explicable.
3. **Otro stack (Go, Kotlin/Spring...)**: interesante, pero el coste de aprender lenguaje y ecosistema a la vez desviaría el foco de la arquitectura.

## Decisión

Opción 2:

- **NestJS 12** (ESM, TypeScript estricto): módulos, inyección de dependencias y piezas oficiales para colas, eventos, WebSockets, etc.
- **Prisma 7** con el driver adapter `@prisma/adapter-pg`: migraciones versionadas y cliente tipado. Fijado en 7.x estable (la etiqueta `latest` de npm apuntaba a una RC de la 8 en el momento de decidir).
- **PostgreSQL 18**: relacional, transaccional y con lo que necesitaremos (constraints, JSONB, `LISTEN/NOTIFY`, `SKIP LOCKED`).
- **Docker Compose** solo para la infraestructura local; la API corre en el host durante el desarrollo.
- **Zod** para validar la configuración (y, más adelante, entradas), vía Standard Schema.
- **Vitest** (por defecto en Nest 12) y **oxlint** + Prettier.

## Consecuencias

- Todo el backend es nuestro: más aprendizaje, más responsabilidad (seguridad, operación).
- Dependemos de Prisma para el acceso a datos; para consultas complejas o bloqueos finos usaremos SQL crudo tipado (`$queryRaw` / TypedSQL) cuando haga falta.
- Revisar si en algún momento la operación (backups, escalado de Postgres) pesa más que el aprendizaje: un Postgres gestionado en el despliegue es compatible con esta decisión.
