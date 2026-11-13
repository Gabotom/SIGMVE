# SIGMVE

Sistema Inteligente de Gestión, Mantención y Disponibilidad de Vehículos de Emergencia.
Stack: NestJS · TypeORM · PostgreSQL (backend) · Angular 18 + Angular Material (frontend) · Docker.

```
sigmve/
├── backend/    API REST (NestJS)
├── frontend/   aplicación web (Angular)
├── scripts/    prueba de humo de la API
└── docker-compose.yml
```

## Puesta en marcha (desarrollo)
```bash
cp .env.example .env
docker compose up -d db          # solo la base de datos
cd backend
npm install
npm run start:dev                # API en http://localhost:3000/api
```
Swagger: http://localhost:3000/api/docs
Usuario inicial: `admin@sigmve.cl` / `Admin1234` (configurable en `.env`).

Frontend (otra terminal, con la API corriendo):
```bash
cd frontend
npm install
npm start                        # http://localhost:4200
```

Todo en contenedores: `docker compose up --build` → frontend en http://localhost:8080 (nginx redirige `/api` al backend).

> La API **no arranca sin `JWT_SECRET`**. Con `NODE_ENV=production` además exige un secreto de 32+ caracteres,
> una clave de admin distinta a la de ejemplo y desactiva `synchronize` (usar migraciones).

## Pruebas
```bash
cd backend && npm test                  # 92 pruebas unitarias (Jest)
bash scripts/smoke-test.sh              # prueba de humo, 75 verificaciones (API corriendo, desde la raíz)
bash scripts/smoke-test.sh 5            # solo un módulo (1 a 5)
cd frontend && npm test                 # pruebas unitarias del frontend (Karma)
cd frontend && npx playwright install chromium && npm run e2e   # prueba en navegador real, 27 verificaciones (API y npm start corriendo)
```

## Módulos y endpoints
| Módulo | Método | Ruta | Rol |
|---|---|---|---|
| 1 Auth | POST | /api/auth/login | público (limitado por IP) |
| | POST | /api/auth/register | admin |
| | GET | /api/auth/me | autenticado |
| | PATCH | /api/auth/password | autenticado (su propia clave) |
| 1 Usuarios | GET | /api/users, /api/users/:id | admin |
| | PATCH | /api/users/:id (nombre, rol, activar/desactivar) | admin |
| 2 Vehículos | GET | /api/vehicles?status&type&station&search, /api/vehicles/summary | autenticado |
| | POST/PATCH | /api/vehicles | admin, operator |
| | DELETE | /api/vehicles/:id (solo sin historial) | admin |
| 3 Mantenciones | GET | /api/maintenances?vehicleId&status&type, /api/maintenances/costs | autenticado |
| | POST/PATCH | /api/maintenances | admin, operator |
| | DELETE | /api/maintenances/:id | admin |
| 4 Incidencias | GET | /api/incidents?vehicleId&status&severity&open, /api/incidents/summary | autenticado |
| | POST | /api/incidents | admin, operator |
| | PATCH | /api/incidents/:id, /api/incidents/:id/status | admin, operator |
| | POST | /api/incidents/:id/maintenance (genera mantención correctiva) | admin, operator |
| | DELETE | /api/incidents/:id | admin |
| 5 Alertas | GET | /api/alerts?status&type&severity&vehicleId&all, /api/alerts/summary, /api/alerts/:id | autenticado |
| | PATCH | /api/alerts/:id/acknowledge (reconocer, con nota opcional) | admin, operator |
| | POST | /api/alerts/evaluate (forzar evaluación) | admin |

## Frontend
| Pantalla | Ruta | Qué permite |
|---|---|---|
| Login | /login | Inicio de sesión; la sesión se cierra sola si el token vence o el usuario es desactivado |
| Dashboard | /dashboard | Disponibilidad de la flota, incidencias abiertas, alertas prioritarias, próximas mantenciones y costos por vehículo |
| Vehículos | /vehiculos, /vehiculos/:id | Listado con filtros, alta/edición, cambio de estado y ficha con mantenciones, incidencias y alertas |
| Mantenciones | /mantenciones | Registro, cambio de estado (solo transiciones válidas) y corrección de costos |
| Incidencias | /incidencias | Reporte, cambio de estado con resolución y generación de mantención correctiva |
| Alertas | /alertas | Alertas vivas, sin reconocer e historial; reconocer con nota. Campana con contador en la barra superior |
| Usuarios | /usuarios | (Solo admin) alta, cambio de rol y activar/desactivar |
| Mi cuenta | /cuenta | Cambio de la propia contraseña |

Los botones de crear/editar solo aparecen para `admin` y `operator`; `viewer` solo consulta (la API igual valida cada permiso).

## Reglas de negocio
**Disponibilidad del vehículo** (centralizada en `VehicleStatusService`):
1. Con alguna mantención `en_proceso` → `en_mantencion`.
2. Si no, con alguna incidencia **crítica** abierta → `fuera_de_servicio`.
3. Sin bloqueos → vuelve a `disponible` (un `fuera_de_servicio` puesto a mano solo se libera al completar una mantención o cerrar la incidencia crítica).
4. `en_mantencion` nunca se asigna a mano, y no se puede marcar `disponible` un vehículo con bloqueos.

**Mantenciones:** `programada → en_proceso | completada | cancelada`, `en_proceso → completada | cancelada`. Completada y cancelada son finales (solo se corrige costo y descripción). Las canceladas no suman a costos.

**Incidencias:** `abierta → en_atencion | resuelta | descartada`, `en_atencion → abierta | resuelta | descartada`. Resolver o descartar exige texto de resolución y registra quién y cuándo.
Flujo integrado: incidencia → `POST /incidents/:id/maintenance` (queda `en_atencion`) → al completar la mantención la incidencia pasa sola a `resuelta`; si se cancela, vuelve a `abierta`.

**Alertas (Módulo 5):** un motor de reglas (`alerts/alert-rules.ts`, funciones puras) detecta:
| Tipo | Cuándo | Severidad |
|---|---|---|
| `mantencion_vencida` | mantención `programada` con fecha pasada | advertencia; crítica desde `ALERT_OVERDUE_CRITICAL_DAYS` días de atraso |
| `mantencion_proxima` | `programada` dentro de `ALERT_UPCOMING_DAYS` días | info |
| `incidencia_critica` | incidencia crítica `abierta` (sin mantención asignada) | crítica |
| `incidencia_sin_atender` | incidencia no crítica `abierta` hace más de `ALERT_INCIDENT_STALE_HOURS` | advertencia si es alta, si no info |
| `baja_disponibilidad` | % de la flota `disponible` bajo `ALERT_MIN_AVAILABILITY_PCT` | crítica |

Ciclo de vida: `activa → reconocida → resuelta`. *Reconocer* lo hace un usuario (queda quién, cuándo y una nota); *resolver* lo hace el sistema cuando la condición deja de cumplirse (p. ej. se inicia la mantención vencida). Si la severidad sube, una alerta reconocida vuelve a `activa`. Un índice único parcial garantiza una sola alerta viva por condición.
Se evalúa: al arrancar, cada `ALERTS_CRON` (por defecto cada 10 min) y al consultar si cambió algún vehículo, mantención o incidencia (un subscriber de TypeORM marca las alertas como desactualizadas, sin acoplar los otros módulos).

**Fechas:** "hoy" se calcula en `APP_TIMEZONE` (America/Santiago). Antes se usaba UTC y, después de las 21:00 en Chile, una mantención completada quedaba con fecha del día siguiente.

**Usuarios:** correos normalizados a minúsculas; clave de 8+ caracteres con letras y números; un usuario desactivado pierde el acceso de inmediato (el token se valida contra la BD); un admin no puede desactivarse ni quitarse el rol a sí mismo.

**Vehículos:** patente chilena validada (`ABCD-12` / `AB-1234`), única; el kilometraje no puede disminuir; un vehículo con historial no se elimina (se marca `fuera_de_servicio`).

## Flujo de trabajo Git
- Rama principal `main`; trabajo en `feature/<modulo>-<integrante>`.
- Commits con Conventional Commits: `feat(vehicles): agrega CRUD`, `fix(auth): ...`, `test(...)`, `docs(...)`.
- Todo cambio entra por Pull Request revisado por el otro integrante.
