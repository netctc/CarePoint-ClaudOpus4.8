# Environment loading hotfix

This package does not include a real `.env` file.

Runtime env loading now checks these files in order, with later files overriding earlier ones:

1. repo root `.env`
2. repo root `.env.local`
3. `services/api/.env`
4. `services/api/.env.local`

This prevents workspace runs from accidentally ignoring a correct `services/api/.env`.
