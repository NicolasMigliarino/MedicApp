/* =========================================================================
   ARCHIVO: src/db.js
   DESCRIPCIÓN: Conexión estándar con Usuario y Contraseña.
   Esta es la forma más compatible y estable.
   ========================================================================= */
const sql = require('mssql');

const dbSettings = {
    server: process.env.DB_HOST || process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'MedCloud',
    user: process.env.DB_USER || 'medcloud_user',
    password: process.env.DB_PASSWORD || 'MedCloud123',
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: true
    }
};

let poolPromise = null;
let migracionesRealizadas = false;

async function getConnection() {
    if (!poolPromise) {
        poolPromise = (async () => {
            try {
                const pool = await sql.connect(dbSettings);
                if (!migracionesRealizadas) {
                    migracionesRealizadas = true;
                    try {
                        // 1. Crear tablas, columnas y claves foráneas
                        await pool.request().query(`
                            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.turnos') AND name = 'recordatorio_dia_anterior_enviado')
                            BEGIN
                                ALTER TABLE dbo.turnos ADD recordatorio_dia_anterior_enviado BIT NOT NULL DEFAULT 0;
                            END

                             IF OBJECT_ID('dbo.envios_agenda_medica', 'U') IS NULL
                            BEGIN
                                CREATE TABLE dbo.envios_agenda_medica (
                                    id INT IDENTITY(1,1) PRIMARY KEY,
                                    profesional_id INT NOT NULL,
                                    fecha_agenda DATE NOT NULL,
                                    fecha_envio DATETIME NOT NULL DEFAULT GETDATE(),
                                    CONSTRAINT FK_EnviosAgenda_Profesionales FOREIGN KEY (profesional_id) REFERENCES dbo.profesionales(id) ON DELETE CASCADE
                                );
                            END

                            -- Crear tabla especialidades si no existe
                            IF OBJECT_ID('dbo.especialidades', 'U') IS NULL
                            BEGIN
                                CREATE TABLE dbo.especialidades (
                                    id INT IDENTITY(1,1) PRIMARY KEY,
                                    nombre NVARCHAR(100) NOT NULL UNIQUE
                                );
                            END

                            -- Insertar valores precargados estándar si está vacía
                            IF NOT EXISTS (SELECT 1 FROM dbo.especialidades)
                            BEGIN
                                INSERT INTO dbo.especialidades (nombre) VALUES
                                (N'Clínica Médica'),
                                (N'Pediatría'),
                                (N'Ginecología y Obstetricia'),
                                (N'Cardiología'),
                                (N'Psicología'),
                                (N'Kinesiología'),
                                (N'Psiquiatría'),
                                (N'Dermatología'),
                                (N'Oftalmología'),
                                (N'Traumatología'),
                                (N'Nutrición'),
                                (N'Odontología');
                            END

                            -- Agregar columna especialidad_id a profesionales si no existe y FK
                            IF NOT EXISTS (
                                SELECT * 
                                FROM INFORMATION_SCHEMA.COLUMNS 
                                WHERE TABLE_NAME = 'profesionales' AND COLUMN_NAME = 'especialidad_id'
                            )
                            BEGIN
                                ALTER TABLE dbo.profesionales ADD especialidad_id INT NULL;
                                
                                ALTER TABLE dbo.profesionales 
                                ADD CONSTRAINT FK_Profesionales_Especialidades FOREIGN KEY (especialidad_id) REFERENCES dbo.especialidades(id);
                            END

                            -- Agregar columna email a profesionales si no existe
                            IF NOT EXISTS (
                                SELECT * 
                                FROM INFORMATION_SCHEMA.COLUMNS 
                                WHERE TABLE_NAME = 'profesionales' AND COLUMN_NAME = 'email'
                            )
                            BEGIN
                                ALTER TABLE dbo.profesionales ADD email NVARCHAR(100) NULL;
                            END

                            -- Sincronizar correos existentes desde usuarios a profesionales
                            IF EXISTS (
                                SELECT 1 
                                FROM INFORMATION_SCHEMA.COLUMNS 
                                WHERE TABLE_NAME = 'profesionales' AND COLUMN_NAME = 'email'
                            )
                            BEGIN
                                EXEC('
                                    UPDATE pr
                                    SET pr.email = u.email
                                    FROM dbo.profesionales pr
                                    INNER JOIN dbo.usuarios u ON pr.usuario_id = u.id
                                    WHERE pr.email IS NULL AND u.email IS NOT NULL AND u.email NOT LIKE ''%@medcloud.local'';
                                ');
                            END
                        `);

                        // 2. Migración de datos existentes (mapeo texto a ID)
                        await pool.request().query(`
                            IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'profesionales' AND COLUMN_NAME = 'especialidad_id')
                            BEGIN
                                IF EXISTS (SELECT 1 FROM dbo.profesionales WHERE especialidad_id IS NULL AND especialidad IS NOT NULL AND RTRIM(LTRIM(especialidad)) <> '')
                                BEGIN
                                    DECLARE @CurID INT;
                                    DECLARE @CurEsp NVARCHAR(100);

                                    DECLARE mig_cursor CURSOR LOCAL FOR 
                                    SELECT id, especialidad 
                                    FROM dbo.profesionales 
                                    WHERE especialidad_id IS NULL AND especialidad IS NOT NULL AND RTRIM(LTRIM(especialidad)) <> '';

                                    OPEN mig_cursor;
                                    FETCH NEXT FROM mig_cursor INTO @CurID, @CurEsp;

                                    WHILE @@FETCH_STATUS = 0
                                    BEGIN
                                        DECLARE @MatchID INT = NULL;
                                        
                                        SELECT @MatchID = id 
                                        FROM dbo.especialidades 
                                        WHERE LOWER(nombre) = LOWER(RTRIM(LTRIM(@CurEsp)));
                                        
                                        IF @MatchID IS NULL
                                        BEGIN
                                            INSERT INTO dbo.especialidades (nombre) VALUES (RTRIM(LTRIM(@CurEsp)));
                                            SET @MatchID = SCOPE_IDENTITY();
                                        END
                                        
                                        UPDATE dbo.profesionales 
                                        SET especialidad_id = @MatchID 
                                        WHERE id = @CurID;

                                        FETCH NEXT FROM mig_cursor INTO @CurID, @CurEsp;
                                    END;

                                    CLOSE mig_cursor;
                                    DEALLOCATE mig_cursor;
                                END
                            END
                        `);


                        await pool.request().query(`
                            ALTER PROCEDURE [dbo].[sp_GetTurnos]
                                @UsuarioID INT,
                                @RolCodigo NVARCHAR(20)
                            AS
                            BEGIN
                                SET NOCOUNT ON;

                                UPDATE Turnos
                                SET estado = 'Completado'
                                WHERE estado = 'Confirmado' 
                                  AND fecha_hora_fin <= GETDATE();

                                DECLARE @ProfesionalID INT = NULL;

                                IF @RolCodigo = 'MEDICO' 
                                BEGIN
                                    SELECT @ProfesionalID = id 
                                    FROM Profesionales 
                                    WHERE usuario_id = @UsuarioID;
                                END

                                SELECT 
                                    t.id, t.paciente_id, t.profesional_id, t.fecha_hora_inicio, t.fecha_hora_fin, t.estado, t.motivo_consulta, t.observaciones_admin,
                                    t.recordatorio_dia_anterior_enviado AS recordatorio_enviado,
                                    pr.nombre AS profesional_nombre, pr.apellido AS profesional_apellido,
                                    p.nombre AS paciente_nombre, p.apellido AS paciente_apellido,
                                    pg.comprobante_url
                                FROM Turnos t
                                INNER JOIN Profesionales pr ON t.profesional_id = pr.id
                                INNER JOIN Pacientes p ON t.paciente_id = p.id
                                LEFT JOIN Pagos pg ON t.id = pg.turno_id
                                WHERE 
                                    (@RolCodigo <> 'MEDICO' OR t.profesional_id = @ProfesionalID)
                                ORDER BY t.fecha_hora_inicio DESC;
                            END;
                        `);

                        await pool.request().query(`
                            ALTER PROCEDURE [dbo].[sp_GetUsuarios]
                            AS
                            BEGIN
                                SET NOCOUNT ON;
                                SELECT 
                                    u.id, 
                                    u.email, 
                                    u.password_hash, 
                                    u.rol_id, 
                                    u.activo, 
                                    u.fecha_creacion, 
                                    u.username, 
                                    u.debe_cambiar_pass,
                                    pr.nombre AS profesional_nombre,
                                    pr.apellido AS profesional_apellido
                                FROM Usuarios u
                                LEFT JOIN Profesionales pr ON pr.usuario_id = u.id;
                            END;
                        `);

                        await pool.request().query(`
                            ALTER PROCEDURE [dbo].[sp_SetUsuario]
                                @id INT,
                                @email NVARCHAR(100),
                                @passwordHash NVARCHAR(255) = NULL,
                                @rolId INT,
                                @activo BIT,
                                @username VARCHAR(100),
                                @debeCambiarPass BIT
                            AS
                            BEGIN
                                SET NOCOUNT ON;
                                UPDATE Usuarios
                                SET email = @email,
                                    password_hash = CASE WHEN @passwordHash IS NULL OR @passwordHash = '' THEN password_hash ELSE @passwordHash END,
                                    rol_id = @rolId,
                                    activo = @activo,
                                    username = @username,
                                    debe_cambiar_pass = @debeCambiarPass
                                WHERE id = @id;
                            END;
                        `);

                        await pool.request().query(`
                            ALTER PROCEDURE [dbo].[sp_GetProfesionales]
                            AS
                            BEGIN
                                SET NOCOUNT ON;
                                SELECT 
                                    pr.id,
                                    pr.usuario_id,
                                    pr.nombre,
                                    pr.apellido,
                                    pr.matricula,
                                    pr.especialidad_id,
                                    pr.email,
                                    pr.telefono,
                                    pr.duracion_turno_promedio,
                                    pr.porcentaje_retencion,
                                    pr.tipo_matricula,
                                    pr.cuit_cuil,
                                    pr.fecha_nacimiento,
                                    pr.sexo,
                                    COALESCE(esp.nombre, pr.especialidad) AS especialidad
                                FROM profesionales pr
                                LEFT JOIN especialidades esp ON pr.especialidad_id = esp.id;
                            END;
                        `);

                        await pool.request().query(`
                            ALTER PROCEDURE [dbo].[sp_GetProfesional]
                                @id INT
                            AS
                            BEGIN
                                SET NOCOUNT ON;
                                SELECT 
                                    pr.id,
                                    pr.usuario_id,
                                    pr.nombre,
                                    pr.apellido,
                                    pr.matricula,
                                    pr.especialidad_id,
                                    pr.email,
                                    pr.telefono,
                                    pr.duracion_turno_promedio,
                                    pr.porcentaje_retencion,
                                    pr.tipo_matricula,
                                    pr.cuit_cuil,
                                    pr.fecha_nacimiento,
                                    pr.sexo,
                                    COALESCE(esp.nombre, pr.especialidad) AS especialidad
                                FROM profesionales pr
                                LEFT JOIN especialidades esp ON pr.especialidad_id = esp.id
                                WHERE pr.id = @id;
                            END;
                        `);

                        await pool.request().query(`
                            ALTER PROCEDURE [dbo].[sp_CreateProfesional]
                                @Nombre NVARCHAR(100),
                                @Apellido NVARCHAR(100),
                                @DNI NVARCHAR(20),       
                                @Matricula NVARCHAR(50),
                                @EspecialidadID INT,
                                @Telefono NVARCHAR(50),
                                @duracionTurnoPromedio INT,
                                @RolID INT = 5,
                                @HorariosJSON NVARCHAR(MAX) = NULL,
                                @PorcentajeRetencion DECIMAL(5,2) = 20.00,
                                @TipoMatricula NVARCHAR(20) = NULL,
                                @CuitCuil NVARCHAR(20) = NULL,
                                @fecha_nacimiento DATE = NULL,
                                @sexo NVARCHAR(50) = NULL,
                                @Email NVARCHAR(100) = NULL
                            AS
                            BEGIN
                                SET NOCOUNT ON;
                                
                                BEGIN TRY
                                    BEGIN TRANSACTION;

                                    DECLARE @NuevoUsuarioID INT;
                                    DECLARE @NuevoProfesionalID INT; 
                                    DECLARE @UsuarioBase VARCHAR(50);
                                    DECLARE @UsuarioFinal VARCHAR(50);
                                    DECLARE @Contador INT = 0;
                                    DECLARE @PasswordProvisoria NVARCHAR(255);
                                    DECLARE @EmailGenerado NVARCHAR(100); 

                                    -- Lógica para generar usuario único
                                    SET @UsuarioBase = LOWER(SUBSTRING(@Nombre, 1, 1) + @Apellido);
                                    SET @UsuarioFinal = @UsuarioBase;

                                    -- Loop para encontrar un usuario libre
                                    WHILE EXISTS (SELECT 1 FROM dbo.usuarios WHERE username = @UsuarioFinal)
                                    BEGIN
                                        SET @Contador = @Contador + 1;
                                        SET @UsuarioFinal = @UsuarioBase + CAST(@Contador AS VARCHAR(5));
                                    END

                                    -- Generamos un email ficticio y password temporal
                                    SET @EmailGenerado = COALESCE(@Email, @UsuarioFinal + '@medcloud.local');
                                    SET @PasswordProvisoria = @DNI; 

                                    -- 1. Insertamos en la tabla PADRE (Usuarios)
                                    INSERT INTO dbo.usuarios (email, password_hash, rol_id, activo, fecha_creacion, username, debe_cambiar_pass)
                                    VALUES (@EmailGenerado, @PasswordProvisoria, @RolID, 1, GETDATE(), @UsuarioFinal, 1);

                                    -- Recuperamos el ID del usuario
                                    SET @NuevoUsuarioID = SCOPE_IDENTITY();

                                    -- Obtener el nombre de la especialidad para sincronización
                                    DECLARE @EspecialidadText NVARCHAR(100) = (SELECT nombre FROM dbo.especialidades WHERE id = @EspecialidadID);

                                    -- 2. Insertamos en la tabla HIJA (Profesionales)
                                    INSERT INTO dbo.profesionales(usuario_id, nombre, apellido, matricula, especialidad, especialidad_id, email, telefono, duracion_turno_promedio, porcentaje_retencion, tipo_matricula, cuit_cuil, fecha_nacimiento, sexo)
                                    VALUES (@NuevoUsuarioID, @Nombre, @Apellido, @Matricula, @EspecialidadText, @EspecialidadID, @Email, @Telefono, @duracionTurnoPromedio, @PorcentajeRetencion, @TipoMatricula, @CuitCuil, @fecha_nacimiento, @sexo);

                                    -- Recuperamos el ID del PROFESIONAL recién creado
                                    SET @NuevoProfesionalID = SCOPE_IDENTITY();

                                    -- 3. Lógica para insertar horarios
                                    IF @HorariosJSON IS NOT NULL AND ISJSON(@HorariosJSON) = 1
                                    BEGIN
                                        INSERT INTO dbo.horarios_profesional (profesional_id, dia_semana, hora_inicio, hora_fin)
                                        SELECT 
                                            @NuevoProfesionalID, 
                                            dia_semana, 
                                            hora_inicio, 
                                            hora_fin
                                        FROM OPENJSON(@HorariosJSON)
                                        WITH (
                                            dia_semana VARCHAR(20) '$.dia_semana',
                                            hora_inicio TIME '$.hora_inicio',
                                            hora_fin TIME '$.hora_fin'
                                        );
                                    END

                                    COMMIT TRANSACTION;
                                END TRY
                                BEGIN CATCH
                                    IF @@TRANCOUNT > 0
                                        ROLLBACK TRANSACTION;

                                    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
                                    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
                                    DECLARE @ErrorState INT = ERROR_STATE();

                                    RAISERROR (@ErrorMessage, @ErrorSeverity, @ErrorState);
                                END CATCH
                            END;
                        `);

                        await pool.request().query(`
                            ALTER PROCEDURE [dbo].[sp_SetProfesional]
                                @id INT,
                                @nombre NVARCHAR(100),
                                @apellido NVARCHAR(100),
                                @matricula NVARCHAR(50),
                                @EspecialidadID INT,
                                @telefono NVARCHAR(50),
                                @duracionTurnoPromedio INT,
                                @porcentajeRetencion DECIMAL(5,2) = 20.00,
                                @tipoMatricula NVARCHAR(20) = NULL,
                                @cuitCuil NVARCHAR(20) = NULL,
                                @fecha_nacimiento DATE = NULL,
                                @sexo NVARCHAR(50) = NULL,
                                @Email NVARCHAR(100) = NULL
                            AS
                            BEGIN
                                SET NOCOUNT ON;

                                DECLARE @EspecialidadText NVARCHAR(100) = (SELECT nombre FROM dbo.especialidades WHERE id = @EspecialidadID);

                                UPDATE profesionales
                                SET nombre = @nombre,
                                    apellido = @apellido,
                                    matricula = @matricula,
                                    especialidad = @EspecialidadText,
                                    especialidad_id = @EspecialidadID,
                                    email = @Email,
                                    telefono = @telefono,
                                    duracion_turno_promedio = @duracionTurnoPromedio,
                                    porcentaje_retencion = @porcentajeRetencion,
                                    tipo_matricula = @tipoMatricula,
                                    cuit_cuil = @cuitCuil,
                                    fecha_nacimiento = @fecha_nacimiento,
                                    sexo = @sexo
                                WHERE id = @id;

                                -- Sincronizar email del usuario asociado para inicio de sesión
                                UPDATE dbo.usuarios
                                SET email = @Email
                                WHERE id = (SELECT usuario_id FROM dbo.profesionales WHERE id = @id)
                                  AND @Email IS NOT NULL AND RTRIM(LTRIM(@Email)) <> '';
                            END;
                        `);

                        await pool.request().query(`
                            IF OBJECT_ID('sp_GetEspecialidades', 'P') IS NULL
                            BEGIN
                                EXEC('CREATE PROCEDURE sp_GetEspecialidades AS BEGIN SET NOCOUNT ON; SELECT 1; END;');
                            END
                        `);

                        await pool.request().query(`
                            ALTER PROCEDURE [dbo].[sp_GetEspecialidades]
                            AS
                            BEGIN
                                SET NOCOUNT ON;
                                SELECT id, nombre 
                                FROM dbo.especialidades 
                                ORDER BY nombre ASC;
                            END;
                        `);

                        // --- MIGRACIÓN 013: Historial de pagos y comprobantes ---
                        await pool.request().query(`
                            IF NOT EXISTS (
                                SELECT * 
                                FROM INFORMATION_SCHEMA.COLUMNS 
                                WHERE TABLE_NAME = 'pagos' AND COLUMN_NAME = 'comprobante_url'
                            )
                            BEGIN
                                ALTER TABLE dbo.pagos ADD comprobante_url NVARCHAR(255) NULL;
                            END

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
                        `);

                        await pool.request().query(`
                            IF OBJECT_ID('dbo.sp_GetHistorialPagosPaciente', 'P') IS NULL
                            BEGIN
                                EXEC('CREATE PROCEDURE dbo.sp_GetHistorialPagosPaciente AS BEGIN SET NOCOUNT ON; SELECT 1; END;');
                            END
                        `);
                        await pool.request().query(`
                            ALTER PROCEDURE dbo.sp_GetHistorialPagosPaciente
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
                        `);

                        await pool.request().query(`
                            IF OBJECT_ID('dbo.sp_RegistrarPagoProfesional', 'P') IS NULL
                            BEGIN
                                EXEC('CREATE PROCEDURE dbo.sp_RegistrarPagoProfesional AS BEGIN SET NOCOUNT ON; SELECT 1; END;');
                            END
                        `);
                        await pool.request().query(`
                            ALTER PROCEDURE dbo.sp_RegistrarPagoProfesional
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
                        `);

                        await pool.request().query(`
                            IF OBJECT_ID('dbo.sp_GetHistorialPagosProfesional', 'P') IS NULL
                            BEGIN
                                EXEC('CREATE PROCEDURE dbo.sp_GetHistorialPagosProfesional AS BEGIN SET NOCOUNT ON; SELECT 1; END;');
                            END
                        `);
                        await pool.request().query(`
                            ALTER PROCEDURE dbo.sp_GetHistorialPagosProfesional
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
                        `);

                        await pool.request().query(`
                            ALTER PROCEDURE [dbo].[sp_GetPaciente]
                                @id INT
                            AS
                            BEGIN
                                SET NOCOUNT ON;
                                SELECT 
                                    p.id, p.dni, p.nombre, p.apellido, p.fecha_nacimiento, p.telefono, p.email, p.numero_afiliado, p.fecha_alta, p.sexo, p.grupo_sanguineo, p.direccion, p.contacto_emergencia, p.alergias, p.obra_social_id,
                                    COALESCE(
                                        os_id.nombre,
                                        os_code.nombre,
                                        CASE WHEN p.obra_social IS NOT NULL AND p.obra_social <> '' AND ISNUMERIC(p.obra_social) = 0 THEN p.obra_social ELSE NULL END,
                                        'Particular'
                                    ) AS obra_social,
                                    COALESCE(
                                        os_id.nombre,
                                        os_code.nombre,
                                        CASE WHEN p.obra_social IS NOT NULL AND p.obra_social <> '' AND ISNUMERIC(p.obra_social) = 0 THEN p.obra_social ELSE NULL END,
                                        'Particular'
                                    ) AS obra_social_nombre
                                FROM Pacientes p
                                LEFT JOIN dbo.obras_sociales os_id ON p.obra_social_id = os_id.id
                                LEFT JOIN dbo.obras_sociales os_code ON (ISNUMERIC(p.obra_social) = 1 AND TRY_CAST(p.obra_social AS INT) = os_code.id)
                                WHERE p.id = @id;
                            END;
                        `);

                        await pool.request().query(`
                            ALTER PROCEDURE [dbo].[sp_GetPacientes]
                              @usuario_id INT = NULL
                            AS
                            BEGIN
                                SET NOCOUNT ON;

                                IF @usuario_id IS NOT NULL AND EXISTS (SELECT 1 FROM profesionales WHERE usuario_id = @usuario_id)
                                BEGIN
                                    DECLARE @profesional_id INT;
                                    
                                    SELECT @profesional_id = id 
                                    FROM profesionales 
                                    WHERE usuario_id = @usuario_id;

                                    SELECT DISTINCT 
                                        p.id, p.dni, p.nombre, p.apellido, p.fecha_nacimiento, p.telefono, p.email, p.numero_afiliado, p.fecha_alta, p.sexo, p.grupo_sanguineo, p.direccion, p.contacto_emergencia, p.alergias, p.obra_social_id,
                                        COALESCE(
                                            os_id.nombre,
                                            os_code.nombre,
                                            CASE WHEN p.obra_social IS NOT NULL AND p.obra_social <> '' AND ISNUMERIC(p.obra_social) = 0 THEN p.obra_social ELSE NULL END,
                                            'Particular'
                                        ) AS obra_social,
                                        COALESCE(
                                            os_id.nombre,
                                            os_code.nombre,
                                            CASE WHEN p.obra_social IS NOT NULL AND p.obra_social <> '' AND ISNUMERIC(p.obra_social) = 0 THEN p.obra_social ELSE NULL END,
                                            'Particular'
                                        ) AS obra_social_nombre,
                                        (SELECT COUNT(*) FROM dbo.turnos t_aus WHERE t_aus.paciente_id = p.id AND t_aus.estado IN ('Ausente', 'No Asistio', 'No Asistió')) AS total_ausentes
                                    FROM Pacientes p
                                    LEFT JOIN dbo.obras_sociales os_id ON p.obra_social_id = os_id.id
                                    LEFT JOIN dbo.obras_sociales os_code ON (ISNUMERIC(p.obra_social) = 1 AND TRY_CAST(p.obra_social AS INT) = os_code.id)
                                    INNER JOIN Turnos t ON p.id = t.paciente_id
                                    WHERE t.profesional_id = @profesional_id
                                    ORDER BY p.nombre, p.apellido;
                                END
                                ELSE
                                BEGIN
                                    SELECT 
                                        p.id, p.dni, p.nombre, p.apellido, p.fecha_nacimiento, p.telefono, p.email, p.numero_afiliado, p.fecha_alta, p.sexo, p.grupo_sanguineo, p.direccion, p.contacto_emergencia, p.alergias, p.obra_social_id,
                                        COALESCE(
                                            os_id.nombre,
                                            os_code.nombre,
                                            CASE WHEN p.obra_social IS NOT NULL AND p.obra_social <> '' AND ISNUMERIC(p.obra_social) = 0 THEN p.obra_social ELSE NULL END,
                                            'Particular'
                                        ) AS obra_social,
                                        COALESCE(
                                            os_id.nombre,
                                            os_code.nombre,
                                            CASE WHEN p.obra_social IS NOT NULL AND p.obra_social <> '' AND ISNUMERIC(p.obra_social) = 0 THEN p.obra_social ELSE NULL END,
                                            'Particular'
                                        ) AS obra_social_nombre,
                                        (SELECT COUNT(*) FROM dbo.turnos t_aus WHERE t_aus.paciente_id = p.id AND t_aus.estado IN ('Ausente', 'No Asistio', 'No Asistió')) AS total_ausentes
                                    FROM Pacientes p
                                    LEFT JOIN dbo.obras_sociales os_id ON p.obra_social_id = os_id.id
                                    LEFT JOIN dbo.obras_sociales os_code ON (ISNUMERIC(p.obra_social) = 1 AND TRY_CAST(p.obra_social AS INT) = os_code.id)
                                    ORDER BY p.nombre, p.apellido;
                                END
                            END;
                        `);

                        await pool.request().query(`
                            ALTER PROCEDURE [dbo].[sp_RegistrarPagoTurno]
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
                        `);

                        await pool.request().query(`
                            IF OBJECT_ID('dbo.sp_GetHistorialAsistenciaPaciente', 'P') IS NULL
                            BEGIN
                                EXEC('CREATE PROCEDURE dbo.sp_GetHistorialAsistenciaPaciente AS BEGIN SET NOCOUNT ON; SELECT 1; END;');
                            END
                        `);
                        await pool.request().query(`
                            ALTER PROCEDURE dbo.sp_GetHistorialAsistenciaPaciente
                                @paciente_id INT
                            AS
                            BEGIN
                                SET NOCOUNT ON;

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

                                SELECT 
                                    @paciente_id AS paciente_id,
                                    @total_turnos AS total_turnos,
                                    @total_asistidos AS total_asistidos,
                                    @total_ausentes AS total_ausentes,
                                    @total_cancelados AS total_cancelados,
                                    @total_pendientes AS total_pendientes,
                                    @tasa_asistencia AS tasa_asistencia;

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
                        `);

                        await pool.request().query(`
                            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.usuarios') AND name = 'session_token')
                            BEGIN
                                ALTER TABLE dbo.usuarios ADD session_token NVARCHAR(500) NULL;
                            END;
                            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.usuarios') AND name = 'fecha_ultimo_acceso')
                            BEGIN
                                ALTER TABLE dbo.usuarios ADD fecha_ultimo_acceso DATETIME NULL;
                            END;
                            IF OBJECT_ID('dbo.sp_ActualizarSesionUsuario', 'P') IS NULL
                            BEGIN
                                EXEC('CREATE PROCEDURE dbo.sp_ActualizarSesionUsuario AS BEGIN SET NOCOUNT ON; SELECT 1; END;');
                            END
                        `);
                        await pool.request().query(`
                            ALTER PROCEDURE dbo.sp_ActualizarSesionUsuario
                                @usuario_id INT,
                                @session_token NVARCHAR(500)
                            AS
                            BEGIN
                                SET NOCOUNT ON;
                                UPDATE dbo.usuarios
                                SET session_token = @session_token,
                                    fecha_ultimo_acceso = GETDATE()
                                WHERE id = @usuario_id;
                            END;
                        `);

                        console.log('✔️ Base de Datos: Migraciones de recordatorios, sp_GetTurnos, sp_GetUsuarios, sp_SetUsuario, especialidades, comprobantes de pagos, historial de asistencia y control de sesión única aplicadas.');
                    } catch (migErr) {
                        migracionesRealizadas = false;
                        console.error('⚠️ Error al aplicar migraciones de recordatorios:', migErr.message);
                    }
                }
                return pool;
            } catch (error) {
                poolPromise = null; // resetear si falló la conexión inicial
                console.error('ERROR DE CONEXIÓN:', error);
                throw error;
            }
        })();
    }
    return poolPromise;
}

module.exports = { getConnection, sql };