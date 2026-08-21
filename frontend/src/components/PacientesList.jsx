import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import './modules.css';
import useResizableColumns from './useResizableColumns';
import { hasRole } from '../utils/auth';

const getInitials = (nombre = '', apellido = '') =>
    `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();

const PacientesList = () => {
    const [pacientes, setPacientes] = useState([]);
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const tableRef = useResizableColumns();

    const esMedico = hasRole('MEDICO');

    const fetchPacientes = async () => {
        try {
            const response = await axios.get('http://localhost:3000/pacientes');
            setPacientes(response.data);
        } catch (error) {
            console.error('Error al buscar pacientes:', error);
        }
    };

    useEffect(() => { fetchPacientes(); }, []);

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: 'Esta acción eliminará al paciente de forma permanente.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
        });
        if (result.isConfirmed) {
            try {
                await axios.delete(`http://localhost:3000/pacientes/${id}`);
                Swal.fire({ icon: 'success', title: 'Eliminado', text: 'El paciente ha sido borrado del sistema.', timer: 1500, showConfirmButton: false });
                fetchPacientes();
            } catch (error) {
                console.error('Error al eliminar:', error);
                Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar al paciente (Verifica que no tenga turnos ni historial).' });
            }
        }
    };

    // Reset to page 1 on search change
    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    const filtered = useMemo(() => {
        return pacientes.filter(p =>
            `${p.nombre} ${p.apellido} ${p.dni} ${p.email}`.toLowerCase().includes(search.toLowerCase())
        );
    }, [pacientes, search]);

    const sortedData = useMemo(() => {
        let sortableItems = [...filtered];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aVal, bVal;
                if (sortConfig.key === 'paciente') {
                    aVal = `${a.nombre} ${a.apellido}`.toLowerCase();
                    bVal = `${b.nombre} ${b.apellido}`.toLowerCase();
                } else {
                    aVal = (a[sortConfig.key] || '').toString().toLowerCase();
                    bVal = (b[sortConfig.key] || '').toString().toLowerCase();
                }

                if (aVal < bVal) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aVal > bVal) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableItems;
    }, [filtered, sortConfig]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        return sortedData.slice(startIndex, endIndex);
    }, [sortedData, currentPage]);

    const totalPages = Math.ceil(sortedData.length / itemsPerPage);

    const requestSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key) => {
        if (sortConfig.key !== key) {
            return <span className="sort-icon">⇅</span>;
        }
        return sortConfig.direction === 'asc' ? 
            <span className="sort-icon active">▲</span> : 
            <span className="sort-icon active">▼</span>;
    };

    const handleVerPagos = async (paciente) => {
        try {
            Swal.fire({
                title: 'Cargando Historial de Pagos...',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            const token = localStorage.getItem('token');
            const response = await axios.get(`http://localhost:3000/pagos/paciente/${paciente.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const pagos = response.data;

            Swal.close();

            if (!pagos || pagos.length === 0) {
                Swal.fire({
                    icon: 'info',
                    title: `💳 Historial de Pagos - ${paciente.nombre} ${paciente.apellido}`,
                    text: 'El paciente no registra ningún pago efectuado en el sistema.'
                });
                return;
            }

            // Construir tabla interactiva con formato estandarizado
            const tableRowsHtml = pagos.map(p => {
                const dp = new Date(p.fecha_pago);
                const diaP = String(dp.getDate()).padStart(2, '0');
                const mesP = String(dp.getMonth() + 1).padStart(2, '0');
                const anioP = dp.getFullYear();
                const horasP = String(dp.getHours()).padStart(2, '0');
                const minsP = String(dp.getMinutes()).padStart(2, '0');
                const fechaPagoStr = `${diaP}/${mesP}/${anioP} - ${horasP}:${minsP} hs`;

                const dc = new Date(p.fecha_consulta);
                const diaC = String(dc.getDate()).padStart(2, '0');
                const mesC = String(dc.getMonth() + 1).padStart(2, '0');
                const anioC = dc.getFullYear();
                const fechaConsultaStr = `${diaC}/${mesC}/${anioC}`;

                const montoFormatted = `$${Math.round(parseFloat(p.monto_bruto)).toLocaleString('es-AR')}`;

                return `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 12px; text-align: left; font-weight: 600; white-space: nowrap; color: #334155;">${fechaPagoStr}</td>
                        <td style="padding: 10px 12px; text-align: left; white-space: nowrap;">
                            <strong style="color: #1e293b;">Dr/a. ${p.profesional_nombre}</strong><br>
                            <small style="color: #64748b; font-weight: 500;">Cons: ${fechaConsultaStr}</small>
                        </td>
                        <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: #16a34a; white-space: nowrap;">${montoFormatted}</td>
                        <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
                            <span style="padding: 3px 8px; border-radius: 12px; font-size: 0.78rem; font-weight: 600; background-color: #f1f5f9; color: #334155;">
                                ${p.metodo_pago}
                            </span>
                        </td>
                        <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
                            ${p.comprobante_url ? `
                                <a href="http://localhost:3000${p.comprobante_url}" target="_blank" style="text-decoration: none; background-color: #0f766e; color: white; padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600;">📄 Ver Recibo</a>
                            ` : '<span style="color:#9ca3af;">-</span>'}
                        </td>
                    </tr>
                `;
            }).join('');

            Swal.fire({
                title: `💳 Historial de Pagos - ${paciente.nombre} ${paciente.apellido}`,
                width: '840px',
                html: `
                    <div style="padding: 5px;">
                        <div style="max-height: 380px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                                <thead>
                                    <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-weight: bold; position: sticky; top: 0; z-index: 1;">
                                        <th style="padding: 10px 12px; text-align: left; white-space: nowrap; width: 160px;">Fecha Pago</th>
                                        <th style="padding: 10px 12px; text-align: left; white-space: nowrap; width: 200px;">Médico / Consulta</th>
                                        <th style="padding: 10px 12px; text-align: right; white-space: nowrap; width: 120px;">Monto</th>
                                        <th style="padding: 10px 12px; text-align: center; white-space: nowrap; width: 120px;">Método</th>
                                        <th style="padding: 10px 12px; text-align: center; white-space: nowrap; width: 120px;">Recibo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#10b981'
            });

        } catch (error) {
            console.error("Error al obtener historial de pagos:", error);
            Swal.fire('Error', 'No se pudo obtener el historial de pagos del paciente.', 'error');
        }
    };

    const handleVerAsistencia = async (paciente) => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`http://localhost:3000/pacientes/${paciente.id}/asistencia`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const { resumen, historial } = res.data;

            const warningBanner = (resumen.total_ausentes >= 2) ? `
                <div style="background-color: #fef2f2; color: #991b1b; padding: 12px; border-radius: 8px; border: 1px solid #fecaca; margin-bottom: 15px; font-weight: bold; text-align: center; font-size: 0.9rem;">
                    ⚠️ ALERTA: Paciente con Inasistencias Recurrentes (${resumen.total_ausentes} ausencias registradas)
                </div>
            ` : '';

            const tableRowsHtml = historial.length === 0 ? `
                <tr>
                    <td colSpan="5" style="padding: 20px; text-align: center; color: #6b7280;">
                        No se registran turnos o consultas para este paciente.
                    </td>
                </tr>
            ` : historial.map(t => {
                const d = new Date(t.fecha_hora_inicio);
                const dia = String(d.getDate()).padStart(2, '0');
                const mes = String(d.getMonth() + 1).padStart(2, '0');
                const anio = d.getFullYear();
                const horas = String(d.getHours()).padStart(2, '0');
                const minutos = String(d.getMinutes()).padStart(2, '0');
                const fechaStr = `${dia}/${mes}/${anio} - ${horas}:${minutos} hs`;

                let badgeStyle = 'background-color: #e5e7eb; color: #374151;';
                const st = (t.estado || '').toLowerCase();
                if (st === 'completado' || st === 'confirmado') {
                    badgeStyle = 'background-color: #dcfce7; color: #166534; font-weight: 700;';
                } else if (st === 'ausente' || st === 'no asistio' || st === 'no asistió') {
                    badgeStyle = 'background-color: #fee2e2; color: #991b1b; font-weight: 700;';
                } else if (st === 'cancelado') {
                    badgeStyle = 'background-color: #f3f4f6; color: #6b7280; font-weight: 600;';
                } else if (st === 'pendiente') {
                    badgeStyle = 'background-color: #fef3c7; color: #92400e; font-weight: 700;';
                }

                const montoFormatted = t.monto_bruto ? `$${Math.round(parseFloat(t.monto_bruto)).toLocaleString('es-AR')} <small style="color: #64748b;">(${t.metodo_pago})</small>` : '-';

                return `
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 10px 12px; text-align: left; font-weight: 600; white-space: nowrap; color: #334155;">${fechaStr}</td>
                        <td style="padding: 10px 12px; text-align: left; white-space: nowrap;">
                            <strong style="color: #1e293b;">Dr/a. ${t.profesional_nombre}</strong><br>
                            <small style="color: #64748b; font-weight: 500;">${t.profesional_especialidad || 'General'}</small>
                        </td>
                        <td style="padding: 10px 12px; text-align: center; white-space: nowrap;">
                            <span style="padding: 4px 10px; border-radius: 12px; font-size: 0.78rem; display: inline-block; white-space: nowrap; ${badgeStyle}">
                                ${t.estado || 'Pendiente'}
                            </span>
                        </td>
                        <td style="padding: 10px 12px; text-align: left; font-size: 0.82rem; color: #475569; max-width: 220px; word-break: break-word;">
                            ${t.motivo_consulta || '-'}
                        </td>
                        <td style="padding: 10px 12px; text-align: right; font-size: 0.85rem; white-space: nowrap; font-weight: 600;">
                            ${montoFormatted}
                        </td>
                    </tr>
                `;
            }).join('');

            Swal.fire({
                title: `📅 Historial de Asistencia - ${paciente.nombre} ${paciente.apellido}`,
                width: '860px',
                html: `
                    <div style="padding: 5px;">
                        ${warningBanner}
                        
                        <!-- Tarjetas de Resumen KPI -->
                        <div style="display: flex; gap: 10px; justify-content: space-around; margin-bottom: 20px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
                            <div style="text-align: center;">
                                <small style="color: #64748b; font-weight: 600;">Total Citas</small>
                                <div style="font-size: 1.3rem; font-weight: bold; color: #1e293b;">${resumen.total_turnos}</div>
                            </div>
                            <div style="text-align: center;">
                                <small style="color: #16a34a; font-weight: 600;">Asistidas</small>
                                <div style="font-size: 1.3rem; font-weight: bold; color: #16a34a;">${resumen.total_asistidos}</div>
                            </div>
                            <div style="text-align: center;">
                                <small style="color: #dc2626; font-weight: 600;">Inasistencias</small>
                                <div style="font-size: 1.3rem; font-weight: bold; color: #dc2626;">${resumen.total_ausentes}</div>
                            </div>
                            <div style="text-align: center;">
                                <small style="color: #64748b; font-weight: 600;">Canceladas</small>
                                <div style="font-size: 1.3rem; font-weight: bold; color: #64748b;">${resumen.total_cancelados}</div>
                            </div>
                            <div style="text-align: center;">
                                <small style="color: #2563eb; font-weight: 600;">% Asistencia</small>
                                <div style="font-size: 1.3rem; font-weight: bold; color: #2563eb;">${parseFloat(resumen.tasa_asistencia).toFixed(0)}%</div>
                            </div>
                        </div>

                        <!-- Tabla de Historial -->
                        <div style="max-height: 380px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px;">
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.88rem;">
                                <thead>
                                    <tr style="background-color: #f1f5f9; border-bottom: 2px solid #cbd5e1; font-weight: bold; position: sticky; top: 0; z-index: 1;">
                                        <th style="padding: 10px 12px; text-align: left; white-space: nowrap; width: 160px;">Fecha Cita</th>
                                        <th style="padding: 10px 12px; text-align: left; white-space: nowrap; width: 180px;">Médico / Esp.</th>
                                        <th style="padding: 10px 12px; text-align: center; white-space: nowrap; width: 120px;">Asistencia</th>
                                        <th style="padding: 10px 12px; text-align: left; width: 220px;">Motivo</th>
                                        <th style="padding: 10px 12px; text-align: right; white-space: nowrap; width: 160px;">Cobro</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${tableRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `,
                confirmButtonText: 'Cerrar',
                confirmButtonColor: '#8b5cf6'
            });

        } catch (error) {
            console.error(error);
            Swal.fire('Error', 'No se pudo obtener el historial de asistencia.', 'error');
        }
    };

    return (
        <div style={{ padding: '4px 0' }}>
            {/* Header */}
            <div className="mod-header">
                <h1 className="mod-title">
                    <span className="mod-title-icon blue">👤</span>
                    Gestión de Pacientes
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="mod-count-chip">📋 {pacientes.length} pacientes</span>
                    {!esMedico && (
                        <Link to="/pacientes/nuevo" className="mod-btn-add">➕ Nuevo Paciente</Link>
                    )}
                </div>
            </div>

            {/* Search */}
            <div className="mod-search-wrap">
                <span className="mod-search-icon">🔍</span>
                <input
                    type="text"
                    placeholder="Buscar por nombre, DNI o email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="mod-table-card">
                <table ref={tableRef}>
                    <thead>
                        <tr>
                            <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('paciente'); }} className="sortable-header">
                                <div className="sort-header-content">Paciente {getSortIcon('paciente')}</div>
                            </th>
                            <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('dni'); }} className="sortable-header">
                                <div className="sort-header-content">DNI {getSortIcon('dni')}</div>
                            </th>
                            <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('telefono'); }} className="sortable-header">
                                <div className="sort-header-content">Teléfono {getSortIcon('telefono')}</div>
                            </th>
                            <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('obra_social'); }} className="sortable-header">
                                <div className="sort-header-content">Obra Social {getSortIcon('obra_social')}</div>
                            </th>
                            <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('email'); }} className="sortable-header">
                                <div className="sort-header-content">Email {getSortIcon('email')}</div>
                            </th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.length > 0 ? paginatedData.map((paciente) => (
                            <tr key={paciente.id}>
                                <td>
                                    <div className="mod-name-chip">
                                        <div className="mod-avatar blue">{getInitials(paciente.nombre, paciente.apellido)}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <span><strong>{paciente.nombre}</strong> {paciente.apellido}</span>
                                            {paciente.total_ausentes >= 2 && (
                                                <span className="mod-badge" style={{ backgroundColor: '#fef2f2', color: '#dc2626', fontWeight: 'bold', fontSize: '0.72rem', borderColor: '#fecaca' }} title={`Este paciente posee ${paciente.total_ausentes} inasistencias registradas`}>
                                                    ⚠️ Alto Ausentismo
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </td>
                                <td>{paciente.dni}</td>
                                <td>{paciente.telefono || '-'}</td>
                                <td>
                                    <span className="mod-badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontWeight: '600' }}>
                                        🏥 {paciente.obra_social || 'Particular'}
                                    </span>
                                </td>
                                <td>{paciente.email}</td>
                                <td>
                                    <div className="mod-actions">
                                        {esMedico ? (
                                            <Link to={`/pacientes/${paciente.id}/historial`} className="mod-btn view">
                                                📋 Historial
                                            </Link>
                                        ) : (
                                            <>
                                                <button onClick={() => handleVerAsistencia(paciente)} className="mod-btn" style={{ backgroundColor: '#8b5cf6', color: 'white', borderColor: '#8b5cf6' }}>
                                                    📅 Asistencia
                                                </button>
                                                <button onClick={() => handleVerPagos(paciente)} className="mod-btn" style={{ backgroundColor: '#10b981', color: 'white', borderColor: '#10b981' }}>
                                                    💳 Pagos
                                                </button>
                                                <Link to={`/pacientes/editar/${paciente.id}`} className="mod-btn edit">
                                                    ✏️ Editar
                                                </Link>
                                                <button className="mod-btn delete" onClick={() => handleDelete(paciente.id)}>
                                                    🗑️ Eliminar
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr className="mod-empty">
                                <td colSpan="6">
                                    <span className="mod-empty-icon">👤</span>
                                    <p>No se encontraron pacientes.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination footer */}
                <div className="mod-pagination">
                    <div className="mod-pagination-info">
                        Mostrando <strong>{sortedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> a <strong>{Math.min(currentPage * itemsPerPage, sortedData.length)}</strong> de <strong>{sortedData.length}</strong> pacientes
                    </div>
                    <div className="mod-pagination-controls">
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                            disabled={currentPage === 1}
                            className="mod-btn edit"
                        >
                            ◀ Anterior
                        </button>
                        <span className="mod-pagination-pages">
                            Página <strong>{currentPage}</strong> de <strong>{totalPages || 1}</strong>
                        </span>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                            disabled={currentPage === totalPages || totalPages === 0}
                            className="mod-btn edit"
                        >
                            Siguiente ▶
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PacientesList;