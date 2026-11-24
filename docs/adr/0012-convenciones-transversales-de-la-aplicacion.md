# ADR-0012: Convenciones transversales de la aplicación: denegar por defecto y reloj inyectable

- **Estado:** Aceptado
- **Fecha:** 2026-11-24

## Contexto

La spec 001 introduce dos piezas que afectan a todos los módulos que vendrán, no solo a la autenticación:

- **Exigir sesión por defecto:** el sistema exige sesión en toda operación salvo las marcadas como públicas (RNF-1). Si cada controlador tuviera que acordarse de proteger sus rutas, bastaría un olvido para dejar una ruta abierta.
- **Fechas controlables en los tests:** la autenticación tiene plazos de 15 minutos, 24 horas, 30 días y 90 días, y habrá más en la fase 2 (recurrencia de tareas) y en la fase 3 (saldos y liquidaciones). Si unas fechas salen de la aplicación y otras de `now()` en la base de datos, los tests no pueden controlar el tiempo y aparecen desfases entre las dos fuentes.

Además, los tests e2e tienen que probar la misma aplicación que se ejecuta en producción: con el mismo pipe de validación y el mismo filtro de errores (ADR-0011).

## Opciones consideradas

**Protección de rutas**
1. **Guard global que deniega por defecto**, con un decorador `@Public()` para las excepciones. Un olvido deja la ruta cerrada, no abierta.
2. **Guard por controlador o por ruta**: más explícito, pero un olvido deja la ruta abierta.

**Fuente de tiempo**
1. **Un `Clock` inyectable como única fuente de tiempo**: los tests lo sustituyen por un reloj controlable.
2. **Temporizadores falsos de Vitest** (`vi.useFakeTimers`): no controlan el `now()` de la base de datos, y en los e2e chocan con la E/S asíncrona.
3. **Fechas generadas por la base de datos** (`now()`): no se pueden controlar en los tests.

## Decisión

- **Guard global.**
  - El guard de autenticación se registra con `APP_GUARD` y exige un token de acceso válido en toda ruta.
  - `@Public()` marca las excepciones y vive en `src/http/`, que es infraestructura compartida. Así, módulos como `health` no dependen de un módulo de dominio (ADR-0003).
  - `@CurrentSession()` entrega al controlador el usuario y la sesión autenticados.
- **Reloj.**
  - Todas las fechas de la aplicación salen de `Clock.now()`.
  - Ninguna regla de negocio usa `now()` de la base de datos ni `new Date()` directamente.
  - Los tests e2e sustituyen el `Clock` por un reloj controlable.
- **Configuración común.** `configureApp(app)` aplica a la aplicación el pipe de validación y el filtro de errores. Lo usan `main.ts` y todos los tests e2e.

## Consecuencias

**Positivas**
- Olvidar una anotación deja la ruta protegida, no expuesta.
- Los plazos se prueban en los bordes de forma determinista, sin esperas reales.
- Los e2e prueban la aplicación real.

**Negativas**
- Cada ruta pública necesita `@Public()` explícito, también las de infraestructura.
- Hay que vigilar que nadie use `new Date()` en la lógica de negocio. Valorar una regla de lint más adelante.

**Cuándo revisar**
- Cuando llegue la autorización por hogar (spec 002): el guard de membresía se encadenará con este, sin sustituirlo.
