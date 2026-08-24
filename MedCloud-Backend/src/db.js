/* =========================================================================
   ARCHIVO: src/db.js
   DESCRIPCIÓN: Módulo de conexión a SQL Server mediante Pool.
   ========================================================================= */
const sql = require('mssql');
const EventEmitter = require('events');
EventEmitter.defaultMaxListeners = 25;

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

async function getConnection() {
    if (!poolPromise) {
        poolPromise = (async () => {
            try {
                const pool = await sql.connect(dbSettings);
                return pool;
            } catch (error) {
                poolPromise = null; // Resetear si falló la conexión inicial
                console.error('ERROR DE CONEXIÓN A SQL SERVER:', error);
                throw error;
            }
        })();
    }
    return poolPromise;
}

module.exports = { getConnection, sql };