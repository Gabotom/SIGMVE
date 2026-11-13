import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntitySubscriberInterface, InsertEvent, RemoveEvent, UpdateEvent } from 'typeorm';
import { Maintenance } from '../maintenances/maintenance.entity';
import { Incident } from '../incidents/incident.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { AlertsService } from './alerts.service';

const WATCHED = [Maintenance, Incident, Vehicle];

/**
 * Marca las alertas como desactualizadas cuando cambia un vehículo, una mantención o una incidencia.
 * Así los otros módulos no necesitan conocer al de alertas (no hay que tocar sus servicios).
 */
@Injectable()
export class AlertsInvalidationSubscriber implements EntitySubscriberInterface {
  constructor(@InjectDataSource() dataSource: DataSource, private alerts: AlertsService) {
    dataSource.subscribers.push(this);
  }

  private touch(target: unknown) {
    if (WATCHED.includes(target as any)) this.alerts.markStale();
  }

  afterInsert(e: InsertEvent<any>) { this.touch(e.metadata.target); }
  afterUpdate(e: UpdateEvent<any>) { this.touch(e.metadata.target); }
  afterRemove(e: RemoveEvent<any>) { this.touch(e.metadata.target); }
}
