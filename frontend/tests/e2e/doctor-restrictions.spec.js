import { test, expect } from '@playwright/test';

test.describe('MedCloud - Restricciones del Rol Médico (doctor_nico)', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
  });

  test('Validar que el médico no vea botones de Crear, Editar ni Eliminar Pacientes', async ({ page }) => {
    // 1. Iniciar sesión como el Médico (doctor_nico)
    await page.goto('/login');
    await page.fill('input[name="username"]', 'doctor_nico');
    await page.fill('input[name="password"]', 'claveSecreta123');

    // Aceptar diálogo de login
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.click('button[type="submit"]');

    // Esperar redirección al Dashboard y asentamiento
    await expect(page).toHaveURL('http://localhost:5173/');
    await expect(page.locator('strong:has-text("Bienvenido al panel de administración")')).toBeVisible();

    // 2. Navegar al listado de Pacientes
    await page.goto('/pacientes');
    await expect(page.locator('table')).toBeVisible();

    // 3. Comprobar que el botón "Nuevo Paciente" NO esté visible en el encabezado
    const newPacienteBtn = page.locator('.mod-btn-add:has-text("Nuevo Paciente")');
    await expect(newPacienteBtn).not.toBeVisible();

    // 4. Comprobar que los botones de "Editar" y "Eliminar" estén ocultos en las acciones de la tabla
    const editBtn = page.locator('tbody .mod-btn.edit');
    const deleteBtn = page.locator('tbody .mod-btn.delete');
    
    await expect(editBtn).not.toBeVisible();
    await expect(deleteBtn).not.toBeVisible();

    // 5. Comprobar que sí ve el botón "Historial" (si hay pacientes listados en la tabla)
    const viewHistorialBtn = page.locator('.mod-btn.view');
    if (await viewHistorialBtn.count() > 0) {
      await expect(viewHistorialBtn.first()).toBeVisible();
      await expect(viewHistorialBtn.first()).toContainText('Historial');
    }
  });
});
