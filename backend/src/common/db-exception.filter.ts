import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

/**
 * Traduce errores de PostgreSQL a respuestas HTTP con sentido en lugar de un 500 genérico.
 * Es una red de seguridad: los servicios igual validan antes de escribir.
 *  - 23505 unique_violation       -> 409 Conflict
 *  - 23503 foreign_key_violation  -> 409 Conflict (registro en uso)
 *  - 22P02 invalid_text_representation (uuid/enum mal formado) -> 400 Bad Request
 */
@Catch(QueryFailedError)
export class DbExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DbExceptionFilter.name);

  catch(exception: QueryFailedError & { code?: string; driverError?: { code?: string } }, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    const code = exception.driverError?.code ?? exception.code;
    const map: Record<string, [number, string]> = {
      '23505': [HttpStatus.CONFLICT, 'El registro ya existe'],
      '23503': [HttpStatus.CONFLICT, 'El registro está referenciado por otros datos'],
      '22P02': [HttpStatus.BAD_REQUEST, 'Valor con formato inválido'],
    };
    const [statusCode, message] = map[code ?? ''] ?? [HttpStatus.INTERNAL_SERVER_ERROR, 'Error interno del servidor'];
    if (statusCode === HttpStatus.INTERNAL_SERVER_ERROR) this.logger.error(exception.message, exception.stack);
    res.status(statusCode).json({ statusCode, message });
  }
}
