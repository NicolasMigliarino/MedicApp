const fs = require('fs');
const path = require('path');

function generarReciboEfectivo(pacienteNombre, pacienteDni, profesionalNombre, fechaConsulta, monto, idPago, customFilename = null) {
    const filename = customFilename || `recibo_efectivo_${idPago}_${Date.now()}.html`;
    const filepath = path.join(__dirname, '../../uploads', filename);

    // Formatear fecha de pago
    const fechaPago = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

    const htmlContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <title>Recibo de Pago - MedCloud</title>
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 20px; }
            .receipt-box { max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0, 0, 0, 0.15); font-size: 16px; line-height: 24px; color: #555; }
            .title { font-size: 24px; font-weight: bold; color: #0f766e; text-align: center; margin-bottom: 20px; }
            .header-table, .details-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .header-table td { padding: 5px 0; }
            .details-table th, .details-table td { padding: 10px; border: 1px solid #ddd; text-align: left; }
            .details-table th { background-color: #f2f2f2; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 10px; }
            .total { font-size: 18px; font-weight: bold; color: #333; text-align: right; margin-top: 10px; }
        </style>
    </head>
    <body>
        <div class="receipt-box">
            <div class="title">🏥 MedCloud - Recibo de Pago</div>
            
            <table class="header-table">
                <tr>
                    <td><strong>Número de Recibo:</strong> #${idPago}</td>
                    <td style="text-align: right;"><strong>Fecha de Emisión:</strong> ${fechaPago}</td>
                </tr>
                <tr>
                    <td><strong>Paciente:</strong> ${pacienteNombre} (DNI: ${pacienteDni})</td>
                    <td style="text-align: right;"><strong>Método de Pago:</strong> Efectivo</td>
                </tr>
            </table>

            <table class="details-table">
                <thead>
                    <tr>
                        <th>Descripción</th>
                        <th>Profesional</th>
                        <th>Fecha Consulta</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Consulta Médica</td>
                        <td>${profesionalNombre}</td>
                        <td>${fechaConsulta}</td>
                        <td>$${monto.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>

            <div class="total">Total Cancelado: $${monto.toFixed(2)}</div>

            <div class="footer">
                MedCloud © 2026 - Sistema de Gestión Médica<br>
                Este documento es un comprobante de pago oficial emitido por caja.
            </div>
        </div>
    </body>
    </html>
    `;

    // Asegurar que la carpeta uploads existe
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    fs.writeFileSync(filepath, htmlContent, 'utf8');
    return `/uploads/${filename}`;
}

module.exports = { generarReciboEfectivo };
