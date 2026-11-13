import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { Maintenance } from '../maintenances/maintenance.entity';

export enum VehicleType { BOMBA = 'bomba', AMBULANCIA = 'ambulancia', RESCATE = 'rescate', PATRULLA = 'patrulla', OTRO = 'otro' }
export enum VehicleStatus { DISPONIBLE = 'disponible', EN_EMERGENCIA = 'en_emergencia', EN_MANTENCION = 'en_mantencion', FUERA_DE_SERVICIO = 'fuera_de_servicio' }

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) plate: string;
  @Column({ type: 'enum', enum: VehicleType, default: VehicleType.OTRO }) type: VehicleType;
  @Column() brand: string;
  @Column() model: string;
  @Column({ type: 'int' }) year: number;
  @Column({ nullable: true }) station: string; // compañía / unidad a la que pertenece
  @Column({ type: 'int', default: 0 }) mileage: number;
  @Column({ type: 'enum', enum: VehicleStatus, default: VehicleStatus.DISPONIBLE }) status: VehicleStatus;
  @OneToMany(() => Maintenance, (m) => m.vehicle) maintenances: Maintenance[];
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
