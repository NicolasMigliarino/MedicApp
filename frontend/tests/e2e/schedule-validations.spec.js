import { test, expect } from '@playwright/test';

// Helper para obtener un día específico de la semana en el año 2027
function getFutureDay(dayOfWeek) {
  const baseDate = new Date();
  baseDate.setFullYear(2027);
  baseDate.setMonth(Math.floor(Math.random() * 12));
  baseDate.setDate(1 + Math.floor(Math.random() * 28));
  while (baseDate.getDay() !== dayOfWeek) {
    baseDate.setDate(baseDate.getDate() + 1);
  }
  const pad = (n) => String(n).padStart(2, '0');
  const day = pad(baseDate.getDate());
  const month = pad(baseDate.getMonth() + 1);
  const year = baseDate.getFullYear();
  return { day, month, year };
}

test.describe('MedCloud - Validaciones de Horario de Atención y Agenda (Rol Yanina)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('Validar agenda de turnos restringida a la disponibilidad del profesional', async ({ page }) => {
    // 1. Iniciar sesión como Yanina (Administrativa)
    await page.goto('/login');
    await page.fill('input[name="username"]', 'Yanina');
    await page.fill('input[name="password"]', '123456');

    // Escuchar alerta nativa del navegador para el login
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.click('button[type="submit"]');

    // Esperar redirección al Dashboard
    await expect(page).toHaveURL('http://localhost:5173/');
    await expect(page.locator('strong:has-text("Bienvenido al panel de administración")')).toBeVisible();

    // 2. Crear un nuevo Profesional (Médico) que atienda SOLAMENTE los Martes de 09:00 a 18:00
    await page.goto('/profesionales/nuevo');

    const docDni = Math.floor(10000000 + Math.random() * 90000000).toString();
    const docName = 'DOC_HORARIO_' + docDni.slice(-4);
    const docLastName = 'FLOW';

    await page.fill('input[name="nombre"]', docName);
    await page.fill('input[name="apellido"]', docLastName);
    await page.fill('input[name="dni"]', docDni);
    await page.fill('input[name="matricula"]', 'MP-' + docDni.slice(0, 5));
    await page.fill('input[name="email"]', `doc_horario_${docDni}@medcloud.local`);
    
    // Esperar que las especialidades carguen
    await page.waitForFunction(() => document.querySelectorAll('select[name="especialidad_id"] option').length > 1);
    await page.selectOption('select[name="especialidad_id"]', { label: 'Odontología' });

    // Activar el checkbox de "Martes" haciendo clic en su slider estilizado
    const martesRow = page.locator('.schedule-day-row:has-text("Martes")');
    await martesRow.scrollIntoViewIfNeeded();
    await martesRow.locator('.modern-toggle-slider').click();

    // Comprobar que quedó checkeado
    await expect(martesRow.locator('input[type="checkbox"]')).toBeChecked();

    // Guardar Profesional
    await page.click('button[type="submit"]');

    // Esperar redirección al listado
    await page.waitForURL(url => url.pathname === '/profesionales');
    await page.locator('.mod-search-wrap input').fill(docName);
    await expect(page.locator('table')).toContainText(docName);

    // 3. Crear un nuevo Paciente
    await page.goto('/pacientes/nuevo');

    const pacDni = Math.floor(10000000 + Math.random() * 90000000).toString();
    const pacName = 'PAC_HORARIO_' + pacDni.slice(-4);
    const pacLastName = 'FLOW';

    await page.fill('input[name="nombre"]', pacName);
    await page.fill('input[name="apellido"]', pacLastName);
    await page.fill('input[name="dni"]', pacDni);
    await page.fill('input[placeholder="Selecciona la fecha..."]', '15/05/1995');
    await page.press('input[placeholder="Selecciona la fecha..."]', 'Enter');
    await page.fill('input[name="email"]', `paciente_horario_${pacDni}@example.com`);
    await page.fill('input[name="telefono"]', '11 5555-4444');

    await page.click('button[type="submit"]');

    // Esperar redirección al listado de pacientes
    await page.waitForURL(url => url.pathname === '/pacientes');
    await page.locator('.mod-search-wrap input').fill(pacDni);
    await expect(page.locator('table')).toContainText(pacName);

    // 4. Intentar agendar Turno
    await page.goto('/turnos/nuevo');

    // Esperar que los selectores carguen sus opciones desde la API
    await page.waitForFunction(() => document.querySelectorAll('select[name="paciente_id"] option').length > 1);
    await page.waitForFunction(() => document.querySelectorAll('select[name="profesional_id"] option').length > 1);

    // Seleccionar paciente
    const pacienteSelect = page.locator('select[name="paciente_id"]');
    await pacienteSelect.selectOption({ label: `${pacName} ${pacLastName} — DNI: ${pacDni}` });

    // Seleccionar profesional
    const profesionalSelect = page.locator('select[name="profesional_id"]');
    await profesionalSelect.selectOption({ label: `Dr. ${docName} ${docLastName} — Odontología` });

    const dateInput = page.locator('input[placeholder="Selecciona la fecha y hora..."]');

    // --- ESCENARIO A: Día no laborable (Miércoles) ---
    const wednesday = getFutureDay(3); // 3 = Miércoles
    const wednesdayDateString = `${wednesday.day}/${wednesday.month}/${wednesday.year} 10:00`;

    await dateInput.click();
    await dateInput.fill(wednesdayDateString);

    // Enter para confirmar fecha y disparar la validación
    const okBtn = page.locator('button:has-text("OK")');
    if (await okBtn.isVisible()) {
      await okBtn.click();
    } else {
      await page.press('input[placeholder="Selecciona la fecha y hora..."]', 'Enter');
    }

    // Esperar que se abra el SweetAlert indicando que no atiende los Miércoles
    const swalTitle = page.locator('.swal2-title');
    const swalText = page.locator('.swal2-html-container');
    await expect(swalTitle).toHaveText('Horario Inválido');
    await expect(swalText).toContainText('El profesional no atiende los Miércoles');

    // Cerrar SweetAlert
    await page.click('button.swal2-confirm');
    await expect(swalTitle).not.toBeVisible();

    // --- ESCENARIO B: Fuera del rango de horario de atención (Martes a las 08:00) ---
    const tuesday = getFutureDay(2); // 2 = Martes
    const invalidTuesdayDateString = `${tuesday.day}/${tuesday.month}/${tuesday.year} 08:00`;

    await dateInput.click();
    await dateInput.fill(invalidTuesdayDateString);
    if (await okBtn.isVisible()) {
      await okBtn.click();
    } else {
      await page.press('input[placeholder="Selecciona la fecha y hora..."]', 'Enter');
    }

    // Esperar SweetAlert indicando que atiende de 09:00 a 18:00
    await expect(swalTitle).toHaveText('Horario Inválido');
    await expect(swalText).toContainText('Fuera de horario');
    await expect(swalText).toContainText('atiende de 09:00 a 18:00');

    // Cerrar SweetAlert
    await page.click('button.swal2-confirm');
    await expect(swalTitle).not.toBeVisible();

    // --- ESCENARIO C: Éxito total (Martes a las 10:00 - horario válido) ---
    const validTuesdayDateString = `${tuesday.day}/${tuesday.month}/${tuesday.year} 10:00`;

    await dateInput.click();
    await dateInput.fill(validTuesdayDateString);
    if (await okBtn.isVisible()) {
      await okBtn.click();
    } else {
      await page.press('input[placeholder="Selecciona la fecha y hora..."]', 'Enter');
    }

    // Llenar motivo y observaciones
    await page.fill('input[name="motivo_consulta"]', 'CONSULTA CONTROL INTEGRAL');
    await page.fill('textarea[name="observaciones_admin"]', 'Prueba de horarios de Yanina.');

    // Guardar el turno
    await page.click('button[type="submit"]');

    // Redirección exitosa al listado de turnos
    await page.waitForURL(url => url.pathname === '/turnos');

    // Filtrar por nombre del paciente para asegurar que se muestre en la primera página
    await page.locator('.mod-search-wrap input').fill(pacName);

    // Validar presencia en la lista usando el nombre del nuevo paciente
    const turnosTable = page.locator('table');
    await expect(turnosTable).toContainText(pacName);
  });
});
