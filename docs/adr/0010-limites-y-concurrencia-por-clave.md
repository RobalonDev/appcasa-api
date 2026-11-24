# ADR-0010: Límites exactos bajo concurrencia: eventos en Postgres y bloqueo consultivo por clave

- **Estado:** Aceptado
- **Fecha:** 2026-11-24

## Contexto

La spec 001 tiene varios límites con ventanas deslizantes, todos aplicados a un mismo email:

- envíos de email (RF-12): 1 por minuto y 5 por hora;
- intentos fallidos sobre un mismo código (RF-10): 5;
- intentos fallidos de verificación (RF-15): 10 en 24 horas;
- inicios de sesión fallidos (RF-22): 5 en 15 minutos.

RNF-3 exige que se cumplan con exactitud aunque lleguen peticiones simultáneas. Además, RF-30 y RF-40 exigen una sola cuenta por email. El patrón ingenuo (leer el contador, decidir, escribir) deja pasar a dos peticiones simultáneas cuando falta una para el límite.

El mismo problema volverá en fases futuras, por ejemplo con la idempotencia de los gastos o las operaciones concurrentes sobre un mismo recurso.

## Opciones consideradas

1. **Tablas de eventos en Postgres más un bloqueo consultivo (advisory lock) por clave.** Cada evento relevante se guarda con su fecha, y la operación sobre una clave se serializa con `pg_advisory_xact_lock`. Las ventanas deslizantes son exactas y no hace falta infraestructura nueva. Las tablas crecen y hay que limpiarlas.
2. **Un contador por ventana fija** (una fila por clave y límite, con `SELECT … FOR UPDATE`). Ocupa menos, pero con ventanas fijas caben dos envíos en «el último minuto» si caen a ambos lados del corte: no cumple la spec.
3. **Redis** (conjuntos ordenados y un script Lua atómico). Es lo estándar para el rate limiting, pero añade Redis antes de la fase 4, y la creación de la cuenta sigue necesitando la base de datos.

## Decisión

Opción 1:

- Toda operación sujeta a un límite sobre una clave (aquí, el email normalizado) abre una transacción y hace, en este orden:
  1. toma `pg_advisory_xact_lock` sobre esa clave;
  2. cuenta los eventos de la ventana;
  3. decide;
  4. escribe el resultado y el evento.
- El bloqueo se libera al terminar la transacción.
- El bloqueo cubre también la parte lenta de la operación cuando el límite depende de su resultado:
  - el envío SMTP, que solo cuenta si se acepta (ADR-0009);
  - la verificación argon2 del inicio de sesión, que solo cuenta si falla.
- Las restricciones de la base de datos (`UNIQUE` sobre el email normalizado) son la última barrera de las invariantes (RF-40), aunque falle la lógica de la aplicación.

## Consecuencias

**Positivas**
- Los límites son exactos y fáciles de probar, también con peticiones simultáneas.
- El patrón sirve para cualquier invariante por clave en el futuro.
- Sin infraestructura nueva.

**Negativas**
- Una operación sobre una clave espera a la anterior sobre la misma clave. Durante un envío SMTP pueden ser cientos de milisegundos, pero solo afecta a ese email.
- Cada operación ocupa una conexión del pool mientras dura.
- Las tablas de eventos crecen: hace falta limpiar los eventos más antiguos que la ventana más larga (24 horas).

**Cuándo revisar**
- Si la contención por clave o el uso de conexiones se notan.
- Cuando llegue Redis (fase 4), valorar mover allí los límites que no protegen invariantes de la base de datos.
