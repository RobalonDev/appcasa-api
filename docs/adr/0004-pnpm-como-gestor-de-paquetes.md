# ADR-0004: pnpm como gestor de paquetes

- **Estado:** Aceptado
- **Fecha:** 2026-11-16

## Contexto

Necesitamos un gestor de paquetes para Node. Es probable que el repositorio crezca a varias aplicaciones o paquetes (API, *worker*, tipos compartidos), y queremos que las dependencias sean explícitas y reproducibles.

## Opciones consideradas

1. **npm**: viene con Node, cero configuración. `node_modules` plano: permite importar dependencias transitivas no declaradas (*phantom dependencies*). Workspaces más limitados.
2. **pnpm**: `node_modules` estricto (solo se importa lo declarado), almacén global con enlaces (rápido, poco disco), buen soporte de workspaces y filtros. Bloquea por defecto los scripts de instalación de dependencias.
3. **Yarn (Berry)**: potente, pero Plug'n'Play añade fricción con algunas herramientas.

## Decisión

pnpm, fijado en `package.json` (`packageManager`). Los scripts de instalación solo se permiten de forma explícita en `pnpm-workspace.yaml` (`allowBuilds`), hoy únicamente para `prisma` y `@prisma/engines`.

## Consecuencias

- Los errores por dependencias no declaradas aparecen en desarrollo, no en producción (ya ocurrió con `dotenv` al configurar Prisma).
- Preparado para un monorepo con workspaces.
- Las imágenes Docker y el CI deben instalar o activar pnpm.
- Cada nueva dependencia con scripts de instalación requiere aprobarla conscientemente.
