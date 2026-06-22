# Runbook de rotación de secretos — CarePoint

> **Por qué:** durante la verificación, el `services/api/.env` local contenía
> credenciales reales (PostgreSQL de Supabase y Hostinger, claves JWT y de
> cifrado) que quedaron expuestas. Aunque el archivo está en `.gitignore` y no
> se versionó, esas credenciales deben **rotarse** y gestionarse en un vault.

## Regla de oro
- Nunca commitees `.env`. El gate `npm run check:secrets` lo impide.
- Un valor distinto por entorno (dev / staging / prod).
- Guarda los valores en un gestor de secretos (1Password, Vault, AWS Secrets
  Manager, GitHub Actions Secrets…), no en texto plano compartido.

## 1. Generar secretos nuevos de la aplicación
```bash
npm run gen:secrets          # imprime en formato .env
npm run gen:secrets -- --json
```
Genera valores aleatorios fuertes (48 bytes base64url, ~64 chars) para:
`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `MEDICAL_PROFILE_ENCRYPTION_KEY`,
`PYTHON_SERVICES_SHARED_SECRET`. El script **solo imprime**; copia los valores tú.

## 2. Inventario y tipo de cada secreto

| Secreto | Tipo | Efecto de rotar |
|---------|------|-----------------|
| `JWT_ACCESS_SECRET` | App | Invalida access tokens vigentes (los usuarios siguen con su refresh hasta expirar). Bajo impacto. |
| `JWT_REFRESH_SECRET` | App | Invalida todas las sesiones → todos deben volver a iniciar sesión. Planificar ventana. |
| `MEDICAL_PROFILE_ENCRYPTION_KEY` | App | **⚠️ DESTRUCTIVO con datos existentes** (ver §4). |
| `PYTHON_SERVICES_SHARED_SECRET` | App | Debe cambiarse **a la vez** en la API y en el python-worker (HMAC del bridge). |
| `DATABASE_URL` / `DIRECT_URL` | Proveedor (Supabase/Hostinger) | Ver §5. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Proveedor (Stripe) | Rotar en el dashboard de Stripe. |
| `DAILY_API_KEY` | Proveedor (Daily) | Rotar en Daily. |
| `TWILIO_AUTH_TOKEN` | Proveedor (Twilio) | Rotar en Twilio. |
| `SSO_CLIENT_ID` / secreto SSO | Proveedor (IdP) | Rotar en el proveedor de identidad. |

## 3. Rotar las claves JWT (bajo riesgo)
1. Pega los nuevos `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` en el `.env`/secret store del entorno.
2. Reinicia la API.
3. Efecto esperado: los usuarios vuelven a iniciar sesión. No hay pérdida de datos.

## 4. Rotar `MEDICAL_PROFILE_ENCRYPTION_KEY` (⚠️ con cuidado)
La clave AES-256-GCM se deriva de `sha256(MEDICAL_PROFILE_ENCRYPTION_KEY)`
(`services/api/src/lib/secure-medical-data.ts`). Si la cambias con datos médicos
ya cifrados, el descifrado falla y devuelve el *fallback* **silenciosamente** →
los datos quedan inaccesibles.

- **Base de datos de piloto / sin datos reales:** define la nueva clave **antes**
  de sembrar y luego:
  ```bash
  npm run db:reset:pilot
  ```
- **Con datos médicos reales:** NO la cambies sin re-cifrar. Procedimiento:
  1. Mantén la clave actual como `MEDICAL_PROFILE_ENCRYPTION_KEY_OLD`.
  2. Re-cifra cada registro: descifra con la clave vieja y vuelve a cifrar con la
     nueva. Los datos viven en `PatientProfile.preferences.medicalDataCipher` y en
     los items del workspace de familia (`medicalDataCipher`).
  3. Verifica que un perfil de prueba se descifra OK con la nueva clave.
  4. Retira la clave vieja.

  *(Si tienes datos reales, pídeme y te genero el script de re-cifrado
  `scripts/security/reencrypt-medical-data.mjs` adaptado a tu almacenamiento.)*

## 5. Rotar credenciales de base de datos (Supabase / Hostinger)
1. En el panel del proveedor, cambia la contraseña del usuario de BD (o crea un
   usuario nuevo con permisos y descarta el anterior).
2. Actualiza `DATABASE_URL` y `DIRECT_URL` con la nueva credencial.
   - Supabase suele usar pooler (puerto 6543) para `DATABASE_URL` y conexión
     directa (5432) para `DIRECT_URL` (migraciones).
3. Reinicia la API y verifica `GET /readyz` (debe responder `ok: true`).
4. Revoca/invalida la credencial anterior.

## 6. Rotar el secreto compartido del python-worker
`PYTHON_SERVICES_SHARED_SECRET` se usa para firmar (HMAC) el bridge API↔worker.
Debe coincidir en ambos lados:
1. Define el mismo valor nuevo en el `.env` de la API y en el del worker.
2. Reinicia API y worker a la vez.
3. Verifica con `npm run verify:python-worker`.

## 7. Rotar claves de terceros
Rota en el panel de cada proveedor (Stripe, Daily, Twilio, IdP de SSO) y
actualiza el `.env`/secret store. En Stripe, actualiza también el
`STRIPE_WEBHOOK_SECRET` del endpoint correspondiente.

## 8. Verificación final
```bash
npm run check:secrets     # no debe haber secretos versionados
npm run verify:s1         # arranca API + smoke (necesita Postgres + Redis)
```
- `GET /readyz` → `ok: true` (BD accesible con la nueva credencial).
- Login funciona (JWT nuevos).
- Un perfil médico de prueba se lee correctamente (clave de cifrado correcta).

## 9. Higiene post-rotación
- Borra cualquier `.env` con credenciales viejas de equipos/historial de chats.
- Confirma que los valores viven solo en el gestor de secretos.
- En producción: `NODE_ENV=production` hace que `env.ts` rechace secretos < 32
  chars o de la lista insegura — no arrancará con valores placeholder.
