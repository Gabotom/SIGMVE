# SIGMVE – Frontend

Angular 18 (componentes standalone, signals) + Angular Material. Consume la API de `../backend`.

```bash
npm install
npm start            # http://localhost:4200 (la API debe estar en http://localhost:3000)
npm test             # pruebas unitarias (Karma + Jasmine)
npm run build        # compilación de producción en dist/
npm run e2e          # prueba en navegador real (requiere API + npm start; antes: npx playwright install chromium)
```

## Estructura
```
src/app/
├── core/        api.service (todos los endpoints), auth (sesión, interceptor JWT, guards), modelos y etiquetas
├── layout/      menú lateral, barra superior y campana de alertas
├── shared/      etiquetas de estado, diálogo de confirmación, fechas en formato chileno
└── features/    login, dashboard, vehicles, maintenances, incidents, alerts, users, account
```

- La URL de la API está en `src/environments/environment.ts` (desarrollo) y `environment.prod.ts` (`/api`, detrás de nginx en Docker).
- Fechas, números y montos se muestran en formato chileno (`es-CL`); las fechas también se pueden escribir a mano como `10-11-2026`.
