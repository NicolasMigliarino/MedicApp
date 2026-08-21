import { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import './modules.css';
import useResizableColumns from './useResizableColumns';

const getInitials = (nombre = '', apellido = '') =>
    `${nombre.charAt(0)}${apellido.charAt(0)}`.toUpperCase();

const ProfesionalesList = () => {
    const [profesionales, setProfesionales] = useState([]);
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'nombre', direction: 'asc' });
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;
    const tableRef = useResizableColumns();

    const loadProfesionales = async () => {
        try {
            const res = await axios.get('http://localhost:3000/profesionales');
            setProfesionales(res.data);
        } catch (error) {
            console.error('Error cargando profesionales:', error);
        }
    };

    const handleDelete = async (id) => {
        const result = await Swal.fire({
            title: '¿Estás seguro?',
            text: 'Esta acción eliminará al profesional de forma permanente.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar',
        });
        if (result.isConfirmed) {
            try {
                await axios.delete(`http://localhost:3000/profesionales/${id}`);
                Swal.fire({ icon: 'success', title: 'Eliminado', text: 'El profesional ha sido borrado del sistema.', timer: 1500, showConfirmButton: false });
                loadProfesionales();
            } catch (error) {
                console.error('Error al eliminar:', error);
                Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo eliminar al profesional.' });
            }
        }
    };

    useEffect(() => { loadProfesionales(); }, []);

    // Reset to page 1 on search change
    useEffect(() => {
        setCurrentPage(1);
    }, [search]);

    const filtered = useMemo(() => {
        return profesionales.filter(p =>
            `${p.nombre} ${p.apellido} ${p.matricula} ${p.especialidad}`.toLowerCase().includes(search.toLowerCase())
        );
    }, [profesionales, search]);

    const sortedData = useMemo(() => {
        let sortableItems = [...filtered];
        if (sortConfig.key) {
            sortableItems.sort((a, b) => {
                let aVal, bVal;
                if (sortConfig.key === 'profesional') {
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

    return (
        <div style={{ padding: '4px 0' }}>
            {/* Header */}
            <div className="mod-header">
                <h1 className="mod-title">
                    <span className="mod-title-icon teal">🩺</span>
                    Gestión de Profesionales
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="mod-count-chip">🩺 {profesionales.length} profesionales</span>
                    <Link to="/profesionales/nuevo" className="mod-btn-add">➕ Nuevo Profesional</Link>
                </div>
            </div>

            {/* Search */}
            <div className="mod-search-wrap">
                <span className="mod-search-icon">🔍</span>
                <input
                    type="text"
                    placeholder="Buscar por nombre, matrícula o especialidad..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Table */}
            <div className="mod-table-card">
                <table ref={tableRef}>
                    <thead>
                        <tr>
                            <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('profesional'); }} className="sortable-header">
                                <div className="sort-header-content">Profesional {getSortIcon('profesional')}</div>
                            </th>
                            <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('matricula'); }} className="sortable-header">
                                <div className="sort-header-content">Matrícula {getSortIcon('matricula')}</div>
                            </th>
                            <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('especialidad'); }} className="sortable-header">
                                <div className="sort-header-content">Especialidad {getSortIcon('especialidad')}</div>
                            </th>
                            <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('porcentaje_retencion'); }} className="sortable-header">
                                <div className="sort-header-content">% Ret. Centro {getSortIcon('porcentaje_retencion')}</div>
                            </th>
                            <th onClick={(e) => { if (e.target.classList.contains('col-resize-handle')) return; requestSort('email'); }} className="sortable-header">
                                <div className="sort-header-content">Contacto {getSortIcon('email')}</div>
                            </th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.length > 0 ? paginatedData.map((prof) => (
                            <tr key={prof.id}>
                                <td>
                                    <div className="mod-name-chip">
                                        <div className="mod-avatar teal">{getInitials(prof.nombre, prof.apellido)}</div>
                                        <span><strong>Dr. {prof.nombre}</strong> {prof.apellido}</span>
                                    </div>
                                </td>
                                <td><span className="mod-code">{prof.matricula}</span></td>
                                <td><span className="mod-specialty">{prof.especialidad}</span></td>
                                <td>
                                    <span className="mod-badge" style={{ backgroundColor: '#fef2f2', color: '#991b1b', fontWeight: 'bold' }}>
                                        {prof.porcentaje_retencion ? `${parseFloat(prof.porcentaje_retencion).toFixed(0)}%` : '20%'}
                                    </span>
                                </td>
                                <td style={{ fontSize: '0.83rem' }}>{prof.email || prof.telefono || '-'}</td>
                                <td>
                                    <div className="mod-actions">
                                        <Link to={`/profesionales/editar/${prof.id}`} className="mod-btn edit">
                                            ✏️ Editar
                                        </Link>
                                        <button className="mod-btn delete" onClick={() => handleDelete(prof.id)}>
                                            🗑️ Eliminar
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr className="mod-empty">
                                <td colSpan="6">
                                    <span className="mod-empty-icon">🩺</span>
                                    <p>No se encontraron profesionales.</p>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>

                {/* Pagination footer */}
                <div className="mod-pagination">
                    <div className="mod-pagination-info">
                        Mostrando <strong>{sortedData.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</strong> a <strong>{Math.min(currentPage * itemsPerPage, sortedData.length)}</strong> de <strong>{sortedData.length}</strong> profesionales
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

export default ProfesionalesList;