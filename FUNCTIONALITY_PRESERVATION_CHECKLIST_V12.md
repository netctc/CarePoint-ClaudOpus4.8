# Checklist de preservación funcional para rediseños CarePoint

Usar este checklist antes de modificar cualquier página Provider o Admin.

## Reglas obligatorias

- No reemplazar páginas funcionales por HTML/JSX estático.
- No convertir rutas funcionales en redirects salvo que exista una decisión documentada.
- No eliminar imports de API, loaders, server actions o client actions sin reemplazo funcional equivalente.
- No eliminar formularios, exportaciones, filtros o acciones de mutación.
- No mezclar módulos independientes si en V6 eran páginas separadas.
- No simplificar navegación eliminando rutas activas.

## Validación por página

Para cada pantalla:

1. Ruta original existe.
2. Layout nuevo se aplica sin romper la lógica.
3. Data loading original permanece.
4. Fallback mock/API permanece.
5. Formularios originales permanecen.
6. Botones de acción siguen ejecutando handlers reales.
7. Tablas siguen recibiendo datos dinámicos.
8. Navegación a detalles permanece.
9. Permisos/RBAC permanecen.
10. Estados loading/error/empty permanecen.
11. Build compila.

## Estrategia de avance

- V12: base V6 + capa compartida de diseño.
- V13: Provider login + shell + dashboard.
- V14: Provider queue + telehealth.
- V15: Provider patients + schedules + logout.
- V16: Admin login + shell + dashboard.
- V17: Admin providers + onboarding.
- V18: Admin catalog + RBAC.
- V19: Admin payments + refunds.
- V20: Admin audit + integrations + policy.
