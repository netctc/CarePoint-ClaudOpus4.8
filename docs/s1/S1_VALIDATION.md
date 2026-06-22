# Validación S1

## Validado en sandbox

Comandos ejecutables sin instalar dependencias externas:

```bash
npm run verify:s1:config
npm run check:secrets
npm run verify:workspace
```

Resultado esperado: todos deben pasar.

## Validación completa pendiente en entorno con red

```bash
npm ci --no-audit --no-fund
npm run verify:s1
```

La validación completa requiere descargar paquetes npm y binarios Prisma.

## Validación manual del API

Tras compilar y arrancar el API:

```bash
npm run build:backend
npm run start --workspace @care-center/api
npm run smoke:api
```

Endpoints mínimos:

- `/livez` debe responder `200` aunque PostgreSQL no esté listo.
- `/readyz` debe responder `200` cuando PostgreSQL está listo y `503` cuando no lo está.
- `/api/health/live` debe responder `200`.
- `/api/health/ready` debe responder `200` o `503` según dependencias.
