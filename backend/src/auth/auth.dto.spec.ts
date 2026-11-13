import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto, RegisterDto } from './auth.dto';

const errorsOf = async (cls: any, body: object) => {
  const dto = plainToInstance(cls, body) as object;
  return { dto, props: (await validate(dto)).map((e) => e.property) };
};

describe('DTOs de autenticación', () => {
  it('normaliza el correo a minúsculas y sin espacios', async () => {
    const { dto, props } = await errorsOf(LoginDto, { email: '  Admin@SIGMVE.cl ', password: 'x' });
    expect(props).toEqual([]);
    expect((dto as LoginDto).email).toBe('admin@sigmve.cl');
  });

  it.each(['corta1', 'sololetras', '12345678'])('rechaza la contraseña débil "%s" al registrar', async (password) => {
    const { props } = await errorsOf(RegisterDto, { email: 'a@sigmve.cl', password, fullName: 'Juan Pérez', role: 'viewer' });
    expect(props).toContain('password');
  });

  it('acepta una contraseña con letras y números de 8+ caracteres', async () => {
    const { props } = await errorsOf(RegisterDto, { email: 'a@sigmve.cl', password: 'Clave123', fullName: 'Juan Pérez', role: 'viewer' });
    expect(props).toEqual([]);
  });
});
