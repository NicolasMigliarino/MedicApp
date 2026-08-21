import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import './modules.css';

const CajaControl = () => {
    const [cajaActiva, setCajaActiva] = useState(null);
    const [resumen, setResumen] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGuide, setShowGuide] = useState(true);

    // Formulario de apertura
    const [montoApertura, setMontoApertura] = useState('0.00');

    // Formulario de cierre
    const [montoCierreReal, setMontoCierreReal] = useState('');

    const token = localStorage.getItem('token');
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };

    const loadCaja = async () => {
        try {
            setLoading(true);
            const res = await axios.get('http://localhost:3000/caja/activa', config);
            if (res.data && res.data.caja) {
                setCajaActiva(res.data.caja);
                setResumen(res.data.resumen);
            } else {
                setCajaActiva(null);
                setResumen([]);
            }
        } catch (error) {
            console.error('Error al cargar caja activa:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de Red',
                text: 'No se pudo conectar con el servidor para obtener el estado de la caja.',
                confirmButtonColor: '#3b82f6'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadCaja();
    }, []);

    // Manejar apertura
    const handleAbrirCaja = async (e) => {
        e.preventDefault();
        const monto = parseFloat(montoApertura);
        if (isNaN(monto) || monto < 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Monto inválido',
                text: 'Por favor, ingrese un monto de apertura válido mayor o igual a 0.'
            });
            return;
        }

        try {
            const res = await axios.post('http://localhost:3000/caja/abrir', { monto_apertura: monto }, config);
            Swal.fire({
                icon: 'success',
                title: '¡Caja Abierta!',
                text: res.data.mensaje || 'Se ha iniciado una nueva sesión diaria de cobros.',
                timer: 2000,
                showConfirmButton: false
            });
            loadCaja();
        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data || 'No se pudo abrir la caja diaria.'
            });
        }
    };

    // Manejar cierre
    const handleCerrarCaja = async (e) => {
        e.preventDefault();
        const real = parseFloat(montoCierreReal);
        if (isNaN(real) || real < 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Monto de cierre inválido',
                text: 'Por favor, ingrese la cantidad real física contada en el cajón.'
            });
            return;
        }

        const confirm = await Swal.fire({
            title: '¿Estás seguro de cerrar la caja?',
            text: 'Una vez cerrada, no se podrán añadir nuevos cobros a esta sesión diaria.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, cerrar y archivar',
            cancelButtonText: 'Cancelar'
        });

        if (confirm.isConfirmed) {
            try {
                const res = await axios.post('http://localhost:3000/caja/cerrar', {
                    caja_diaria_id: cajaActiva.id,
                    monto_cierre_real: real
                }, config);

                const balance = res.data.balance;
                const cleanDiagnostico = balance.diferencia === 0 
                    ? '✔️ Caja Cuadrada Perfectamente' 
                    : (balance.diferencia > 0 ? '🚨 Sobrante en Caja' : '🚨 Faltante en Caja');

                Swal.fire({
                    icon: 'success',
                    title: '🔒 Caja Cerrada Exitosamente',
                    html: `
                        <div style="text-align: left; padding: 10px; font-size: 0.95rem; line-height: 1.6;">
                            <p><b>Diagnóstico:</b> ${cleanDiagnostico}</p>
                            <hr style="margin: 8px 0;"/>
                            <p>💰 <b>Apertura:</b> $${parseFloat(balance.monto_apertura).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                            <p>💵 <b>Efectivo Cobrado:</b> $${parseFloat(balance.total_efectivo_cobrado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                            <p>📈 <b>Esperado en Caja:</b> $${parseFloat(balance.monto_cierre_esperado).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                            <p>🏦 <b>Contado Real:</b> $${parseFloat(balance.monto_cierre_real).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</p>
                            <p style="color: ${balance.diferencia < 0 ? '#ef4444' : balance.diferencia > 0 ? '#10b981' : 'inherit'}; font-weight: bold;">
                                📊 <b>Diferencia:</b> ${balance.diferencia >= 0 ? '+' : ''}$${parseFloat(balance.diferencia).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                            </p>
                        </div>
                    `,
                    confirmButtonText: 'Entendido',
                    confirmButtonColor: '#3b82f6'
                });

                setCajaActiva(null);
                setMontoCierreReal('');
                loadCaja();
            } catch (error) {
                console.error(error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error al cerrar caja',
                    text: error.response?.data || 'Hubo un error al intentar procesar el balance de cierre.'
                });
            }
        }
    };

    // Cálculos rápidos esperados
    const totalEfectivoCobrado = resumen
        .filter(r => r.metodo_pago === 'Efectivo')
        .reduce((sum, item) => sum + parseFloat(item.total), 0);

    const otrosMediosPago = resumen
        .filter(r => r.metodo_pago !== 'Efectivo')
        .reduce((sum, item) => sum + parseFloat(item.total), 0);

    const montoAperturaNum = cajaActiva ? parseFloat(cajaActiva.monto_apertura) : 0;
    const efectivoEsperadoTotal = montoAperturaNum + totalEfectivoCobrado;

    const realNum = parseFloat(montoCierreReal);
    const diferencia = !isNaN(realNum) ? realNum - efectivoEsperadoTotal : 0;

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Cargando...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="mod-container">
            <header className="mod-header mb-4">
                <div>
                    <h1 className="mod-title">💵 Control de Caja Diaria</h1>
                    <p className="mod-subtitle">Monitoreo y cierre de sesiones de facturación física y digital</p>
                </div>
                <div className="d-print-none">
                    <button 
                        onClick={() => setShowGuide(!showGuide)} 
                        className="guide-toggle-btn"
                        type="button"
                    >
                        {showGuide ? '🙈 Ocultar Guía' : '💡 Guía del Asistente'}
                    </button>
                </div>
            </header>

            {showGuide && (
                <div className="assistant-guide-card light-blue-theme d-print-none">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <h4 className="m-0" style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            💡 Guía del Asistente: Arqueo y Control de Caja
                        </h4>
                        <button 
                            onClick={() => setShowGuide(false)} 
                            className="btn-close" 
                            aria-label="Cerrar guía"
                            type="button"
                            style={{ filter: document.body.classList.contains('dark-mode') ? 'invert(1)' : 'none' }}
                        ></button>
                    </div>
                    <div className="row g-3" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        <div className="col-12 col-md-6">
                            <div className="d-flex align-items-start mb-2">
                                <span className="guide-step-number">1</span>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)' }}>Apertura de Sesión:</strong>
                                    <p className="m-0 mt-1 text-muted">
                                        Indica el saldo físico inicial disponible en el cajón (cambio/monedas). Puedes abrir la caja en <strong>$0.00</strong> si no cuentas con efectivo.
                                    </p>
                                </div>
                            </div>
                            <div className="d-flex align-items-start">
                                <span className="guide-step-number">2</span>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)' }}>Cálculo de Efectivo Esperado:</strong>
                                    <p className="m-0 mt-1 text-muted">
                                        Es la fórmula: <strong style={{ color: 'var(--text-primary)' }}>Apertura + Cobros en Efectivo</strong>. Este dinero debe estar físicamente resguardado en el cajón de la recepción.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-md-6">
                            <div className="d-flex align-items-start mb-2">
                                <span className="guide-step-number">3</span>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)' }}>Tratamiento de Canales Digitales:</strong>
                                    <p className="m-0 mt-1 text-muted">
                                        Las transferencias y cobros de QR (MercadoPago) van directo al banco de la clínica. <strong style={{ color: 'var(--text-primary)' }}>No debes contarlos</strong> como efectivo en el cajón físico.
                                    </p>
                                </div>
                            </div>
                            <div className="d-flex align-items-start">
                                <span className="guide-step-number">4</span>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)' }}>Arqueo de Cierre:</strong>
                                    <p className="m-0 mt-1 text-muted">
                                        Al final del día, cuenta el efectivo físico real. Si hay <strong>Sobrante</strong> o <strong>Faltante</strong> con respecto al esperado, el sistema lo auditará y registrará.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!cajaActiva ? (
                // PANTALLA: APERTURA DE CAJA
                <div className="mod-table-card p-5 text-center mx-auto" style={{ maxWidth: '580px' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🔓</div>
                    <h2 style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.5rem', marginBottom: '10px' }}>
                        Caja Diaria Cerrada
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginBottom: '30px' }}>
                        Para comenzar a registrar cobros de turnos en efectivo u otros medios de pago, es necesario iniciar una sesión diaria.
                    </p>

                    <form onSubmit={handleAbrirCaja} style={{ textAlign: 'left' }}>
                        <div className="mb-4">
                            <label className="form-label" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                Monto Inicial de Apertura ($)
                            </label>
                            <input
                                type="number"
                                className="form-control"
                                style={{
                                    background: 'var(--input-bg)',
                                    borderColor: 'var(--input-border)',
                                    color: 'var(--input-color)',
                                    padding: '12px',
                                    fontSize: '1.1rem'
                                }}
                                placeholder="Ej: 5000.00"
                                value={montoApertura}
                                onChange={(e) => setMontoApertura(e.target.value)}
                                min="0"
                                step="0.01"
                            />
                            <div className="form-text text-muted">
                                💡 Deja en 0.00 si hoy la recepción no cuenta con efectivo físico de apertura (cobros digitales únicamente).
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-100 py-3 text-white fw-bold"
                            style={{ borderRadius: '8px', fontSize: '1rem', background: '#3b82f6', border: 'none' }}
                        >
                            Abrir Caja Diaria
                        </button>
                    </form>
                </div>
            ) : (
                // PANTALLA: CAJA ABIERTA & FORMULARIO DE CIERRE
                <div className="row g-4">
                    {/* Panel Izquierdo: Resumen y Desglose */}
                    <div className="col-12 col-lg-7">
                        <div className="mod-table-card p-4 h-100">
                            <div className="d-flex align-items-center justify-content-between mb-4">
                                <h3 className="m-0" style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.25rem' }}>
                                    Sesión de Caja Activa
                                </h3>
                                <span
                                    className="badge bg-success"
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        background: 'var(--badge-activo-bg)',
                                        color: 'var(--badge-activo-text)'
                                    }}
                                >
                                    🟢 Abierta
                                </span>
                            </div>

                            <div className="row g-3 mb-4">
                                <div className="col-6">
                                    <div className="p-3" style={{ background: 'var(--row-hover)', borderRadius: '8px' }}>
                                        <div className="text-muted small">Fecha Apertura</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                                            {new Date(cajaActiva.fecha_apertura).toLocaleDateString('es-AR')}
                                        </div>
                                    </div>
                                </div>
                                <div className="col-6">
                                    <div className="p-3" style={{ background: 'var(--row-hover)', borderRadius: '8px' }}>
                                        <div className="text-muted small">Abierta Por</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                                            Usuario #{cajaActiva.usuario_apertura_id}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <hr style={{ borderColor: 'var(--border-separator)' }} />

                            <h4 className="mb-3" style={{ color: 'var(--text-primary)', fontSize: '1.05rem', fontWeight: '600' }}>
                                📊 Resumen Financiero en Sistema
                            </h4>

                            <div className="row g-3">
                                {/* CARD: APERTURA */}
                                <div className="col-12 col-sm-6">
                                    <div className="p-3 border" style={{ borderRadius: '8px', background: 'var(--bg-card)', borderColor: 'var(--border-separator)' }}>
                                        <div className="text-muted small">💵 Saldo de Apertura</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.3rem' }}>
                                            ${parseFloat(cajaActiva.monto_apertura).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>

                                {/* CARD: EFECTIVO COBRADO */}
                                <div className="col-12 col-sm-6">
                                    <div className="p-3 border" style={{ borderRadius: '8px', background: 'var(--bg-card)', borderColor: 'var(--border-separator)' }}>
                                        <div className="text-muted small">🛒 Efectivo Cobrado</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.3rem' }}>
                                            ${totalEfectivoCobrado.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>

                                {/* CARD: EFECTIVO ESPERADO TOTAL */}
                                <div className="col-12 col-sm-6">
                                    <div className="p-3 border" style={{ borderRadius: '8px', background: 'rgba(59, 130, 246, 0.05)', borderColor: 'rgba(59, 130, 246, 0.15)' }}>
                                        <div className="text-primary small" style={{ fontWeight: '600' }}>📈 Efectivo Esperado en Cajón</div>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.5rem' }}>
                                            ${efectivoEsperadoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>

                                {/* CARD: OTROS MEDIOS DIGITALES */}
                                <div className="col-12 col-sm-6">
                                    <div className="p-3 border" style={{ borderRadius: '8px', background: 'var(--bg-card)', borderColor: 'var(--border-separator)' }}>
                                        <div className="text-muted small">📱 Canales Digitales (Sin cajón)</div>
                                        <div style={{ color: 'var(--text-secondary)', fontWeight: 'bold', fontSize: '1.3rem' }}>
                                            ${otrosMediosPago.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Desglose por método de pago */}
                            <h5 className="mt-4 mb-3" style={{ color: 'var(--text-primary)', fontSize: '0.95rem', fontWeight: '600' }}>
                                Desglose de cobros del día
                            </h5>
                            {resumen.length === 0 ? (
                                <p className="text-muted small text-center p-3 border rounded">
                                    Aún no se han registrado cobros de turnos en esta sesión.
                                </p>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table align-middle">
                                        <thead>
                                            <tr>
                                                <th style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Método de Pago</th>
                                                <th className="text-end" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Monto Bruto Recaudado</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {resumen.map((r, i) => (
                                                <tr key={i}>
                                                    <td style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                                        {r.metodo_pago === 'Efectivo' ? '💵 Efectivo' :
                                                         r.metodo_pago === 'MercadoPago' ? '📱 MercadoPago' :
                                                         r.metodo_pago === 'Transferencia' ? '🏦 Transferencia' :
                                                         `💳 ${r.metodo_pago}`}
                                                    </td>
                                                    <td className="text-end fw-bold" style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                                        ${parseFloat(r.total).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Panel Derecho: Asistente de Cierre */}
                    <div className="col-12 col-lg-5">
                        <div className="mod-table-card p-4 h-100">
                            <h3 className="mb-4" style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.25rem' }}>
                                🔒 Asistente de Cierre
                            </h3>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                                Ingrese el dinero físico real que se encuentra físicamente en el cajón de recepción para balancear las cuentas.
                            </p>

                            <form onSubmit={handleCerrarCaja}>
                                <div className="mb-4">
                                    <label className="form-label" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                        Efectivo Físico Real Contado ($)
                                    </label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        style={{
                                            background: 'var(--input-bg)',
                                            borderColor: 'var(--input-border)',
                                            color: 'var(--input-color)',
                                            padding: '12px',
                                            fontSize: '1.15rem'
                                        }}
                                        placeholder="Ingrese el conteo manual"
                                        value={montoCierreReal}
                                        onChange={(e) => setMontoCierreReal(e.target.value)}
                                        min="0"
                                        step="0.01"
                                        required
                                    />
                                </div>

                                {/* Diagnóstico Reactivo de diferencias */}
                                {montoCierreReal !== '' && (
                                    <div
                                        className="p-3 mb-4 rounded"
                                        style={{
                                            background: diferencia === 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                                            border: `1px solid ${diferencia === 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`
                                        }}
                                    >
                                        <div className="d-flex align-items-center justify-content-between">
                                            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>Estado de Balance:</span>
                                            <span style={{
                                                fontWeight: 'bold',
                                                color: diferencia === 0 ? '#10b981' : '#ef4444'
                                            }}>
                                                {diferencia === 0 ? '✔️ Caja Cuadrada' :
                                                 diferencia > 0 ? `🚨 Sobrante de $${Math.abs(diferencia).toFixed(2)}` :
                                                 `🚨 Faltante de $${Math.abs(diferencia).toFixed(2)}`}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    className="btn btn-danger w-100 py-3 text-white fw-bold"
                                    style={{ borderRadius: '8px', fontSize: '1rem', background: '#ef4444', border: 'none' }}
                                >
                                    Cerrar Caja Diaria
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CajaControl;
