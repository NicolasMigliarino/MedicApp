USE MedCloud;
GO

-- 1. Agregar columna comprobante_url a la tabla pagos
IF NOT EXISTS (
    SELECT * 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'pagos' AND COLUMN_NAME = 'comprobante_url'
)
BEGIN
    ALTER TABLE dbo.pagos ADD comprobante_url NVARCHAR(255) NULL;
END
GO

-- 2. Crear tabla pagos_profesional
IF OBJECT_ID('dbo.pagos_profesional', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.pagos_profesional (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        profesional_id INT NOT NULL,
        monto DECIMAL(10, 2) NOT NULL,
        fecha_pago DATETIME NOT NULL DEFAULT GETDATE(),
        fecha_desde DATE NOT NULL,
        fecha_hasta DATE NOT NULL,
        comprobante_url NVARCHAR(255) NULL,
        usuario_registro_id INT NOT NULL,
        CONSTRAINT FK_PagosProfesional_Profesionales FOREIGN KEY (profesional_id) REFERENCES dbo.profesionales(id),
        CONSTRAINT FK_PagosProfesional_Usuarios FOREIGN KEY (usuario_registro_id) REFERENCES dbo.usuarios(id)
    );
END
GO

-- 3. Crear o alterar Stored Procedure sp_GetHistorialPagosPaciente
IF OBJECT_ID('dbo.sp_GetHistorialPagosPaciente', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetHistorialPagosPaciente;
GO

CREATE PROCEDURE dbo.sp_GetHistorialPagosPaciente
    @paciente_id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        p.id AS pago_id,
        p.turno_id,
        t.fecha_hora_inicio AS fecha_consulta,
        prof.nombre + ' ' + prof.apellido AS profesional_nombre,
        p.monto_bruto,
        p.metodo_pago,
        p.fecha_pago,
        p.comprobante_url
    FROM dbo.pagos p
    INNER JOIN dbo.turnos t ON p.turno_id = t.id
    INNER JOIN dbo.profesionales prof ON t.profesional_id = prof.id
    WHERE t.paciente_id = @paciente_id
    ORDER BY p.fecha_pago DESC;
END;
GO

-- 4. Crear o alterar Stored Procedure sp_RegistrarPagoProfesional
IF OBJECT_ID('dbo.sp_RegistrarPagoProfesional', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_RegistrarPagoProfesional;
GO

CREATE PROCEDURE dbo.sp_RegistrarPagoProfesional
    @profesional_id INT,
    @monto DECIMAL(10,2),
    @fecha_desde DATE,
    @fecha_hasta DATE,
    @comprobante_url NVARCHAR(255) = NULL,
    @usuario_registro_id INT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO dbo.pagos_profesional (profesional_id, monto, fecha_pago, fecha_desde, fecha_hasta, comprobante_url, usuario_registro_id)
    VALUES (@profesional_id, @monto, GETDATE(), @fecha_desde, @fecha_hasta, @comprobante_url, @usuario_registro_id);
END;
GO

-- 5. Crear o alterar Stored Procedure sp_GetHistorialPagosProfesional
IF OBJECT_ID('dbo.sp_GetHistorialPagosProfesional', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetHistorialPagosProfesional;
GO

CREATE PROCEDURE dbo.sp_GetHistorialPagosProfesional
    @profesional_id INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 
        pp.id AS pago_id,
        pp.profesional_id,
        pp.monto,
        pp.fecha_pago,
        pp.fecha_desde,
        pp.fecha_hasta,
        pp.comprobante_url,
        u.username AS usuario_registro_nombre
    FROM dbo.pagos_profesional pp
    INNER JOIN dbo.usuarios u ON pp.usuario_registro_id = u.id
    WHERE pp.profesional_id = @profesional_id
    ORDER BY pp.fecha_pago DESC;
END;
GO

-- 6. Actualizar Stored Procedure sp_RegistrarPagoTurno para soportar comprobante_url
IF OBJECT_ID('dbo.sp_RegistrarPagoTurno', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_RegistrarPagoTurno;
GO

CREATE PROCEDURE [dbo].[sp_RegistrarPagoTurno]
    @turno_id INT,
    @monto DECIMAL(10, 2),
    @metodo_pago VARCHAR(50),
    @usuario_registro_id INT = 1,
    @comprobante_url NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRANSACTION;
    
    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.turnos WHERE id = @turno_id)
        BEGIN
            RAISERROR ('El turno no existe.', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END

        IF EXISTS (SELECT 1 FROM dbo.pagos WHERE turno_id = @turno_id)
        BEGIN
            RAISERROR ('Esta consulta ya fue cobrada previamente por caja.', 16, 1);
            ROLLBACK TRANSACTION;
            RETURN;
        END

        DECLARE @profesional_id INT;
        DECLARE @porcentaje_retencion DECIMAL(5,2);

        SELECT @profesional_id = profesional_id FROM dbo.turnos WHERE id = @turno_id;
        
        SELECT @porcentaje_retencion = porcentaje_retencion 
        FROM dbo.profesionales 
        WHERE id = @profesional_id;

        IF @porcentaje_retencion IS NULL SET @porcentaje_retencion = 20.00;

        DECLARE @caja_diaria_id INT = NULL;

        SELECT TOP 1 @caja_diaria_id = id 
        FROM dbo.caja_diaria 
        WHERE estado = 'Abierta' AND fecha = CAST(GETDATE() AS DATE)
        ORDER BY id DESC;

        INSERT INTO dbo.pagos (turno_id, caja_diaria_id, monto_bruto, porcentaje_retencion, metodo_pago, fecha_pago, usuario_registro_id, comprobante_url)
        VALUES (@turno_id, @caja_diaria_id, @monto, @porcentaje_retencion, @metodo_pago, GETDATE(), @usuario_registro_id, @comprobante_url);

        UPDATE dbo.turnos
        SET estado = 'Confirmado'
        WHERE id = @turno_id;

        COMMIT TRANSACTION;
        
        PRINT '✔️ Pago y Comisión registrados y turno Confirmado exitosamente.';
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR (@ErrorMessage, 16, 1);
    END CATCH
END;
GO
