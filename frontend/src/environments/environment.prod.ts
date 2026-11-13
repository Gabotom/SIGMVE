/** Producción (Docker): nginx sirve el frontend y redirige /api al backend, así no hay CORS. */
export const environment = {
  production: true,
  apiUrl: '/api',
};
