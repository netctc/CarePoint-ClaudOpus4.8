# CarePoint V21 - Database Reset and Pilot Seed

## Objetivo

Esta entrega agrega un reset controlado de base de datos para preparar un escenario limpio de reservas médicas. El script elimina los datos existentes y crea solamente el conjunto solicitado para el piloto funcional.

## Comando principal

Desde la raíz del proyecto:

```powershell
npm run db:reset:pilot
```

Este comando ejecuta:

1. `prisma db push --force-reset --accept-data-loss` para recrear el esquema PostgreSQL.
2. `prisma generate` para actualizar Prisma Client.
3. `tsx prisma/reset-pilot-seed.ts` para insertar el dataset controlado.

> Advertencia: el comando borra los datos existentes de la base de datos configurada en `DATABASE_URL` y `DIRECT_URL`.

## Datos creados

### Organización

- `pilot-org-carepoint-v21`
- Nombre: `CarePoint Controlled Pilot Clinic`

### Cuentas administrativas preservadas para acceso

Todas usan password: `ChangeMe123!`

- `admin@carecenter.local` - COMPANY_ADMIN
- `super.admin@carecenter.local` - SUPER_ADMIN
- `support@carecenter.local` - COMPANY_SUPPORT

### 5 profesionales de la salud HSP

Todas usan password: `ChangeMe123!`

| Email | Nombre | Especialidad |
|---|---|---|
| `cardiology.hsp@carepoint.local` | Dra. Valeria Ramos | Cardiology |
| `pediatrics.hsp@carepoint.local` | Dr. Andres Molina | Pediatrics |
| `dermatology.hsp@carepoint.local` | Dra. Camila Santos | Dermatology |
| `neurology.hsp@carepoint.local` | Dr. Gabriel Luna | Neurology |
| `general.medicine.hsp@carepoint.local` | Dra. Lucia Herrera | General Medicine |

Cada HSP queda con:

- perfil `ProviderProfile`
- especialidad y licencia
- servicios asociados
- estado onboarding `APPROVED`
- 1 template de disponibilidad `TELEHEALTH`
- 1 template de disponibilidad `IN_PERSON`
- disponibilidad publicada y paciente-bookable

### 20 pacientes nuevos

Todas usan password: `ChangeMe123!`

Los pacientes quedan con:

- usuario activo `PATIENT`
- perfil `PatientProfile`
- fecha de nacimiento
- edad calculada en preferencias
- género
- teléfono/contacto
- ciudad, región e idioma
- seguro/insuranceNumber
- `bookingEnabled: true`
- `hasExistingAppointments: false`

### Citas

- Total de citas después del reset: `0`
- Ningún paciente tiene citas previas.

### Datos auxiliares

El seed también crea:

- Service catalog items para los servicios de cada HSP.
- Coverage rules activas, con telehealth permitido y sin autorización previa obligatoria.
- Facility settings para centros presenciales y virtual care.
- Reset del archivo `services/api/data/scheduling-store.json` para eliminar holds/slots previos.
- Audit log `database.reset_and_seeded` con resumen del reset.

## Validación automática del script

Al finalizar, el script valida:

- 5 providers.
- 20 patients.
- 0 appointments.
- 0 patients with appointments.
- 10 published schedule templates.
- 5 telehealth templates.
- 5 in-person templates.

Si cualquier condición falla, el script termina con error.
