const { chromium } = require('playwright');
/**
 * Prueba de punta a punta del frontend con un navegador real (Playwright).
 * Requisitos: API en :3000 y frontend en :4200 (npm start). Uso: npm run e2e
 * Recorre login, vehículos, mantenciones, alertas, incidencias, usuarios y permisos del rol viewer,
 * y deja capturas en e2e/capturas/ (sirven como evidencia).
 */
const path = require('path');
const fs = require('fs');
const BASE = process.env.FRONT_URL || 'http://localhost:4200';
const SHOTS = path.join(__dirname, 'capturas');
fs.mkdirSync(SHOTS, { recursive: true });
const L = 'BCDFGHJKLPRSTVWXYZ';
const n = Math.floor(Date.now() / 1000);
const PLATE = [0, 1, 2, 3].map((i) => L[Math.floor(n / 18 ** i) % 18]).join('') + '-77';
const fmt = (off) => { const d = new Date(Date.now() + off * 864e5); return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`; };
let ok = 0, fail = 0;
const check = (name, cond) => { console.log(`${cond ? '[OK]   ' : '[FALLA]'} ${name}`); cond ? ok++ : fail++; };

(async () => {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 860 }, locale: 'es-CL', timezoneId: 'America/Santiago' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  const snackHas = async (text) => {
    try { await page.locator(`mat-snack-bar-container:has-text("${text}")`).waitFor({ timeout: 8000 }); return true; }
    catch { const t = await page.locator('mat-snack-bar-container, .dialog-error').allTextContents(); console.log('   visto:', t.join(' | ')); return false; }
  };
  const visible = async (loc) => { try { await loc.first().waitFor({ state: 'visible', timeout: 6000 }); return true; } catch { return false; } };
  const shot = (name) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
  const settle = () => page.waitForLoadState('networkidle');

  // ── Login ──
  await page.goto(`${BASE}/vehiculos`);
  check('Sin sesión redirige al login', page.url().includes('/login'));
  await page.fill('input[formcontrolname=email]', process.env.ADMIN_EMAIL || 'admin@sigmve.cl');
  await page.fill('input[formcontrolname=password]', 'malaclave1');
  await page.click('button[type=submit]');
  check('Clave incorrecta muestra error', (await page.locator('.dialog-error').textContent({ timeout: 8000 })).includes('Credenciales inválidas'));
  await shot('01-login');
  await page.fill('input[formcontrolname=password]', process.env.ADMIN_PASSWORD || 'Admin1234');
  await page.click('button[type=submit]');
  await page.waitForURL('**/dashboard'); await settle();
  check('Login correcto entra al dashboard', page.url().endsWith('/dashboard'));
  check('Dashboard muestra KPI de vehículos', /\d+/.test(await page.locator('.kpi .value').first().textContent()));
  await shot('02-dashboard');

  // ── Vehículos ──
  await page.click('a:has-text("Vehículos")'); await settle();
  await page.click('button:has-text("Nuevo vehículo")');
  await page.fill('input[formcontrolname=plate]', 'MAL');
  await page.fill('input[formcontrolname=brand]', 'Renault');
  await page.fill('input[formcontrolname=model]', 'Master');
  await page.click('mat-dialog-container button[type=submit]');
  check('Patente inválida se marca en el formulario', await page.locator('mat-error:has-text("Formato")').isVisible());
  await page.fill('input[formcontrolname=plate]', PLATE.toLowerCase());
  await page.fill('input[formcontrolname=station]', 'Segunda Compañía');
  await page.fill('input[formcontrolname=mileage]', '15000');
  await page.click('mat-dialog-container button[type=submit]');
  check('Registrar vehículo', await snackHas(PLATE));
  await settle();
  await page.fill('input[placeholder="Patente, marca o modelo"]', PLATE);
  await page.waitForTimeout(800); await settle();
  check('Buscador filtra por patente', (await page.locator('tr.mat-mdc-row').count()) === 1);
  await shot('03-vehiculos');
  await page.click(`tr.mat-mdc-row:has-text("${PLATE}")`);
  await page.waitForURL('**/vehiculos/*'); await settle();
  check('Ficha del vehículo', (await page.locator('h1').textContent()).includes(PLATE));

  // ── Mantención vencida desde la ficha -> alerta ──
  await page.click('button:has-text("Nueva mantención")');
  await page.fill('textarea[formcontrolname=description]', 'Revisión de frenos');
  await page.fill('input[formcontrolname=scheduledDate]', fmt(-3));
  await page.locator('input[formcontrolname=scheduledDate]').blur();
  await page.fill('input[formcontrolname=cost]', '85000');
  await page.click('mat-dialog-container button[type=submit]');
  check('Registrar mantención con fecha escrita a mano (dd-MM-yyyy)', await snackHas('Mantención registrada'));
  await settle();
  await page.click('div[role=tab]:has-text("Alertas")');
  check('La ficha muestra la alerta de mantención vencida', await visible(page.locator('.row:has-text("mantención vencida hace 3 días")')));
  await shot('04-ficha-vehiculo');

  // ── Alertas: reconocer ──
  await page.click('a:has-text("Alertas")'); await settle();
  const card = page.locator(`.alert:has-text("${PLATE}: mantención vencida")`);
  await card.locator('button:has-text("Reconocer")').click();
  await page.fill('mat-dialog-container textarea', 'Taller agendado para el lunes');
  await page.click('mat-dialog-container button:has-text("Reconocer")');
  check('Reconocer alerta', await snackHas('reconocida'));
  await settle();
  check('Queda la nota y quién la reconoció', (await card.textContent()).includes('Taller agendado') && (await card.textContent()).includes('reconocida por'));
  await shot('05-alertas');

  // ── Incidencia crítica -> fuera de servicio -> mantención correctiva -> resuelta ──
  await page.goto(`${BASE}/vehiculos`); await settle();
  await page.fill('input[placeholder="Patente, marca o modelo"]', PLATE); await page.waitForTimeout(800); await settle();
  await page.click(`tr.mat-mdc-row:has-text("${PLATE}")`); await page.waitForURL('**/vehiculos/*'); await settle();
  await page.click('button:has-text("Reportar incidencia")');
  await page.fill('input[formcontrolname=title]', 'Falla en bomba de agua');
  await page.fill('textarea[formcontrolname=description]', 'La bomba no alcanza presión sobre 8 bar');
  await page.click('mat-select[formcontrolname=severity]'); await page.click('mat-option:has-text("Crítica")');
  await page.click('mat-dialog-container button[type=submit]');
  await page.waitForSelector('mat-dialog-container', { state: 'detached' }); await settle();
  check('Incidencia crítica deja el vehículo fuera de servicio', (await page.locator('h1 app-chip').textContent()).includes('Fuera de servicio'));
  await page.click('div[role=tab]:has-text("Incidencias")');
  await page.click('.row:has-text("Falla en bomba de agua")');
  await page.click('mat-button-toggle:has-text("Generar mantención")');
  await page.click('mat-dialog-container button:has-text("Crear mantención")');
  check('Generar mantención correctiva desde la incidencia', await snackHas('Incidencia actualizada'));
  await settle();
  await page.click('div[role=tab]:has-text("Mantenciones")');
  await page.click('.row:has-text("Incidencia: Falla en bomba de agua")');
  await page.click('mat-select[formcontrolname=status]'); await page.click('mat-option:has-text("En proceso")');
  await page.click('mat-dialog-container button[type=submit]'); await page.waitForSelector('mat-dialog-container', { state: 'detached' }); await settle();
  check('Mantención en proceso -> vehículo en mantención', (await page.locator('h1 app-chip').textContent()).includes('En mantención'));
  await page.click('div[role=tab]:has-text("Mantenciones")');
  await page.click('.row:has-text("Incidencia: Falla en bomba de agua")');
  await page.click('mat-select[formcontrolname=status]'); await page.click('mat-option:has-text("Completada")');
  await page.fill('input[formcontrolname=cost]', '150000');
  await page.click('mat-dialog-container button[type=submit]'); await page.waitForSelector('mat-dialog-container', { state: 'detached' }); await settle();
  // La mantención vencida sigue programada: el vehículo vuelve a disponible
  check('Al completar, el vehículo vuelve a disponible', (await page.locator('h1 app-chip').textContent()).includes('Disponible'));
  await page.click('div[role=tab]:has-text("Incidencias")');
  check('...y la incidencia queda resuelta', await visible(page.locator('.row:has-text("Falla en bomba de agua"):has-text("Resuelta")')));

  // ── Mantenciones (lista) ──
  await page.click('a:has-text("Mantenciones")'); await settle();
  check('Lista de mantenciones marca la vencida', await visible(page.locator(`tr:has-text("${PLATE}"):has-text("Vencida")`)));
  await shot('06-mantenciones');

  // ── Incidencias (lista) ──
  await page.click('a:has-text("Incidencias")'); await settle();
  await page.click('mat-slide-toggle button'); await settle();
  check('Lista de incidencias (con resueltas)', await visible(page.locator(`tr:has-text("${PLATE}")`)));
  await shot('07-incidencias');

  // ── Usuarios ──
  const viewer = `consulta${n}@sigmve.cl`;
  await page.click('a:has-text("Usuarios")'); await settle();
  await page.click('button:has-text("Nuevo usuario")');
  await page.fill('input[formcontrolname=fullName]', 'Usuario Consulta');
  await page.fill('input[formcontrolname=email]', viewer);
  await page.fill('input[formcontrolname=password]', 'Clave1234');
  await page.click('mat-select[formcontrolname=role]'); await page.click('mat-option:has-text("Consulta")');
  await page.click('mat-dialog-container button[type=submit]');
  check('Admin crea un usuario', await snackHas(viewer));
  await settle();
  await shot('08-usuarios');

  // ── Cuenta ──
  await page.click('button.user-btn'); await page.waitForTimeout(400);
  await page.getByRole('menuitem', { name: 'Cambiar contraseña' }).click(); await settle();
  await page.fill('input[formcontrolname=currentPassword]', 'mala1234');
  await page.fill('input[formcontrolname=newPassword]', 'Nueva1234');
  await page.fill('input[formcontrolname=confirm]', 'Nueva1234');
  await page.click('button[type=submit]');
  check('Clave actual incorrecta muestra error', await visible(page.locator('.dialog-error')));

  // ── Rol viewer ──
  await page.keyboard.press('Escape');
  await page.click('button.user-btn'); await page.waitForTimeout(400);
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await page.waitForURL('**/login');
  await page.fill('input[formcontrolname=email]', viewer);
  await page.fill('input[formcontrolname=password]', 'Clave1234');
  await page.click('button[type=submit]'); await page.waitForURL('**/dashboard'); await settle();
  check('Viewer no ve el menú Usuarios', !(await page.locator('a:has-text("Usuarios")').isVisible()));
  await page.goto(`${BASE}/usuarios`); await settle();
  check('Viewer que entra a /usuarios vuelve al dashboard', page.url().endsWith('/dashboard'));
  await page.goto(`${BASE}/vehiculos`); await settle();
  check('Viewer no ve "Nuevo vehículo"', !(await page.locator('button:has-text("Nuevo vehículo")').isVisible()));
  await page.goto(`${BASE}/alertas`); await settle();
  check('Viewer no ve "Reconocer"', (await page.locator('.alert button').count()) === 0);

  // ── Móvil ──
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/dashboard`); await settle();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check('Dashboard en móvil sin scroll horizontal', !overflow);
  await shot('09-dashboard-movil');

  const relevant = errors.filter((e) => !/Failed to load resource/.test(e));
  check(`Sin errores de JavaScript en la consola (${relevant.length})`, relevant.length === 0);
  if (relevant.length) console.log(relevant.slice(0, 5));
  console.log(`-- Resultado: ${ok} correctas, ${fail} con falla`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(2); });
