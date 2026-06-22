# CarePoint V12 — Reset funcional a V6 + capa compartida de diseño

## Decisión técnica
Esta entrega descarta V7 y V11 como base técnica. El código parte nuevamente de:

- `CarePoint_controlled_pilot_go_live_execution_v6.zip`

Las entregas V7 y V11 quedan únicamente como referencia visual para fases posteriores.

## Objetivo de V12
Crear una base segura para rediseñar sin perder funcionalidad:

1. Mantener intactas las rutas, loaders, API calls, server actions, formularios y módulos funcionales de V6.
2. Agregar una capa compartida de diseño reutilizable para Provider y Admin.
3. Evitar rediseños estáticos que sustituyan lógica real.
4. Corregir la pantalla inicial de Provider para que la raíz redirija al login existente.

## Cambios aplicados

### Provider
- `apps/provider/app/page.tsx`
  - Antes mostraba la pantalla starter.
  - Ahora redirige a `/sign-in`, cumpliendo la regla de que la pantalla starter no vuelva a aparecer.

- `apps/provider/components/design/provider-design.tsx`
  - Nueva capa visual reutilizable.
  - Componentes agregados:
    - `ProviderPageHeader`
    - `ProviderSectionCard`
    - `ProviderKpiCard`
    - `ProviderActionButton`
    - `ProviderStatusPill`
    - `ProviderTable`
    - `ProviderGrid`

- `apps/provider/app/globals.css`
  - Nuevos estilos prefijados con `cp-provider-v12-*`.
  - No reemplazan estilos existentes.
  - No modifican rutas ni lógica funcional.

### Admin
- `apps/admin/src/components/design/admin-design.tsx`
  - Nueva capa visual reutilizable.
  - Componentes agregados:
    - `AdminPageHeader`
    - `AdminSectionCard`
    - `AdminKpiCard`
    - `AdminActionButton`
    - `AdminStatusPill`
    - `AdminTable`
    - `AdminGrid`

- `apps/admin/src/app/globals.css`
  - Nuevos estilos prefijados con `cp-admin-v12-*`.
  - No reemplazan estilos existentes.
  - No eliminan páginas ni llamadas funcionales.

## Guardrails para las próximas fases

A partir de V12, cada pantalla se rediseñará con esta regla:

> La funcionalidad de V6 manda; el nuevo diseño se aplica por encima sin eliminar loaders, APIs, server actions, client actions, formularios, tablas dinámicas, permisos, estados de error o navegación a detalle.

## Próxima fase recomendada

V13 debe aplicar el diseño compartido a Provider:

1. login Provider
2. shell Provider
3. dashboard Provider

Cada página debe ser validada individualmente antes de avanzar.

## Validación funcional mínima esperada

Antes de aceptar una pantalla rediseñada, verificar:

- la ruta existe
- los datos cargan desde API o fallback funcional
- acciones y formularios siguen conectados
- estados loading/error/empty siguen presentes
- navegación a detalle funciona
- build compila


## Build validation executed

The following commands were executed successfully after installing workspace dependencies with scripts disabled:

```bash
npm install --ignore-scripts
npm run build:admin
npm run build:provider
```

Results:

- Admin build: successful.
- Provider build: successful.
- Provider build emitted existing Next.js warnings about the unsupported `eslint` key in `next.config.mjs`; compilation still succeeded.

## Route inventory files

Generated route inventory files are included under:

- `validation/v12/admin_route_files_v12.txt`
- `validation/v12/provider_route_files_v12.txt`
