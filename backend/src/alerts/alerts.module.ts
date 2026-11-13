import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from './alert.entity';
import { Maintenance } from '../maintenances/maintenance.entity';
import { Incident } from '../incidents/incident.entity';
import { Vehicle } from '../vehicles/vehicle.entity';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertsScheduler } from './alerts.scheduler';
import { AlertsInvalidationSubscriber } from './alerts-invalidation.subscriber';

@Module({
  imports: [TypeOrmModule.forFeature([Alert, Maintenance, Incident, Vehicle])],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsScheduler, AlertsInvalidationSubscriber],
  exports: [AlertsService],
})
export class AlertsModule {}
