# ADR-0008: Diseño de la autenticación: sesiones, tokens y hash de contraseñas

- **Estado:** Aceptado
- **Fecha:** 2026-11-24

## Contexto

ADR-0005 eligió autenticación propia con un JWT de acceso de vida corta y un refresh token opaco rotativo, y dejó el diseño concreto para un ADR propio al empezar la fase 1. La spec 001 fija los requisitos que ese diseño tiene que cumplir:

- Una sesión finalizada deja de servir en 5 minutos como máximo (RNF-4, D17).
- Una sesión copiada se finaliza sin afectar a las demás (RF-36, D18).
- Una sesión caduca tras 30 días sin uso (RF-20) o a los 90 días de crearse (RF-21).
- Dos contraseñas canónicamente equivalentes en Unicode son la misma (RF-39).
- El tiempo de respuesta no permite averiguar si un email tiene cuenta (RNF-2).
- Un único contrato sirve para web y móvil.

Nest ofrece un paquete oficial, `@nestjs/authentication`, que resuelve gran parte de esto, pero en el momento de decidir estaba en la versión 0.1.7.

## Opciones consideradas

**Implementación**
1. **Paquete `@nestjs/authentication`**: menos código y un diseño ya pensado. Pero está en 0.x, sustituiría ADR-0005 y oculta lo que queremos aprender. Las reglas propias de la spec (límites de envío, bloqueos y registro en dos pasos) habría que escribirlas igualmente.
2. **Propia, sobre `node:crypto`**: más código y más responsabilidad, coherente con ADR-0005.

**Validez de la sesión**
1. **JWT sin estado de 5 min**: la API no consulta la base de datos en cada petición. RNF-4 se cumple por la propia vida del token.
2. **El mismo JWT con una ventana de gracia en la rotación**: evita que un corte de red cierre la sesión. Exige guardar más estado y deja pasar una copia usada dentro de la ventana.
3. **Validar la sesión en la base de datos en cada petición**: la revocación es inmediata, pero cuesta una consulta por petición y contradice ADR-0005.

**Transporte de los tokens**
1. **Bearer y refresh en el cuerpo JSON** para todos los clientes. Sin cookies no hay CSRF.
2. **Cookie HttpOnly para el refresh en la web**: más resistente a XSS, pero exige dos caminos en el código, CORS con credenciales y protección CSRF.

**Firma del JWT**
1. **`jose` con EdDSA (Ed25519)**: firma asimétrica y librería ESM sin dependencias.
2. **`@nestjs/jwt` con HS256**: quien puede verificar también puede firmar, y arrastra `jsonwebtoken`, que no es ESM.
3. **A mano con `node:crypto`**: sin dependencias, pero con riesgo de equivocarse en el formato.

**Parámetros de argon2id**
1. **Mínimo de OWASP: 19 MiB, t=2, p=1**.
2. **RFC 9106: 64 MiB, t=3, p=4**: más resistente, pero con mucha memoria por login simultáneo.
3. **Calibrar en cada entorno**: más flexible, a cambio de configuración y un paso de calibración.

## Decisión

- **Autenticación propia**, sobre `node:crypto`. ADR-0005 se mantiene.
- **Sesión** = una fila en la base de datos por cada inicio de sesión o registro completado.
- **JWT de acceso:**
  - es sin estado y caduca a los 5 minutos;
  - se firma con EdDSA (Ed25519) usando `jose` 6.2.x, y al verificar solo se acepta ese algoritmo;
  - las claves van en variables de entorno validadas en `src/config/env.ts`.
- **Refresh token:**
  - es opaco y de un solo uso: cada renovación lo sustituye por uno nuevo (rotación);
  - solo se guarda su hash, junto con los hashes de los refresh ya usados de la sesión;
  - si llega un refresh ya usado, la sesión se considera copiada y se finaliza solo esa (RF-36);
  - sin ventana de gracia.
- **Último uso de una sesión (RF-20)** = el momento de su última renovación. No se puede operar más de 5 minutos sin renovar, así que el error es de 5 minutos como mucho.
  - _Precisado el 2026-11-24 (revisión del plan 001):_ para no finalizar nunca una sesión antes de los 30 días sin uso, se da por caducada en `última renovación + 30 días + 5 minutos`. Como mucho caduca 5 minutos tarde, dentro de la tolerancia de «sesión válida» (RNF-4). No cambia la decisión.
- **Transporte:**
  - el JWT de acceso va en `Authorization: Bearer`;
  - el refresh viaja en el cuerpo JSON, tanto en las respuestas (registro, inicio de sesión, renovación) como en las peticiones (renovación, cierre de sesión);
  - el contrato es el mismo para web y móvil.
- **Contraseñas:**
  - argon2id nativo de Node (`crypto.argon2`), con m=19 MiB, t=2 y p=1 (OWASP);
  - antes del hash, la contraseña se normaliza a NFC (RF-39);
  - el hash se guarda en formato PHC con sus parámetros, para poder subirlos más adelante y volver a calcularlo en el siguiente inicio de sesión;
  - con un email sin cuenta se calcula un hash ficticio, para igualar el tiempo de respuesta (RNF-2).

## Consecuencias

**Positivas**
- Ninguna petición autenticada consulta la base de datos para validar la sesión.
- La revocación tiene un plazo acotado de 5 minutos, que es el que fija la spec.
- Un futuro servicio extraído (fase 7) podrá verificar tokens con la clave pública sin poder firmarlos.
- Solo se añade una dependencia (`jose`); el hash de contraseñas no necesita ninguna.

**Negativas**
- Si la respuesta de una renovación se pierde por la red, el cliente reintenta con el refresh anterior, la sesión se toma por copiada y ese dispositivo tiene que volver a iniciar sesión. Lo acepta D18.
- En la web, un XSS puede leer el refresh token. Lo mitiga la detección de copia, pero no lo impide.
- Hay que gestionar un par de claves Ed25519 en cada entorno, y rotarlas en el futuro.
- Somos responsables de la seguridad de todo el flujo: necesita tests exhaustivos.

**Cuándo revisar**
- Al desplegar (fase 6): los parámetros de argon2id y la gestión de claves.
- Cuando exista el frontend web y se sepa si comparte dominio con la API: el refresh en una cookie HttpOnly.
- Si los cierres de sesión por cortes de red resultan frecuentes en la práctica: una ventana de gracia.
