#!/usr/bin/env node
// Generador de secretos para CarePoint.
//
// Produce valores aleatorios fuertes para los secretos de la plataforma y los
// imprime por stdout. NO escribe ningun archivo ni toca tu .env: copia los
// valores manualmente al gestor de secretos / .env del entorno correspondiente.
//
// Uso:
//   node scripts/security/generate-secrets.mjs            # formato .env
//   node scripts/security/generate-secrets.mjs --json     # formato JSON
//
// Cada secreto son 48 bytes aleatorios en base64url (~64 chars), muy por encima
// del minimo de 32 que exige el validador de produccion (services/api/src/lib/env.ts).

import { randomBytes } from 'node:crypto';

function strongSecret(bytes = 48) {
  return randomBytes(bytes).toString('base64url');
}

// Secretos que DEBEN ser valores aleatorios propios por entorno.
const SECRET_KEYS = [
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'MEDICAL_PROFILE_ENCRYPTION_KEY',
  'PYTHON_SERVICES_SHARED_SECRET',
];

const generated = Object.fromEntries(SECRET_KEYS.map((key) => [key, strongSecret()]));

const asJson = process.argv.includes('--json');

if (asJson) {
  console.log(JSON.stringify(generated, null, 2));
} else {
  console.log('# CarePoint - secretos generados ' + new Date().toISOString());
  console.log('# Copialos al gestor de secretos/.env del entorno. NO los commitees.');
  console.log('#');
  console.log('# AVISO: rotar MEDICAL_PROFILE_ENCRYPTION_KEY sobre una base de datos con');
  console.log('# datos medicos ya cifrados los deja INACCESIBLES. Ver docs/SECRET_ROTATION_RUNBOOK.md.');
  console.log('# PYTHON_SERVICES_SHARED_SECRET debe coincidir en la API y en el python-worker.');
  console.log('');
  for (const [key, value] of Object.entries(generated)) {
    console.log(`${key}=${value}`);
  }
}
