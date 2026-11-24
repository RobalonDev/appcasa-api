# ADR-0011: Convenciones de la API: errores RFC 9457 e identificadores UUIDv7

- **Estado:** Aceptado
- **Fecha:** 2026-11-24

## Contexto

La spec 001 es la primera con endpoints de dominio. Fija dos convenciones que usarán todas las fases y que son caras de cambiar cuando ya haya clientes y datos:

- **Errores:** la web y el móvil tienen que distinguir los errores sin leer el texto. Por ejemplo, en la spec 001: email no válido, requisitos de la contraseña, contraseña filtrada, requisitos del nombre, código genérico, credenciales genéricas e «inicia sesión». Los textos los traduce el cliente.
- **Identificadores:** aparecen en las URLs y en los tokens. Si son secuenciales, se pueden enumerar, y cualquier fallo de aislamiento entre hogares (ADR-0006) es más fácil de explotar.

## Opciones consideradas

**Errores**
1. **RFC 9457 Problem Details** con un `code` propio: es un estándar de IETF y lo entienden muchas herramientas. Cuesta un filtro de excepciones global.
2. **El formato por defecto de Nest con un `code` añadido**: es el cambio más pequeño, pero no es un estándar y `message` cambia de tipo según el error.
3. **Un envoltorio propio** (`{ error: { code, message, details } }`): mismo coste que el estándar, sin sus ventajas.

**Identificadores**
1. **UUIDv7**: ordenado por tiempo, lo que mantiene el índice compacto; no se puede enumerar; es un estándar (RFC 9562). Revela el momento de creación.
2. **UUIDv4**: aleatorio, no revela nada, pero fragmenta los índices.
3. **bigint autoincremental**: compacto, pero se puede enumerar y revela el volumen de datos.

## Decisión

- **Errores:**
  - Formato `application/problem+json` (RFC 9457), con `type`, `title`, `status` y `detail`.
  - Extensión `code`: identificador estable en inglés y mayúsculas, p. ej. `INVALID_EMAIL`. El cliente se guía por él.
  - Extensión `errors[]` en los errores de validación: el campo y el `code` de cada error.
  - Se implementa con un filtro de excepciones global y el `exceptionFactory` del `StandardSchemaValidationPipe`.
  - Los `code` de cada spec se fijan en su plan.
- **Identificadores:** UUIDv7 en columnas `uuid` de Postgres, para todas las entidades.

## Consecuencias

**Positivas**
- Todas las fases comparten un contrato de errores predecible y estándar.
- Los identificadores no se pueden adivinar ni enumerar, y los índices se mantienen eficientes.

**Negativas**
- Los errores son algo más verbosos, y el filtro global hay que mantenerlo.
- El UUIDv7 revela cuándo se creó cada entidad, con precisión de milisegundos. En AppCasa no es sensible.

**Cuándo revisar**
- Si aparece una entidad cuyo momento de creación sea sensible: usar UUIDv4 para ella.
