import { test, expect } from '@playwright/test';

test.describe('MedCloud - Flujos Administrativos E2E', () => {

  // Limpiar el almacenamiento antes de cada test para aislar sesiones
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('1. Autenticación exitosa y visualización de Dashboard para Administrador', async ({ page }) => {
    await page.goto('/login');

    // Llenar formulario de login
    await page.fill('input[name="username"]', 'admin_general');
    await page.fill('input[name="password"]', 'clave_super_secreta_123');

    // Escuchar alerta del navegador (el backend usa alert() en el login exitoso)
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('¡Hola de nuevo, admin_general!');
      await dialog.accept();
    });

    await page.click('button[type="submit"]');

    // Verificar que navega al Dashboard principal (URL raíz)
    await expect(page).toHaveURL('http://localhost:5173/');
    
    // Verificar elementos del Dashboard usando el banner de bienvenida robusto
    const welcomeBanner = page.locator('strong:has-text("Bienvenido al panel de administración")');
    await expect(welcomeBanner).toBeVisible();
  });

  test('2. Control de accesos en Sidebar (Admin vs Médico)', async ({ page }) => {
    // CASO A: Administrador general
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin_general');
    await page.fill('input[name="password"]', 'clave_super_secreta_123');
    page.once('dialog', async dialog => await dialog.accept());
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');

    // Comprobar que ve todas las secciones en el Sidebar (.sidebar contiene botones para cada sección)
    await expect(page.locator('.sidebar button:has-text("Pacientes")')).toBeVisible();
    await expect(page.locator('.sidebar button:has-text("Profesionales")')).toBeVisible();
    await expect(page.locator('.sidebar button:has-text("Turnos")')).toBeVisible();
    await expect(page.locator('.sidebar button:has-text("Usuarios")')).toBeVisible();
    await expect(page.locator('.sidebar button:has-text("Roles")')).toBeVisible();

    // Desconectarse limpiando el almacenamiento y yendo a una página limpia de login
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');

    // CASO B: Médico (doctor_nico)
    await page.fill('input[name="username"]', 'doctor_nico');
    await page.fill('input[name="password"]', 'claveSecreta123');
    page.once('dialog', async dialog => await dialog.accept());
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');

    // Comprobar que ve secciones básicas de atención
    await expect(page.locator('.sidebar button:has-text("Pacientes")')).toBeVisible();
    await expect(page.locator('.sidebar button:has-text("Turnos")')).toBeVisible();

    // Comprobar que NO ve las secciones administrativas restringidas (botones en sidebar)
    await expect(page.locator('.sidebar button:has-text("Profesionales")')).toHaveCount(0);
    await expect(page.locator('.sidebar button:has-text("Usuarios")')).toHaveCount(0);
    await expect(page.locator('.sidebar button:has-text("Roles")')).toHaveCount(0);
  });

  test('3. Creación de un Paciente por un Administrativo', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin_general');
    await page.fill('input[name="password"]', 'clave_super_secreta_123');
    page.once('dialog', async dialog => await dialog.accept());
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');
    await expect(page.locator('strong:has-text("Bienvenido al panel de administración")')).toBeVisible();

    // Navegar a nuevo paciente
    await page.goto('/pacientes/nuevo');

    const randDni = Math.floor(10000000 + Math.random() * 90000000).toString();

    // Rellenar formulario
    await page.fill('input[name="nombre"]', 'TEST_PLAYWRIGHT');
    await page.fill('input[name="apellido"]', 'ADMIN_FLOW');
    await page.fill('input[name="dni"]', randDni);
    await page.fill('input[placeholder="Selecciona la fecha..."]', '12/10/1992');
    await page.press('input[placeholder="Selecciona la fecha..."]', 'Enter');
    await page.fill('input[name="email"]', `playwright_test_${randDni}@example.com`);
    await page.fill('input[name="telefono"]', '11 9999-8888');
    
    // Guardar
    await page.click('button[type="submit"]');

    // Esperar redirección exacta al listado (utilizando función de callback para evitar falsos positivos con glob)
    await page.waitForURL(url => url.pathname === '/pacientes');

    // Filtrar por DNI para asegurar que se muestre en la primera página
    await page.locator('.mod-search-wrap input').fill(randDni);

    // Verificar presencia del nuevo paciente en la tabla con auto-wait
    const table = page.locator('table');
    await expect(table).toContainText('TEST_PLAYWRIGHT');
    await expect(table).toContainText('ADMIN_FLOW');
    await expect(table).toContainText(randDni);
  });

  test('4. Creación de un Turno de atención', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[name="username"]', 'admin_general');
    await page.fill('input[name="password"]', 'clave_super_secreta_123');
    page.once('dialog', async dialog => await dialog.accept());
    await page.click('button[type="submit"]');
    await page.waitForURL('http://localhost:5173/');
    await expect(page.locator('strong:has-text("Bienvenido al panel de administración")')).toBeVisible();

    // Navegar a agendar turno
    await page.goto('/turnos/nuevo');

    // Esperar que los selectores carguen sus opciones desde la API
    await page.waitForFunction(() => document.querySelectorAll('select[name="paciente_id"] option').length > 1);
    await page.waitForFunction(() => document.querySelectorAll('select[name="profesional_id"] option').length > 1);

    // Seleccionar el primer paciente disponible y guardar su nombre para aserción
    const pacienteSelect = page.locator('select[name="paciente_id"]');
    const firstPacienteOption = await pacienteSelect.locator('option').nth(1).getAttribute('value');
    if (firstPacienteOption) {
      await pacienteSelect.selectOption(firstPacienteOption);
    } else {
      throw new Error("No hay pacientes disponibles para agendar un turno");
    }
    const pacienteText = await pacienteSelect.locator('option').nth(1).textContent();
    const pacienteName = pacienteText.split(' — ')[0].trim();

    // Seleccionar el primer profesional disponible
    const profesionalSelect = page.locator('select[name="profesional_id"]');
    const firstProfesionalOption = await profesionalSelect.locator('option').nth(1).getAttribute('value');
    if (firstProfesionalOption) {
      await profesionalSelect.selectOption(firstProfesionalOption);
    } else {
      throw new Error("No hay profesionales disponibles para agendar un turno");
    }

    // Esperar a que se carguen los horarios (si los hay)
    await page.waitForTimeout(1000);

    // Encontrar un Lunes futuro en el año 2027 para evitar conflictos de doble reserva y días no laborables
    const baseDate = new Date();
    baseDate.setFullYear(2027);
    baseDate.setMonth(Math.floor(Math.random() * 12));
    baseDate.setDate(1 + Math.floor(Math.random() * 28));
    while (baseDate.getDay() !== 1) { // 1 = Lunes
      baseDate.setDate(baseDate.getDate() + 1);
    }
    const pad = (n) => String(n).padStart(2, '0');
    const day = pad(baseDate.getDate());
    const month = pad(baseDate.getMonth() + 1);
    const year = baseDate.getFullYear();
    const hour = pad(9 + Math.floor(Math.random() * 7)); // De 09:00 a 16:00
    const minute = ['00', '15', '30', '45'][Math.floor(Math.random() * 4)];
    const randomFutureDate = `${day}/${month}/${year} ${hour}:${minute}`;

    const dateInput = page.locator('input[placeholder="Selecciona la fecha y hora..."]');
    await dateInput.fill(randomFutureDate);
    
    // Hacer clic en el botón OK del DatePicker para confirmar
    const okButton = page.locator('button:has-text("OK")');
    if (await okButton.isVisible()) {
      await okButton.click();
    } else {
      await page.press('input[placeholder="Selecciona la fecha y hora..."]', 'Enter');
    }

    await page.fill('input[name="motivo_consulta"]', 'TEST AUTOMATIZADO PLAYWRIGHT');
    await page.fill('textarea[name="observaciones_admin"]', 'Generado automáticamente para verificar flujo de Administrativo.');

    // Enviar
    await page.click('button[type="submit"]');

    // Esperar redirección exacta a agenda de turnos
    await page.waitForURL(url => url.pathname === '/turnos');

    // Filtrar por nombre del paciente para asegurar que se muestre en la primera página
    await page.locator('.mod-search-wrap input').fill(pacienteName);

    // Comprobar éxito con auto-wait en la tabla usando el nombre del paciente
    const table = page.locator('table');
    await expect(table).toContainText(pacienteName);
  });

});
