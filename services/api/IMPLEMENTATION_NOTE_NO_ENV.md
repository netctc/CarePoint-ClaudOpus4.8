# Slot C Hotfix Packaging Note

This archive intentionally omits `.env` so it does not overwrite a working local database configuration.

Use your existing local `services/api/.env` file, or copy from `.env.example` and supply your current Supabase/Postgres credentials.

Reason:
- previous Slot C hotfix archives included a baked `.env`
- replacing the local API folder could revert database connectivity and force the Admin app back into demo fallback mode
