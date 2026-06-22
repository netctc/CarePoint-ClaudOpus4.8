# Validación V18

Comandos ejecutados:

```bash
npm run check:secrets --silent
npm run verify:workspace --silent
npm run verify:python-worker --silent
cd services/python-worker && python3 -m pytest -q
unzip -tq /mnt/data/CarePoint_option_B_python_progressive_v18.zip
```

Resultado esperado en Python: `66 passed`.

El build TypeScript completo debe ejecutarse en CI/dev con `npm ci && npm run build:contracts && npm run build:api`.
