import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  Alert, AlertSummary, Incident, IncidentSummary, Maintenance, User, Vehicle, VehicleCost, VehicleSummary,
} from './models';

type Query = Record<string, string | number | boolean | null | undefined>;

/** Convierte un objeto de filtros en query params, omitiendo los vacíos. */
function params(q: Query = {}) {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
  return p;
}

/**
 * Acceso a todos los endpoints de la API. Un solo servicio para que sea fácil ver
 * qué consume el frontend; el token lo agrega authInterceptor.
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private url = environment.apiUrl;

  // ── Vehículos ──
  vehicles(q?: Query) { return this.http.get<Vehicle[]>(`${this.url}/vehicles`, { params: params(q) }); }
  vehicle(id: string) { return this.http.get<Vehicle>(`${this.url}/vehicles/${id}`); }
  vehicleSummary() { return this.http.get<VehicleSummary>(`${this.url}/vehicles/summary`); }
  createVehicle(body: Partial<Vehicle>) { return this.http.post<Vehicle>(`${this.url}/vehicles`, body); }
  updateVehicle(id: string, body: Partial<Vehicle>) { return this.http.patch<Vehicle>(`${this.url}/vehicles/${id}`, body); }
  deleteVehicle(id: string) { return this.http.delete(`${this.url}/vehicles/${id}`); }

  // ── Mantenciones ──
  maintenances(q?: Query) { return this.http.get<Maintenance[]>(`${this.url}/maintenances`, { params: params(q) }); }
  createMaintenance(body: object) { return this.http.post<Maintenance>(`${this.url}/maintenances`, body); }
  updateMaintenance(id: string, body: object) { return this.http.patch<Maintenance>(`${this.url}/maintenances/${id}`, body); }
  deleteMaintenance(id: string) { return this.http.delete(`${this.url}/maintenances/${id}`); }
  costs() { return this.http.get<VehicleCost[]>(`${this.url}/maintenances/costs`); }

  // ── Incidencias ──
  incidents(q?: Query) { return this.http.get<Incident[]>(`${this.url}/incidents`, { params: params(q) }); }
  incident(id: string) { return this.http.get<Incident>(`${this.url}/incidents/${id}`); }
  incidentSummary() { return this.http.get<IncidentSummary>(`${this.url}/incidents/summary`); }
  createIncident(body: object) { return this.http.post<Incident>(`${this.url}/incidents`, body); }
  changeIncidentStatus(id: string, body: { status: string; resolution?: string }) {
    return this.http.patch<Incident>(`${this.url}/incidents/${id}/status`, body);
  }
  maintenanceFromIncident(id: string, body: { scheduledDate: string; description?: string }) {
    return this.http.post<Incident>(`${this.url}/incidents/${id}/maintenance`, body);
  }

  // ── Alertas ──
  alerts(q?: Query) { return this.http.get<Alert[]>(`${this.url}/alerts`, { params: params(q) }); }
  alertSummary() { return this.http.get<AlertSummary>(`${this.url}/alerts/summary`); }
  acknowledgeAlert(id: string, note?: string) { return this.http.patch<Alert>(`${this.url}/alerts/${id}/acknowledge`, note ? { note } : {}); }
  evaluateAlerts() { return this.http.post(`${this.url}/alerts/evaluate`, {}); }

  // ── Usuarios ──
  users() { return this.http.get<User[]>(`${this.url}/users`); }
  createUser(body: { email: string; password: string; fullName: string; role: string }) {
    return this.http.post<User>(`${this.url}/auth/register`, body);
  }
  updateUser(id: string, body: Partial<Pick<User, 'fullName' | 'role' | 'active'>>) {
    return this.http.patch<User>(`${this.url}/users/${id}`, body);
  }
  changePassword(currentPassword: string, newPassword: string) {
    return this.http.patch(`${this.url}/auth/password`, { currentPassword, newPassword });
  }
}
