import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import './modules.css';

const Liquidaciones = () => {
    const [profesionales, setProfesionales] = useState([]);
    const [selectedProfesional, setSelectedProfesional] = useState('');
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Resultados
    const [detalles, setDetalles] = useState([]);
    const [consolidado, setConsolidado] = useState(null);
    const [hasQueried, setHasQueried] = useState(false);
    const [showGuide, setShowGuide] = useState(true);
    const [payoutsHistory, setPayoutsHistory] = useState([]);

    const token = localStorage.getItem('token');
    const config = {
        headers: { Authorization: `Bearer ${token}` }
    };

    // Cargar profesionales para el dropdown
    useEffect(() => {
        const loadProfesionales = async () => {
            try {
                const res = await axios.get('http://localhost:3000/profesionales', config);
                setProfesionales(res.data);
            } catch (error) {
                console.error('Error cargando profesionales:', error);
            }
        };

        // Rango de fechas por defecto: Mes actual
        const hoy = new Date();
        const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        
        setFechaDesde(primero.toISOString().split('T')[0]);
        setFechaHasta(hoy.toISOString().split('T')[0]);

        loadProfesionales();
    }, []);

    const handleBuscar = async (e) => {
        e.preventDefault();
        if (!selectedProfesional) {
            Swal.fire({ icon: 'warning', title: 'Falta seleccionar profesional', text: 'Por favor, elija un médico de la lista.' });
            return;
        }

        try {
            setLoading(true);
            const res = await axios.get('http://localhost:3000/liquidaciones', {
                ...config,
                params: {
                    profesional_id: selectedProfesional,
                    fecha_desde: fechaDesde,
                    fecha_hasta: fechaHasta
                }
            });

            setDetalles(res.data.detalles);
            setConsolidado(res.data.consolidado);
            setHasQueried(true);
        } catch (error) {
            console.error('Error al consultar liquidación:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de Consulta',
                text: error.response?.data?.message || 'No se pudo calcular la liquidación del profesional.'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleImprimir = () => {
        window.print();
    };

    const fetchPayoutsHistory = async (profesionalId) => {
        try {
            const res = await axios.get(`http://localhost:3000/pagos/profesional/${profesionalId}`, config);
            setPayoutsHistory(res.data);
        } catch (error) {
            console.error('Error fetching payouts history:', error);
        }
    };

    useEffect(() => {
        if (selectedProfesional) {
            fetchPayoutsHistory(selectedProfesional);
        } else {
            setPayoutsHistory([]);
        }
    }, [selectedProfesional]);

    const handleLiquidar = async () => {
        if (!selectedProfesional || !consolidado) return;

        const montoPropuesto = consolidado.total_honorarios_medico || 0;

        const { value: formValues } = await Swal.fire({
            title: '💳 Registrar Pago de Liquidación',
            html: `
                <div style="padding: 5px 10px; overflow: hidden; text-align: left;">
                    <p style="font-size: 0.9rem; color: #6b7280; margin-bottom: 15px;">
                        Completá los datos para registrar el pago real transferido al médico.
                    </p>
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">Monto Neto a Pagar ($)</label>
                    <input id="swal-input-monto" type="number" class="form-control" value="${montoPropuesto}" style="margin-bottom: 20px;">
                    
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">Fecha Desde (Período)</label>
                    <input id="swal-input-desde" type="date" class="form-control" value="${fechaDesde}" style="margin-bottom: 20px;">
                    
                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">Fecha Hasta (Período)</label>
                    <input id="swal-input-hasta" type="date" class="form-control" value="${fechaHasta}" style="margin-bottom: 20px;">

                    <label style="display: block; margin-bottom: 8px; font-weight: 600; color: var(--text-primary);">Adjuntar Comprobante de Transferencia</label>
                    <input id="swal-input-comprobante" type="file" class="form-control" style="margin-bottom: 20px;">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '✅ Registrar Pago',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#10b981',
            preConfirm: () => {
                const monto = document.getElementById('swal-input-monto').value;
                const desde = document.getElementById('swal-input-desde').value;
                const hasta = document.getElementById('swal-input-hasta').value;
                const fileInput = document.getElementById('swal-input-comprobante');
                const file = fileInput ? fileInput.files[0] : null;

                if (!monto || parseFloat(monto) <= 0) {
                    Swal.showValidationMessage('Por favor, ingresá un monto válido.');
                    return false;
                }
                if (!desde || !hasta) {
                    Swal.showValidationMessage('Por favor, ingresá el rango de fechas del período liquidado.');
                    return false;
                }
                return { monto: parseFloat(monto), fecha_desde: desde, fecha_hasta: hasta, comprobante: file };
            }
        });

        if (formValues) {
            try {
                const formData = new FormData();
                formData.append('monto', formValues.monto);
                formData.append('fecha_desde', formValues.fecha_desde);
                formData.append('fecha_hasta', formValues.fecha_hasta);
                if (formValues.comprobante) {
                    formData.append('comprobante', formValues.comprobante);
                }

                await axios.post(`http://localhost:3000/pagos/profesional/${selectedProfesional}`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                        Authorization: `Bearer ${token}`
                    }
                });

                Swal.fire({
                    icon: 'success',
                    title: '¡Pago Registrado!',
                    text: 'Se ha asentado el pago de la liquidación en el historial del profesional.',
                    timer: 2000,
                    showConfirmButton: false
                });

                fetchPayoutsHistory(selectedProfesional);
            } catch (error) {
                console.error(error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: error.response?.data?.message || 'No se pudo registrar el pago de la liquidación.'
                });
            }
        }
    };

    return (
        <div className="mod-container">
            {/* Ocultar header en impresión */}
            <header className="mod-header mb-4 d-print-none">
                <div>
                    <h1 className="mod-title">🧮 Liquidación de Honorarios</h1>
                    <p className="mod-subtitle">Cálculo automatizado de retenciones y comisiones médicas del centro</p>
                </div>
                <div>
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
                <div className="assistant-guide-card emerald-theme d-print-none">
                    <div className="d-flex align-items-center justify-content-between mb-3">
                        <h4 className="m-0" style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            💡 Guía del Asistente: Cálculo y Liquidación de Honorarios
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
                                <span className="guide-step-number emerald">1</span>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)' }}>Selección del Médico y Período:</strong>
                                    <p className="m-0 mt-1 text-muted">
                                        Selecciona el profesional y define el rango de fechas (desde/hasta). Por defecto, el sistema carga el mes actual.
                                    </p>
                                </div>
                            </div>
                            <div className="d-flex align-items-start">
                                <span className="guide-step-number emerald">2</span>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)' }}>Porcentaje de Retención Clínica:</strong>
                                    <p className="m-0 mt-1 text-muted">
                                        Cada profesional tiene pactada una retención (ej. Pediatra 25%, Odontólogo 30%). Se configura desde el perfil del médico.
                                    </p>
                                </div>
                            </div>
                        </div>
                        <div className="col-12 col-md-6">
                            <div className="d-flex align-items-start mb-2">
                                <span className="guide-step-number emerald">3</span>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)' }}>Cálculo Matemático en Backend:</strong>
                                    <p className="m-0 mt-1 text-muted">
                                        El sistema calcula: <strong style={{ color: 'var(--text-primary)' }}>Total Recaudado (Bruto) - Retención Clínica = Neto Médico a Liquidar</strong>.
                                    </p>
                                </div>
                            </div>
                            <div className="d-flex align-items-start">
                                <span className="guide-step-number emerald">4</span>
                                <div>
                                    <strong style={{ color: 'var(--text-primary)' }}>Comprobante y Pago:</strong>
                                    <p className="m-0 mt-1 text-muted">
                                        Usa <strong>🖨️ Imprimir Detalle</strong> para descargar el reporte oficial de firmas, y luego presiona <strong>💳 Proceder al Pago</strong> para cerrar la liquidación.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Filtros: Ocultar en impresión */}
            <div className="mod-table-card p-4 mb-4 d-print-none">
                <form onSubmit={handleBuscar} className="row g-3 align-items-end">
                    <div className="col-12 col-md-4">
                        <label className="form-label" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            Profesional Médico
                        </label>
                        <select
                            className="form-select"
                            style={{
                                background: 'var(--input-bg)',
                                borderColor: 'var(--input-border)',
                                color: 'var(--input-color)'
                            }}
                            value={selectedProfesional}
                            onChange={(e) => setSelectedProfesional(e.target.value)}
                            required
                        >
                            <option value="">-- Seleccionar Médico --</option>
                            {profesionales.map(p => (
                                <option key={p.id} value={p.id}>
                                    🩺 {p.nombre} {p.apellido} ({p.especialidad || 'General'})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="col-12 col-sm-6 col-md-3">
                        <label className="form-label" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            Fecha Desde
                        </label>
                        <input
                            type="date"
                            className="form-control"
                            style={{
                                background: 'var(--input-bg)',
                                borderColor: 'var(--input-border)',
                                color: 'var(--input-color)'
                            }}
                            value={fechaDesde}
                            onChange={(e) => setFechaDesde(e.target.value)}
                            required
                        />
                    </div>

                    <div className="col-12 col-sm-6 col-md-3">
                        <label className="form-label" style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            Fecha Hasta
                        </label>
                        <input
                            type="date"
                            className="form-control"
                            style={{
                                background: 'var(--input-bg)',
                                borderColor: 'var(--input-border)',
                                color: 'var(--input-color)'
                            }}
                            value={fechaHasta}
                            onChange={(e) => setFechaHasta(e.target.value)}
                            required
                        />
                    </div>

                    <div className="col-12 col-md-2">
                        <button
                            type="submit"
                            className="btn btn-primary w-100 py-2 text-white fw-bold d-flex align-items-center justify-content-center"
                            style={{ borderRadius: '6px', background: '#3b82f6', border: 'none' }}
                        >
                            <ion-icon name="search-outline" style={{ marginRight: '6px' }} /> Buscar
                        </button>
                    </div>
                </form>
            </div>

            {loading && (
                <div className="d-flex justify-content-center align-items-center my-5 d-print-none">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Procesando cálculos...</span>
                    </div>
                </div>
            )}

            {/* VISTA DE RESULTADOS */}
            {hasQueried && !loading && (
                <div>
                    {/* ENCABEZADO DE IMPRESIÓN (Sólo visible al imprimir) */}
                    <div className="d-none d-print-block mb-5 text-center">
                        <h2>🏥 MedCloud - Centro Clínico</h2>
                        <h4 className="text-muted">Liquidación Oficial de Honorarios Médicos</h4>
                        <hr />
                        <div className="row text-start mt-4">
                            <div className="col-6">
                                <div><b>Profesional:</b> {consolidado?.profesional_nombre}</div>
                                <div><b>Especialidad:</b> {consolidado?.especialidad}</div>
                            </div>
                            <div className="col-6 text-end">
                                <div><b>Fecha de Emisión:</b> {new Date().toLocaleDateString('es-AR')}</div>
                                <div><b>Período Liquidado:</b> {new Date(fechaDesde).toLocaleDateString('es-AR')} al {new Date(fechaHasta).toLocaleDateString('es-AR')}</div>
                            </div>
                        </div>
                    </div>

                    {/* KPIs consolidados */}
                    <div className="row g-3 mb-4">
                        {/* KPI 1: Cantidad de Consultas */}
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="mod-table-card p-4 text-center">
                                <div className="text-muted small">Consultas Atendidas</div>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.8rem' }}>
                                    {consolidado ? consolidado.cantidad_consultas : 0}
                                </div>
                            </div>
                        </div>

                        {/* KPI 2: Total Recaudado Bruto */}
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="mod-table-card p-4 text-center">
                                <div className="text-muted small">Total Recaudado Bruto</div>
                                <div style={{ color: 'var(--text-primary)', fontWeight: 'bold', fontSize: '1.8rem' }}>
                                    ${consolidado ? parseFloat(consolidado.total_recaudado_bruto).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0,00'}
                                </div>
                            </div>
                        </div>

                        {/* KPI 3: Comisión Clínica */}
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="mod-table-card p-4 text-center" style={{ background: 'rgba(239, 68, 68, 0.03)', borderColor: 'rgba(239, 68, 68, 0.1)' }}>
                                <div className="text-danger small" style={{ fontWeight: '600' }}>Retención Clínica (Centro)</div>
                                <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '1.8rem' }}>
                                    ${consolidado ? parseFloat(consolidado.total_comision_clinica).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0,00'}
                                </div>
                            </div>
                        </div>

                        {/* KPI 4: Neto Médico */}
                        <div className="col-12 col-sm-6 col-lg-3">
                            <div className="mod-table-card p-4 text-center" style={{ background: 'rgba(16, 185, 129, 0.03)', borderColor: 'rgba(16, 185, 129, 0.1)' }}>
                                <div className="text-success small" style={{ fontWeight: '600' }}>Neto a Liquidar Médico</div>
                                <div style={{ color: '#10b981', fontWeight: 'bold', fontSize: '1.8rem' }}>
                                    ${consolidado ? parseFloat(consolidado.total_honorarios_medico).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : '0,00'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* TABLA DE DETALLES */}
                    <div className="mod-table-card p-4 mb-4">
                        <div className="d-flex align-items-center justify-content-between mb-4 d-print-none">
                            <h3 className="m-0" style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.15rem' }}>
                                Desglose Analítico por Consulta
                            </h3>
                            <div>
                                <button
                                    onClick={handleImprimir}
                                    className="btn btn-outline-secondary me-2 fw-semibold"
                                    style={{ borderRadius: '6px' }}
                                >
                                    🖨️ Imprimir Detalle
                                </button>
                                <button
                                    onClick={handleLiquidar}
                                    className="btn btn-success fw-bold"
                                    style={{ borderRadius: '6px' }}
                                >
                                    💳 Proceder al Pago
                                </button>
                            </div>
                        </div>

                        {detalles.length === 0 ? (
                            <div className="p-5 text-center">
                                <p className="text-muted">No se registraron turnos cobrados para este médico en el período seleccionado.</p>
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="table align-middle table-hover">
                                    <thead>
                                        <tr>
                                            <th style={{ color: 'var(--text-secondary)' }}>Fecha</th>
                                            <th style={{ color: 'var(--text-secondary)' }}>Paciente</th>
                                            <th style={{ color: 'var(--text-secondary)' }}>Método</th>
                                            <th className="text-end" style={{ color: 'var(--text-secondary)' }}>Importe Bruto</th>
                                            <th className="text-center" style={{ color: 'var(--text-secondary)' }}>% Ret.</th>
                                            <th className="text-end" style={{ color: 'var(--text-secondary)' }}>Retención Centro</th>
                                            <th className="text-end" style={{ color: 'var(--text-secondary)' }}>Neto Médico</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detalles.map((d) => (
                                            <tr key={d.pago_id}>
                                                <td style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                                    {new Date(d.fecha_pago).toLocaleDateString('es-AR')}
                                                </td>
                                                <td style={{ color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '500' }}>
                                                    {d.paciente_nombre}
                                                </td>
                                                <td style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                    {d.metodo_pago}
                                                </td>
                                                <td className="text-end" style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                                                    ${parseFloat(d.monto_bruto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-center text-muted" style={{ fontSize: '0.85rem' }}>
                                                    {parseFloat(d.porcentaje_retencion).toFixed(0)}%
                                                </td>
                                                <td className="text-end text-danger fw-medium" style={{ fontSize: '0.9rem' }}>
                                                    -${parseFloat(d.retencion_clinica).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                                <td className="text-end text-success fw-bold" style={{ fontSize: '0.9rem' }}>
                                                    ${parseFloat(d.honorarios_medico).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* FIRMA DE IMPRESIÓN (Sólo visible al imprimir) */}
                    <div className="d-none d-print-block mt-5" style={{ paddingTop: '80px' }}>
                        <div className="row">
                            <div className="col-6 text-center">
                                <div style={{ borderTop: '1px solid #ccc', width: '200px', margin: '0 auto' }}></div>
                                <p className="mt-2 text-muted" style={{ fontSize: '0.85rem' }}>Firma Responsable Administración</p>
                            </div>
                            <div className="col-6 text-center">
                                <div style={{ borderTop: '1px solid #ccc', width: '200px', margin: '0 auto' }}></div>
                                <p className="mt-2 text-muted" style={{ fontSize: '0.85rem' }}>Conformidad del Profesional</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!hasQueried && !loading && (
                <div className="mod-table-card p-5 text-center d-print-none">
                    <div style={{ fontSize: '3.5rem', marginBottom: '15px' }}>🧮</div>
                    <h3 style={{ color: 'var(--text-primary)', fontWeight: '600' }}>Calculadora de Liquidaciones</h3>
                    <p className="text-muted">Seleccione un profesional médico y un rango de fechas para liquidar honorarios.</p>
                </div>
            )}

            {/* HISTORIAL DE PAGOS A PROFESIONALES (Solo d-print-none) */}
            {selectedProfesional && (
                <div className="mod-table-card p-4 mt-4 d-print-none">
                    <h3 style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.15rem', marginBottom: '20px' }}>
                        💳 Historial de Liquidaciones Pagadas a este Profesional
                    </h3>
                    {payoutsHistory.length === 0 ? (
                        <p className="text-muted text-center py-4">No se registran pagos de liquidaciones anteriores para este médico.</p>
                    ) : (
                        <div className="table-responsive">
                            <table className="table align-middle table-hover" style={{ fontSize: '0.9rem' }}>
                                <thead>
                                    <tr>
                                        <th style={{ color: 'var(--text-secondary)' }}>Fecha de Pago</th>
                                        <th style={{ color: 'var(--text-secondary)' }}>Monto Pagado</th>
                                        <th style={{ color: 'var(--text-secondary)' }}>Período Liquidado</th>
                                        <th style={{ color: 'var(--text-secondary)' }}>Registrado Por</th>
                                        <th style={{ color: 'var(--text-secondary)' }} className="text-center">Comprobante</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {payoutsHistory.map((p) => (
                                        <tr key={p.pago_id}>
                                            <td style={{ color: 'var(--text-primary)' }}>
                                                {new Date(p.fecha_pago).toLocaleString('es-AR')}
                                            </td>
                                            <td style={{ color: 'var(--text-primary)', fontWeight: '600' }}>
                                                ${parseFloat(p.monto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)' }}>
                                                {new Date(p.fecha_desde).toLocaleDateString('es-AR')} al {new Date(p.fecha_hasta).toLocaleDateString('es-AR')}
                                            </td>
                                            <td style={{ color: 'var(--text-secondary)' }}>
                                                {p.usuario_registro_nombre}
                                            </td>
                                            <td className="text-center">
                                                {p.comprobante_url ? (
                                                    <a 
                                                        href={`http://localhost:3000${p.comprobante_url}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="btn btn-sm btn-outline-primary"
                                                        style={{ padding: '2px 8px', fontSize: '0.8rem', borderRadius: '4px' }}
                                                    >
                                                        📄 Ver Recibo
                                                    </a>
                                                ) : (
                                                    <span className="text-muted">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            {/* TICKET DE IMPRESIÓN EXCLUSIVO PARA IMPRESORA */}
            <div className="ticket-print-only">
                <div className="ticket-box">
                    <div className="ticket-header">
                        <h2 className="ticket-title">🏥 MedCloud</h2>
                        <div className="ticket-subtitle">COMPROBANTE DE LIQUIDACIÓN DE HONORARIOS</div>
                        <div className="ticket-divider">------------------------------------------------</div>
                    </div>

                    <div className="ticket-body">
                        <div className="ticket-row">
                            <span><strong>Profesional:</strong></span>
                            <span>Dr. {consolidado?.profesional_nombre}</span>
                        </div>
                        <div className="ticket-row">
                            <span><strong>Especialidad:</strong></span>
                            <span>{consolidado?.especialidad || 'General'}</span>
                        </div>
                        <div className="ticket-row">
                            <span><strong>Período:</strong></span>
                            <span>{fechaDesde ? new Date(fechaDesde).toLocaleDateString('es-AR') : ''} al {fechaHasta ? new Date(fechaHasta).toLocaleDateString('es-AR') : ''}</span>
                        </div>
                        <div className="ticket-row">
                            <span><strong>Fecha Emisión:</strong></span>
                            <span>{new Date().toLocaleDateString('es-AR')} {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        <div className="ticket-divider">------------------------------------------------</div>

                        <div className="ticket-section-title">RESUMEN DE HONORARIOS</div>
                        <div className="ticket-row">
                            <span>Consultas Atendidas:</span>
                            <strong>{consolidado?.cantidad_consultas || 0}</strong>
                        </div>
                        <div className="ticket-row">
                            <span>Bruto Total Recaudado:</span>
                            <strong>${parseFloat(consolidado?.total_recaudado_bruto || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
                        </div>
                        <div className="ticket-row">
                            <span>% Retención Acordado:</span>
                            <strong>{detalles.length > 0 ? parseFloat(detalles[0].porcentaje_retencion).toFixed(0) : 20}%</strong>
                        </div>
                        <div className="ticket-row">
                            <span>Retención Centro Médico:</span>
                            <span style={{ color: '#dc2626' }}>-${parseFloat(consolidado?.total_comision_clinica || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="ticket-divider">================================================</div>

                        <div className="ticket-row ticket-total">
                            <span>NETO A LIQUIDAR:</span>
                            <span>${parseFloat(consolidado?.total_honorarios_medico || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        <div className="ticket-divider">================================================</div>

                        {detalles.length > 0 && (
                            <div style={{ marginTop: '10px' }}>
                                <div className="ticket-section-title">DESGLOSE DE CONSULTAS</div>
                                <table className="ticket-table">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Paciente</th>
                                            <th>Método</th>
                                            <th style={{ textAlign: 'right' }}>Neto</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {detalles.map(d => (
                                            <tr key={d.pago_id}>
                                                <td>{new Date(d.fecha_pago).toLocaleDateString('es-AR')}</td>
                                                <td>{d.paciente_nombre}</td>
                                                <td>{d.metodo_pago}</td>
                                                <td style={{ textAlign: 'right' }}>${parseFloat(d.honorarios_medico).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="ticket-signatures">
                            <div className="signature-col">
                                <div className="signature-line"></div>
                                <div>Firma Administración</div>
                            </div>
                            <div className="signature-col">
                                <div className="signature-line"></div>
                                <div>Conformidad Médico</div>
                            </div>
                        </div>

                        <div className="ticket-footer">
                            MedCloud © 2026 - Sistema de Gestión Médica
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Liquidaciones;
