USE MedCloud;
GO

-- 1. Actualizar Check Constraint para permitir los estados 'Ausente' y 'No Asistio'
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Turnos_Estado')
BEGIN
    ALTER TABLE dbo.turnos DROP CONSTRAINT CK_Turnos_Estado;
END;
GO

ALTER TABLE dbo.turnos ADD CONSTRAINT CK_Turnos_Estado CHECK (estado IN ('Pendiente', 'Confirmado', 'Completado', 'Cancelado', 'Ausente', 'No Asistio'));
GO

-- 2. Stored Procedure para consultar el historial de asistencia del paciente
IF OBJECT_ID('dbo.sp_GetHistorialAsistenciaPaciente', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetHistorialAsistenciaPaciente;
GO

CREATE PROCEDURE dbo.sp_GetHistorialAsistenciaPaciente
    @paciente_id INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Resumen numérico y métricas de asistencia del paciente
    DECLARE @total_turnos INT = 0;
    DECLARE @total_asistidos INT = 0;
    DECLARE @total_ausentes INT = 0;
    DECLARE @total_cancelados INT = 0;
    DECLARE @total_pendientes INT = 0;
    DECLARE @tasa_asistencia DECIMAL(5,2) = 0.00;

    SELECT 
        @total_turnos = COUNT(*),
        @total_asistidos = SUM(CASE WHEN t.estado IN ('Completado', 'Confirmado') THEN 1 ELSE 0 END),
        @total_ausentes = SUM(CASE WHEN t.estado IN ('Ausente', 'No Asistio', 'No Asistió') THEN 1 ELSE 0 END),
        @total_cancelados = SUM(CASE WHEN t.estado = 'Cancelado' THEN 1 ELSE 0 END),
        @total_pendientes = SUM(CASE WHEN t.estado = 'Pendiente' THEN 1 ELSE 0 END)
    FROM dbo.turnos t
    WHERE t.paciente_id = @paciente_id;

    IF (@total_asistidos + @total_ausentes) > 0
    BEGIN
        SET @tasa_asistencia = CAST((@total_asistidos * 100.0) / (@total_asistidos + @total_ausentes) AS DECIMAL(5,2));
    END

    -- Dataset 1: Resumen de métricas
    SELECT 
        @paciente_id AS paciente_id,
        @total_turnos AS total_turnos,
        @total_asistidos AS total_asistidos,
        @total_ausentes AS total_ausentes,
        @total_cancelados AS total_cancelados,
        @total_pendientes AS total_pendientes,
        @tasa_asistencia AS tasa_asistencia;

    -- Dataset 2: Histórico cronológico de citas
    SELECT 
        t.id AS turno_id,
        t.fecha_hora_inicio,
        t.fecha_hora_fin,
        t.estado,
        t.motivo_consulta,
        t.observaciones_admin,
        pr.nombre + ' ' + pr.apellido AS profesional_nombre,
        pr.especialidad AS profesional_especialidad,
        p.monto_bruto,
        p.metodo_pago,
        p.comprobante_url
    FROM dbo.turnos t
    INNER JOIN dbo.profesionales pr ON t.profesional_id = pr.id
    LEFT JOIN dbo.pagos p ON t.id = p.turno_id
    WHERE t.paciente_id = @paciente_id
    ORDER BY t.fecha_hora_inicio DESC;
END;
GO
