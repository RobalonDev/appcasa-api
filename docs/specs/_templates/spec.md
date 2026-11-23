# Spec NNN: <Capacidad>

- **Estado:** borrador <!-- borrador | aprobada | implementada -->
- **Fecha:** AAAA-MM-DD
- **ADRs relacionados:** —

<!--
Solo QUÉ y POR QUÉ. Nada de tecnología, tablas, endpoints ni nombres de ficheros: eso va en plan.md.
Cada requisito funcional en formato EARS y verificable (debe poder convertirse en un test).
-->

## Contexto y objetivo

Qué problema resolvemos, para quién y por qué ahora. Qué cambia para el usuario cuando esto exista.

## Usuarios

Quién interactúa con esta capacidad (p. ej. miembro, administrador del hogar, invitado sin cuenta).

## Definiciones

Lenguaje del dominio: términos con un significado preciso en esta spec. Si un término aparece en un requisito y puede leerse de dos formas, se define aquí.

- **Término:** definición.

## Historias de usuario

- **HU-1.** Como <usuario>, quiero <acción> para <beneficio>.

## Requisitos funcionales

<!--
Patrones EARS:
  CUANDO <evento>, EL SISTEMA <respuesta>.
  SI <condición no deseada>, ENTONCES EL SISTEMA <respuesta>.
  MIENTRAS <estado>, EL SISTEMA <respuesta>.
  EL SISTEMA <comportamiento permanente>.
Un requisito = un comportamiento. Indica la HU que cubre.
-->

- **RF-1** (HU-1). CUANDO …, EL SISTEMA …

## Requisitos no funcionales

Seguridad, rendimiento, privacidad, auditoría… también verificables (con un umbral o una comprobación concreta).

- **RNF-1.** …

## Casos límite

Situaciones raras pero posibles y cómo deben comportarse (o el RF que las cubre).

- …

## Fuera de alcance

Lo que explícitamente NO hace esta spec, para que nadie lo implemente "de paso".

- …

## Criterios de finalización

- Todos los RF y RNF tienen al menos un test que los referencia por su id (`RF-n`) y está en verde.
- `pnpm check` y `pnpm test:e2e` en verde.
- El reviewer da `VEREDICTO: APROBADO` en `/sdd-validate` (en `/sdd-clarify` el veredicto es `LISTA PARA APROBAR`).

## Dudas abiertas

Cada duda se marca `[NECESITA ACLARACIÓN]`. La spec no puede pasar a `aprobada` con dudas abiertas.

- [NECESITA ACLARACIÓN] …
