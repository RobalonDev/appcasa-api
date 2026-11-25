# Lista de contraseñas filtradas

`leaked-passwords.txt` es la lista que usa RF-24 (spec 001; plan, decisión E1). La app la carga en memoria al arrancar, así que la comprobación no depende de ningún servicio externo (RNF-5).

- **Origen:** [SecLists](https://github.com/danielmiessler/SecLists), `Passwords/Common-Credentials/Pwdb_top-1000000.txt`, en el commit `12274c98fdebe98c7a7284914436a472ed469aed`.
- **Licencia:** MIT, © 2018 Daniel Miessler.
- **Contenido:** solo las contraseñas de 12 a 128 caracteres, porque RF-23 ya rechaza las demás. Están normalizadas a NFC, sin duplicados y en el orden original (de más a menos frecuente). Son unas 31.000.
- **Actualizarla:** cambia `SOURCE_COMMIT` en `scripts/build-leaked-passwords.ts` y ejecuta `node scripts/build-leaked-passwords.ts`.
