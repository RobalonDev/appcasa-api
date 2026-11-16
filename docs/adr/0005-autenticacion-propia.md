# ADR-0005: Autenticación propia con JWT y refresh tokens

- **Estado:** Aceptado
- **Fecha:** 2026-11-16

## Contexto

Los usuarios acceden desde web y móvil. Necesitamos registro, inicio de sesión, sesiones de larga duración en móvil y poder cerrar sesión o revocar accesos. El proyecto busca aprender cómo funciona la autenticación por dentro.

## Opciones consideradas

1. **Proveedor externo (Auth0, Clerk, Cognito...)**: seguro y completo, menos código; es lo habitual en producción, pero oculta lo que queremos aprender y añade dependencia de un tercero.
2. **Sesiones en servidor con cookie**: simple y revocable, natural en web; algo más incómodo en clientes móviles.
3. **JWT de acceso de vida corta + refresh token opaco rotativo**: funciona bien en web y móvil; la revocación se apoya en los refresh tokens guardados en base de datos.

## Decisión

Opción 3, implementada por nosotros. El diseño concreto (algoritmo de hash de contraseñas —previsiblemente argon2id—, duración de tokens, rotación y detección de reutilización, almacenamiento en cliente) se detallará en un ADR propio al empezar la fase 1.

## Consecuencias

- Aprendizaje completo del flujo de autenticación y de sus riesgos.
- Somos responsables de su seguridad: necesita tests exhaustivos y revisión específica.
- Funcionalidades como login social o MFA cuestan más; si se vuelven prioritarias, revisar esta decisión.
