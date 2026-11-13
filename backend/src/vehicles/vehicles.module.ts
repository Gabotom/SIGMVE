import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vehicle } from './vehicle.entity';
import { Maintenance } from '../maintenances/maintenance.entity';
import { Incident } from '../incidents/incident.entity';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehicleStatusService } from './vehicle-status.service';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle, Maintenance, Incident])],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehicleStatusService],
  exports: [VehiclesService, VehicleStatusService, TypeOrmModule],
})
export class VehiclesModule {}
