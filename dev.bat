@echo off
REM ============================================================================
REM CarePoint - lanzador del stack de desarrollo (Windows)
REM
REM Uso:
REM   dev.bat            Levanta infra (Postgres+Redis) y todos los servicios
REM                      backend/web en ventanas separadas.
REM   dev.bat setup      Instalacion inicial (npm install, prisma, deps Python).
REM   dev.bat infra      Solo levanta Postgres + Redis (docker).
REM   dev.bat down       Detiene la infra de docker (postgres/redis/worker).
REM   dev.bat mobile     Muestra los comandos para las apps Flutter.
REM
REM Puertos: API 4000 | Admin 3001 | Provider 3000 | PyWorker 8010
REM ============================================================================
setlocal
cd /d "%~dp0"

if /i "%~1"=="setup"  goto :setup
if /i "%~1"=="infra"  goto :infra
if /i "%~1"=="down"   goto :down
if /i "%~1"=="mobile" goto :mobile

REM ---- por defecto: infra + todos los servicios ----
echo [dev] Levantando Postgres + Redis...
docker compose up -d postgres redis
echo [dev] Esperando a que la base de datos acepte conexiones...
timeout /t 3 >nul

start "CarePoint API"      cmd /k "npm run dev:api"
start "CarePoint Admin"    cmd /k "npm run dev:admin"
start "CarePoint Provider" cmd /k "npm run dev:provider"
start "CarePoint PyWorker" cmd /k "npm run dev:python-worker"
start "CarePoint Celery"   cmd /k "npm run worker:python"

echo.
echo [dev] Servicios lanzados en ventanas separadas:
echo        API       http://localhost:4000
echo        Admin     http://localhost:3001
echo        Provider  http://localhost:3000
echo        PyWorker  http://localhost:8010
echo.
echo [dev] Apps Flutter (ejecutar manualmente):  dev.bat mobile
goto :end

:setup
echo [setup] docker compose up -d postgres redis
docker compose up -d postgres redis
echo [setup] npm install
call npm install
echo [setup] prisma generate + db push
call npm run prisma:generate
call npm run db:push
echo [setup] dependencias del worker Python
call npm run setup:python-worker
echo [setup] Completo. Arranca el stack con:  dev.bat
goto :end

:infra
docker compose up -d postgres redis
echo [infra] Postgres + Redis arriba.
goto :end

:down
docker compose down
echo [down] Infra detenida.
goto :end

:mobile
echo Apps Flutter (cada una en su terminal):
echo   cd apps\mobile          ^&^& flutter run --dart-define=API_BASE_URL=http://localhost:4000
echo   cd apps\provider_mobile ^&^& flutter run --dart-define=API_BASE_URL=http://localhost:4000
goto :end

:end
endlocal
