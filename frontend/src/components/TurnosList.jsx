import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import esES from 'date-fns/locale/es';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './modules.css';
import useResizableColumns from './useResizableColumns';
import { getUserRole } from '../utils/auth';

const locales = {
    'es': esES,
};

const localizer = dateFnsLocalizer({
    format,
    parse,
    startOfWeek,
    getDay,
    locales,
});

const getInitials = (nombre = '', apellido = '') =>
    `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();

const getBadgeClass = (estado = '') => {
    const map = {
        confirmado: 'confirmado',
        pendiente: 'pendiente',
        cancelado: 'cancelado',
        completado: 'completado',
    };
    return map[estado?.toLowerCase()] ?? 'default';
};

const formatearHorario = (fechaInicio, fechaFin) => {
    if (!fechaInicio || !fechaFin) return '';
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);
    const fechaStr = inicio.toLocaleDateString('es-AR');
    const opts = { hour: '2-digit', minute: '2-digit' };
    return `${fechaStr} | ${inicio.toLocaleTimeString('es-AR', opts)} – ${fin.toLocaleTimeString('es-AR', opts)}`;
};

const TurnosList = () => {
    const [turnos, setTurnos] = useState([]);
    const [selectedTurnos, setSelectedTurnos] = useState([]);
    const [search, setSearch] = useState('');
    const [viewMode, setViewMode] = useState('list'); // 'list' o 'calendar'
    const [sortConfig, setSortConfig] = useState({ key: 'fecha_hora_inicio', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const [calendarDate, setCalendarDate] = useState(new Date());
    const [calendarView, setCalendarView] = useState('month');
    const itemsPerPage = 10;
    const tableRef = useResizableColumns();
    const navigate = useNavigate();

    const userRole = getUserRole();

    const loadTurnos = async () => {
        try {
            const res = await axios.get('http://localhost:3000/turnos');
            setTurnos(res.data);
        } catch (error) {
            console.error('Error cargando turnos:', error);
        }
    };

    const handleEnviarMail = async (id) => {
        try {
            Swal.fire({
                title: 'Enviando...',
                text: 'Por favor espera mientras enviamos el correo de confirmación.',
                allowOutsideClick: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            await axios.post(`http://localhost:3000/turnos/${id}/enviar-email`);
            Swal.fire({
                icon: 'success',
                title: '¡Enviado!',
                text: 'El correo de confirmación se envió al paciente.',
                timer: 2000,
                showConfirmButton: false
            });
            loadTurnos();
        } catch (error) {
            console.error(error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.message || 'No se pudo enviar el correo de confirmación.'
            });
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: 'Esta acción cancelará y eliminará el turno de forma permanente.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
        });
        if (result.isConfirmed) {
            try {
                await axios.delete(`http://localhost:3000/turnos/${id}`);
                Swal.fire({ icon: 'success', title: 'Eliminado', text: 'El turno ha sido eliminado.', timer: 1500, showConfirmButton: false });
                loadTurnos();
            } catch (error) {
                console.error(error);
                Swal.fire({ icon: 'error', title: 'Error', text: 'Error al eliminar el turno.' });
            }
        }
    };

    // 👇 NUEVA FUNCIÓN: El motor de cobro en recepción
    // 👇 FUNCIÓN DE COBRO (Mejorada visualmente)
    const handleSelectTurno = (turno, isChecked) => {
        if (isChecked) {
            setSelectedTurnos(prev => [...prev, turno.id]);
        } else {
            setSelectedTurnos(prev => prev.filter(id => id !== turno.id));
        }
    };

    const handleCobrarTurno = async (turno_id) => {
        // 1. Abrimos el popup interactivo sin barras de desplazamiento y con soporte de comprobante
        const { value: formValues } = await Swal.fire({
            title: '💰 Registrar Pago',
            html: `
                <div style="padding: 5px 10px; overflow: hidden;">
                    <label style="text-align: left; display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Monto Abonado ($)</label>
                    <input id="swal-input-monto" type="number" class="form-control" placeholder="Ej: 15000" style="margin-bottom: 20px;">
                    
                    <label style="text-align: left; display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Método de Pago</label>
                    <select id="swal-input-metodo" class="form-select" style="margin-bottom: 20px;" onchange="
                        const val = this.value;
                        const block = document.getElementById('comprobante-upload-block');
                        if (val === 'Transferencia' || val === 'MercadoPago') {
                            block.style.display = 'block';
                        } else {
                            block.style.display = 'none';
                        }
                    ">
                        <option value="Efectivo">💵 Efectivo</option>
                        <option value="MercadoPago">📱 MercadoPago / QR</option>
                        <option value="Transferencia">🏦 Transferencia Bancaria</option>
                        <option value="Tarjeta Debito">💳 Tarjeta de Débito</option>
                        <option value="Tarjeta Credito">💳 Tarjeta de Crédito</option>
                        <option value="Obra Social">🏥 Cubierto por Obra Social</option>
                    </select>

                    <div id="comprobante-upload-block" style="display: none; text-align: left;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Adjuntar Comprobante</label>
                        <input id="swal-input-comprobante" type="file" class="form-control" style="margin-bottom: 20px;">
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '✅ Confirmar Pago',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#10b981', // Verde moderno
            preConfirm: () => {
                const monto = document.getElementById('swal-input-monto').value;
                const metodo = document.getElementById('swal-input-metodo').value;
                const fileInput = document.getElementById('swal-input-comprobante');
                const file = fileInput ? fileInput.files[0] : null;

                if (!monto || monto <= 0) {
                    Swal.showValidationMessage('Por favor, ingresá un monto válido.');
                    return false;
                }
                if ((metodo === 'Transferencia' || metodo === 'MercadoPago') && !file) {
                    Swal.showValidationMessage('Los pagos por transferencia o MercadoPago requieren adjuntar el comprobante.');
                    return false;
                }
                return { monto: parseFloat(monto), metodo_pago: metodo, comprobante: file };
            }
        });

        // 2. Si la secretaria le dio a "Confirmar", enviamos todo al Backend
        if (formValues) {
            try {
                const formData = new FormData();
                formData.append('monto', formValues.monto);
                formData.append('metodo_pago', formValues.metodo_pago);
                if (formValues.comprobante) {
                    formData.append('comprobante', formValues.comprobante);
                }

                const response = await axios.post(`http://localhost:3000/turnos/${turno_id}/pagar`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                const { comprobante_url } = response.data;

                Swal.fire({
                    icon: 'success',
                    title: '¡Pago Registrado!',
                    html: `El turno pasó a estado Confirmado automáticamente.<br>${comprobante_url ? `<a href="http://localhost:3000${comprobante_url}" target="_blank" class="mod-btn" style="display: inline-block; margin-top: 15px; padding: 8px 16px; background-color: #10b981; color: white; text-decoration: none; border-radius: 4px; border: none; font-weight: bold;">🖨️ Imprimir Recibo</a>` : ''}`,
                    showConfirmButton: true
                });

                // 3. Recargamos la lista
                loadTurnos();

            } catch (error) {
                console.error(error);
                Swal.fire('Error', 'No se pudo registrar el pago.', 'error');
            }
        }
    };

    const handleCobrarMultiples = async () => {
        if (selectedTurnos.length === 0) return;

        // 1. Abrimos el popup interactivo
        const { value: formValues } = await Swal.fire({
            title: '💰 Registrar Pago de Turnos Seleccionados',
            html: `
                <div style="padding: 5px 10px; overflow: hidden;">
                    <p style="margin-bottom: 15px; font-size: 0.9rem; color: #6b7280; text-align: left;">
                        Estás cobrando <strong>${selectedTurnos.length}</strong> turnos en lote.
                    </p>
                    <label style="text-align: left; display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Monto Total Abonado ($)</label>
                    <input id="swal-input-monto" type="number" class="form-control" placeholder="Ej: 45000" style="margin-bottom: 20px;">
                    
                    <label style="text-align: left; display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Método de Pago</label>
                    <select id="swal-input-metodo" class="form-select" style="margin-bottom: 20px;" onchange="
                        const val = this.value;
                        const block = document.getElementById('comprobante-upload-block');
                        if (val === 'Transferencia' || val === 'MercadoPago') {
                            block.style.display = 'block';
                        } else {
                            block.style.display = 'none';
                        }
                    ">
                        <option value="Efectivo">💵 Efectivo</option>
                        <option value="MercadoPago">📱 MercadoPago / QR</option>
                        <option value="Transferencia">🏦 Transferencia Bancaria</option>
                        <option value="Tarjeta Debito">💳 Tarjeta de Débito</option>
                        <option value="Tarjeta Credito">💳 Tarjeta de Crédito</option>
                        <option value="Obra Social">🏥 Cubierto por Obra Social</option>
                    </select>

                    <div id="comprobante-upload-block" style="display: none; text-align: left;">
                        <label style="display: block; margin-bottom: 8px; font-weight: 600; color: #374151;">Adjuntar Comprobante</label>
                        <input id="swal-input-comprobante" type="file" class="form-control" style="margin-bottom: 20px;">
                    </div>
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '✅ Confirmar Pago Lote',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#10b981',
            preConfirm: () => {
                const monto = document.getElementById('swal-input-monto').value;
                const metodo = document.getElementById('swal-input-metodo').value;
                const fileInput = document.getElementById('swal-input-comprobante');
                const file = fileInput ? fileInput.files[0] : null;

                if (!monto || monto <= 0) {
                    Swal.showValidationMessage('Por favor, ingresá un monto total válido.');
                    return false;
                }
                if ((metodo === 'Transferencia' || metodo === 'MercadoPago') && !file) {
                    Swal.showValidationMessage('Los pagos por transferencia o MercadoPago requieren adjuntar el comprobante.');
                    return false;
                }
                return { monto: parseFloat(monto), metodo_pago: metodo, comprobante: file };
            }
        });

        if (formValues) {
            try {
                const formData = new FormData();
                formData.append('monto', formValues.monto);
                formData.append('metodo_pago', formValues.metodo_pago);
                formData.append('turno_ids', JSON.stringify(selectedTurnos));
                if (formValues.comprobante) {
                    formData.append('comprobante', formValues.comprobante);
                }

                const response = await axios.post(`http://localhost:3000/turnos/pagar-multiples`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                const { comprobante_url } = response.data;

                Swal.fire({
                    icon: 'success',
                    title: '¡Pagos Registrados!',
                    html: `Se registraron los cobros y los turnos fueron Confirmados.<br>${comprobante_url ? `<a href="http://localhost:3000${comprobante_url}" target="_blank" class="mod-btn" style="display: inline-block; margin-top: 15px; padding: 8px 16px; background-color: #10b981; color: white; text-decoration: none; border-radius: 4px; border: none; font-weight: bold;">🖨️ Imprimir Recibo Lote</a>` : ''}`,
                    showConfirmButton: true
                });

                setSelectedTurnos([]);
                loadTurnos();
            } catch (error) {
                console.error(error);
                Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.message || 'No se pudieron registrar los pagos.' });
            }
        }
    };

    useEffect(() => { loadTurnos(); }, []);

    // Reset to page 1 on search change
    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    const filtered = useMemo(() => {
        return turnos.filter(t =>
            `${t.paciente_nombre} ${t.paciente_apellido} ${t.profesional_nombre} ${t.profesional_apellido} ${t.estado}`.toLowerCase().includes(search.toLowerCase())
        );
    }, [turnos, search]);

    const sortedData = useMemo(() => {
        let sortableItems = [...filtered];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aVal, bVal;

                if (sortConfig.key === 'paciente') {
                    aVal = `${a.paciente_nombre} ${a.paciente_apellido}`.toLowerCase();
                    bVal = `${b.paciente_nombre} ${b.paciente_apellido}`.toLowerCase();
                } else if (sortConfig.key === 'profesional') {
                    aVal = `${a.profesional_nombre} ${a.profesional_apellido}`.toLowerCase();
                    bVal = `${b.profesional_nombre} ${b.profesional_apellido}`.toLowerCase();
                } else if (sortConfig.key === 'fecha_hora_inicio') {
                    aVal = new Date(a.fecha_hora_inicio || 0).getTime();
                    bVal = new Date(b.fecha_hora_inicio || 0).getTime();
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

    // Mapeo de turnos para react-big-calendar
    const eventosCalendario = useMemo(() => {
        return turnos.map(t => ({
            id: t.id,
            title: `${t.paciente_nombre} ${t.paciente_apellido} (${t.estado})`,
            start: new Date(t.fecha_hora_inicio),
            end: new Date(t.fecha_hora_fin),
            resource: t
        }));
    }, [turnos]);

    // Personalizar el aspecto y color de los eventos en el calendario
    const eventPropGetter = (event) => {
        let bgColor = '#e5e7eb'; // Default gray
        let color = '#374151';

        const estado = event.resource?.estado?.toLowerCase();

        switch (estado) {
            case 'confirmado':
                bgColor = '#dbeafe'; color = '#1d4ed8'; break;
            case 'pendiente':
                bgColor = '#fef3c7'; color = '#92400e'; break;
            case 'completado':
                bgColor = '#d1fae5'; color = '#065f46'; break;
            case 'cancelado':
                bgColor = '#fee2e2'; color = '#b91c1c'; break;
            default: break;
        }

        return {
            style: {
                backgroundColor: bgColor,
                color: color,
                border: 'none',
                borderRadius: '6px',
                fontWeight: '600',
                fontSize: '0.8rem',
                padding: '2px 6px'
            }
        };
    };

    const handleSelectEvent = (event) => {
        navigate(`/turnos/editar/${event.id}`);
    };

    const handleSelectSlot = ({ start }) => {
        if (userRole?.toUpperCase() !== 'MEDICO') {
            navigate('/turnos/nuevo', { state: { selectedDate: start } });
        }
    };
    return (
        <div style={{ padding: '4px 0' }}>
            {/* Header */}
            <div className="mod-header">
                <h1 className="mod-title">
                    <span className="mod-title-icon orange">📅</span>
                    Gestión de Turnos
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="mod-count-chip">📅 {turnos.length} turnos</span>
                    {userRole?.toUpperCase() !== 'MEDICO' && (
                        <Link to="/turnos/nuevo" className="mod-btn-add">➕ Agendar Turno</Link>
                    )}
                </div>
            </div>

            {/* Toggle Vista Lista / Calendario */}
            <div className="view-toggle" style={{ marginBottom: '16px', display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => setViewMode('list')}
                    className={`mod-btn ${viewMode === 'list' ? 'active' : ''}`}
                    style={{ padding: '8px 16px', background: viewMode === 'list' ? '#1a73e8' : '#fff', color: viewMode === 'list' ? '#fff' : '#6b7280', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                    📋 Lista
                </button>
                <button
                    onClick={() => setViewMode('calendar')}
                    className={`mod-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                    style={{ padding: '8px 16px', background: viewMode === 'calendar' ? '#1a73e8' : '#fff', color: viewMode === 'calendar' ? '#fff' : '#6b7280', border: '1px solid #e2e8f0', borderRadius: '10px' }}>
                    🗓️ Calendario
                </button>
            </div>

            {viewMode === 'list' ? (
                <>
                    {/* Search */}
                    <div className="mod-search-wrap">
                        <span className="mod-search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar por paciente, profesional o estado..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Table */}
                    <div className="mod-table-card">
                        <table ref={tableRef}>
                            <thead>
                                <tr>
                                    {userRole?.toUpperCase() !== 'MEDICO' && (
                                        <th style={{ width: '130px', textAlign: 'center' }}>
                                            {selectedTurnos.length > 0 ? (
                                                <button 
                                                    onClick={handleCobrarMultiples}
                                                    className="mod-btn"
                                                    style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#10b981', color: 'white', border: 'none', fontWeight: 'bold' }}
                                                >
                                                    💰 Cobrar ({selectedTurnos.length})
                                                </button>
                                            ) : (
                                                'Seleccionar'
                                            )}
                                        </th>
                                    )}
                                    <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('paciente'); }} className="sortable-header">
                                        <div className="sort-header-content">Paciente {getSortIcon('paciente')}</div>
                                    </th>
                                    <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('profesional'); }} className="sortable-header">
                                        <div className="sort-header-content">Profesional {getSortIcon('profesional')}</div>
                                    </th>
                                    <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('fecha_hora_inicio'); }} className="sortable-header">
                                        <div className="sort-header-content">Fecha y Horario {getSortIcon('fecha_hora_inicio')}</div>
                                    </th>
                                    <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('estado'); }} className="sortable-header">
                                        <div className="sort-header-content">Estado {getSortIcon('estado')}</div>
                                    </th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedData.length > 0 ? paginatedData.map((turno) => (
                                    <tr key={turno.id}>
                                        {userRole?.toUpperCase() !== 'MEDICO' && (
                                            <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                                                {turno.estado?.toLowerCase() === 'pendiente' && (
                                                    <input 
                                                        type="checkbox"
                                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                                        checked={selectedTurnos.includes(turno.id)}
                                                        onChange={(e) => handleSelectTurno(turno, e.target.checked)}
                                                        disabled={selectedTurnos.length > 0 && selectedTurnos.some(id => {
                                                            const selTurno = turnos.find(t => t.id === id);
                                                            return selTurno && selTurno.paciente_id !== turno.paciente_id;
                                                        })}
                                                    />
                                                )}
                                            </td>
                                        )}
                                        <td>
                                            <div className="mod-name-chip">
                                                <div className="mod-avatar blue">{getInitials(turno.paciente_nombre, turno.paciente_apellido)}</div>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span>{turno.paciente_nombre} {turno.paciente_apellido}</span>
                                                    {turno.recordatorio_enviado ? (
                                                        <span style={{ fontSize: '0.73rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                                            ✉️ Email Enviado
                                                        </span>
                                                    ) : (
                                                        <span style={{ fontSize: '0.73rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                                                            ✉️ Sin Notificar
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="mod-name-chip">
                                                <div className="mod-avatar teal">{getInitials(turno.profesional_nombre, turno.profesional_apellido)}</div>
                                                <span>Dr. {turno.profesional_nombre} {turno.profesional_apellido}</span>
                                            </div>
                                        </td>
                                        <td style={{ fontSize: '0.83rem' }}>
                                            {formatearHorario(turno.fecha_hora_inicio, turno.fecha_hora_fin)}
                                        </td>
                                        <td>
                                            <span className={`mod-badge ${getBadgeClass(turno.estado)}`}>
                                                {turno.estado?.toLowerCase() === 'confirmado' ? '✅ Confirmado (Pagado)' : (turno.estado || 'Pendiente')}
                                            </span>
                                        </td>
                                        <td>
                                            {/* 👇 SECCIÓN DE ACCIONES ACTUALIZADA 👇 */}
                                            <div className="mod-actions" style={{ display: 'flex', gap: '5px' }}>
                                                {/* Botón de Enviar Mail: Solo si está pendiente y el rol no es PROFESIONAL */}
                                                {turno.estado?.toLowerCase() === 'pendiente' && userRole?.toUpperCase() !== 'MEDICO' && (
                                                    <button
                                                        onClick={() => handleEnviarMail(turno.id)}
                                                        className="mod-btn"
                                                        style={{ backgroundColor: '#3b82f6', color: 'white', borderColor: '#3b82f6' }}
                                                        title="Enviar Email de Confirmación"
                                                    >
                                                        ✉️ Mail
                                                    </button>
                                                )}
                                                {/* Botón de Cobrar: Solo aparece si está pendiente y el rol no es PROFESIONAL */}
                                                {turno.estado?.toLowerCase() === 'pendiente' && userRole?.toUpperCase() !== 'MEDICO' && (
                                                    <button
                                                        onClick={() => handleCobrarTurno(turno.id)}
                                                        className="mod-btn"
                                                        style={{ backgroundColor: '#10b981', color: 'white', borderColor: '#10b981' }}
                                                        title="Registrar Pago y Confirmar"
                                                    >
                                                        💰 Cobrar
                                                    </button>
                                                )}
                                                {/* Enlace al Comprobante si ya fue cobrado */}
                                                {turno.comprobante_url && (
                                                    <a
                                                        href={`http://localhost:3000${turno.comprobante_url}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="mod-btn"
                                                        style={{ backgroundColor: '#0f766e', color: 'white', borderColor: '#0f766e', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                                        title="Ver Comprobante de Pago"
                                                    >
                                                        📄 Recibo
                                                    </a>
                                                )}
                                                <Link to={`/turnos/editar/${turno.id}`} className="mod-btn edit">
                                                    ✏️ Editar
                                                </Link>
                                                <button className="mod-btn delete" onClick={() => handleDelete(turno.id)}>
                                                    🗑️ Eliminar
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr className="mod-empty">
                                        <td colSpan={userRole?.toUpperCase() !== 'MEDICO' ? 6 : 5}>
                                            <span className="mod-empty-icon">📅</span>
                                            <p>No se encontraron turnos.</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Pagination footer */}
                        <div className="mod-pagination">
                            <div className="mod-pagination-info">
                                Mostrando <strong>{sortedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> a <strong>{Math.min(currentPage * itemsPerPage, sortedData.length)}</strong> de <strong>{sortedData.length}</strong> turnos
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
                </>
            ) : (
                /* Vista de Calendario */
                <div className="mod-table-card mod-calendar-wrapper" style={{ padding: '24px', height: '650px', background: '#fff' }}>
                    <Calendar
                        localizer={localizer}
                        events={eventosCalendario}
                        startAccessor="start"
                        endAccessor="end"
                        culture="es"
                        date={calendarDate}
                        view={calendarView}
                        onNavigate={(date) => setCalendarDate(date)}
                        onView={(view) => setCalendarView(view)}
                        messages={{
                            next: "Siguiente",
                            previous: "Anterior",
                            today: "Hoy",
                            month: "Mes",
                            week: "Semana",
                            day: "Día",
                            agenda: "Agenda",
                            date: "Fecha",
                            time: "Hora",
                            event: "Turno",
                            noEventsInRange: "No hay turnos agendados en este periodo."
                        }}
                        eventPropGetter={eventPropGetter}
                        onSelectEvent={handleSelectEvent}
                        onSelectSlot={handleSelectSlot}
                        selectable
                        popup
                    />
                </div>
            )}
        </div>
    );
};

export default TurnosList;