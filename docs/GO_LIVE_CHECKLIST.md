# Checklist de Go-Live — CarePoint (staging → producción)

Complemento operativo del `docs/pilot/PILOT_V6_FINAL_GO_LIVE_EXECUTION_CERTIFICATE.md`.
Mapea los gates a lo verificado en las Fases 0–4 y deja claro qué falta y quién.

## A. Estado técnico (verificado en este trabajo)

| Ítem | Estado |
|------|--------|
| Backend compila (`tsc`) y arranca; smoke 5/5 | ✅ |
| Web admin + provider compilan (`next build`) | ✅ |
| Apps Flutter `flutter analyze` sin issues | ✅ |
| Python worker: tests verdes | ✅ |
| Clon limpio compila (módulo `coverage` ya commiteado) | ✅ |
| Gates de secretos/workspace sin falsos positivos | ✅ |
| Rendimiento Admin < 2s (organizations 102ms, dashboard 204ms) | ✅ |
| Router de admin (`/api/admin/users/*`) montado | ✅ |
| Imágenes Docker construyen (api/admin/provider) | ✅ tras fixes |
| Deploy aplica migraciones (`start:prod`) | ✅ |
| Generador de secretos + runbook de rotación | ✅ |

## B. Acciones que debes completar tú (organización / operación)

- [ ] **Rotar secretos reales** según `docs/SECRET_ROTATION_RUNBOOK.md`
      (BD Supabase/Hostinger, JWT, clave de cifrado médico, Stripe/Daily/Twilio).
- [ ] Definir el **entorno de staging** (dominios, TLS, DB gestionada).
- [ ] Rellenar el certificado de go-live (campos hoy "TBD"):
      Decision owner, Release owner, Support owner, Pilot owner, Environment,
      Date, Open risks, Waivers, Post-close owner, Signature.
- [ ] Confirmar `NODE_ENV=production`, `ALLOW_LOCALHOST_CORS_WILDCARD=false`,
      `ALLOW_AUDIT_FALLBACK_IN_PRODUCTION` ausente/false.
- [ ] Configurar backups de la BD y retención.

## C. Secuencia de despliegue a staging (Docker Compose / Dokploy)

```bash
cd deploy/dokploy
cp .env.example .env
# 1) Edita .env:
#    - POSTGRES_* y DATABASE_URL/DIRECT_URL con credenciales reales
#    - JWT_*, MEDICAL_PROFILE_ENCRYPTION_KEY, PYTHON_SERVICES_SHARED_SECRET  (npm run gen:secrets)
#    - *_DOMAIN y NEXT_PUBLIC_API_BASE_URL con los dominios reales (https)
#    - ALLOW_LOCALHOST_CORS_WILDCARD=false
#    - PGADMIN_DEFAULT_EMAIL / PGADMIN_DEFAULT_PASSWORD

# 2) Construir imágenes
docker compose -f docker-compose.dokploy.yml build

# 3) Levantar datos + API (la API aplica migraciones al arrancar via start:prod)
docker compose -f docker-compose.dokploy.yml up -d postgres redis
docker compose -f docker-compose.dokploy.yml up -d api
docker compose -f docker-compose.dokploy.yml logs -f api   # ver "prisma migrate deploy" + "API listening"

# 4) (Opcional, solo piloto/staging) sembrar datos de piloto
#    NO en producción real. Desde un contenedor/host con acceso a la BD:
#    npm run db:reset:pilot     # ⚠️ borra y resiembra

# 5) Levantar el resto
docker compose -f docker-compose.dokploy.yml up -d
```

### Verificación post-deploy
- [ ] `GET https://<api>/livez` → 200; `GET /readyz` → `ok:true` (BD accesible).
- [ ] Login admin OK; `/portal/organizations` y `/portal/dashboard` cargan con datos reales y rápido.
- [ ] Login provider OK; portal carga.
- [ ] Worker Python: contenedores `python-worker-api` y `-celery` healthy.
- [ ] Sin errores P0/P1 en logs durante la ventana de observación.

## D. Rollback
- Mantener la imagen/tag anterior. Si falla el deploy:
  `docker compose -f docker-compose.dokploy.yml up -d --no-deps <servicio>` con el tag previo.
- Las migraciones son aditivas (índices con `IF NOT EXISTS`); un rollback de imagen no requiere bajar migraciones.
- Backups de BD antes de cada release.

## E. Notas
- Producción **no** auto-siembra; el seed es solo para piloto/staging.
- Imágenes single-stage (grandes); optimización futura: multi-stage + Next `standalone`.
- Warnings de deprecación de Pydantic v2 en el worker: deuda técnica, no bloquean.
