import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { MaintenancesModule } from './maintenances/maintenances.module';
import { IncidentsModule } from './incidents/incidents.module';
import { AlertsModule } from './alerts/alerts.module';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController } from './health.controller';
import { validateEnv } from './common/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../.env'], validate: validateEnv }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        type: 'postgres',
        host: c.get('DB_HOST', 'localhost'),
        port: +c.get('DB_PORT', 5432),
        username: c.get('DB_USER', 'sigmve'),
        password: c.get('DB_PASSWORD', 'sigmve_pass'),
        database: c.get('DB_NAME', 'sigmve'),
        autoLoadEntities: true,
        synchronize: c.get('NODE_ENV') !== 'production', // en producción: migraciones versionadas
      }),
    }),
    UsersModule,
    AuthModule,
    VehiclesModule,
    MaintenancesModule,
    IncidentsModule,
    ScheduleModule.forRoot(),
    AlertsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
