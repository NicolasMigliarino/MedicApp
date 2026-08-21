import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { es } from 'date-fns/locale/es';
import './forms.css';
import { API_URL } from '../config';

registerLocale('es', es);

const PacientesForm = () => {
    const navigate = useNavigate();
    const { id } = useParams();
    const isEditing = !!id;

    const [formData, setFormData] = useState({
        nombre: '',
        apellido: '',
        dni: '',
        email: '',
        telefono: '',
        fecha_nacimiento: '',
        obra_social_id: '',
        numero_afiliado: '',
        fecha_alta: '',
        sexo: '',
        grupo_sanguineo: '',
        direccion: '',
        contacto_emergencia: '',
        alergias: ''
    });

    const [obrasSociales, setObrasSociales] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDropdown, setShowDropdown] = useState(false);

    // 👇 NUEVOS ESTADOS PARA LOS ARCHIVOS
    const [archivos, setArchivos] = useState([]);
    const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);    useEffect(() => {
        const loadObrasSociales = async () => {
            try {
                const response = await axios.get(`${API_URL}/obras-sociales`);
                setObrasSociales(response.data);
            } catch (error) {
                console.error('Error al cargar obras sociales:', error);
            }
        };
        loadObrasSociales();
    }, []);

    useEffect(() => {
        const loadPaciente = async () => {
            if (id) {
                try {
                    const response = await axios.get(`${API_URL}/pacientes/${id}`);
                    const pacienteData = response.data;

                    if (pacienteData.fecha_nacimiento) {
                        pacienteData.fecha_nacimiento = pacienteData.fecha_nacimiento.split('T')[0];
                    }

                    // Fallbacks para campos clínicos
                    pacienteData.sexo = pacienteData.sexo || '';
                    pacienteData.grupo_sanguineo = pacienteData.grupo_sanguineo || '';
                    pacienteData.direccion = pacienteData.direccion || '';
                    pacienteData.contacto_emergencia = pacienteData.contacto_emergencia || '';
                    pacienteData.alergias = pacienteData.alergias || '';

                    setFormData(pacienteData);
                    
                    if (pacienteData.obra_social_nombre) {
                        setSearchTerm(pacienteData.obra_social_nombre);
                    } else if (pacienteData.obra_social && !/^\d+$/.test(String(pacienteData.obra_social).trim())) {
                        setSearchTerm(pacienteData.obra_social);
                    }

                    // CARGAR LA LISTA DE ARCHIVOS DEL PACIENTE
                    const resArchivos = await axios.get(`${API_URL}/archivos/${id}`);
                    setArchivos(resArchivos.data);

                } catch (error) {
                    Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el paciente.' });
                }
            }
        };
        loadPaciente();
    }, [id]);

    // Manejador de cambios genérico para inputs de texto, números y selects estándar
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Formatea la fecha seleccionada del DatePicker al formato YYYY-MM-DD compatible con la BD
    const handleDateChange = (date) => {
        if (!date) {
            setFormData({ ...formData, fecha_nacimiento: '' });
            return;
        }
        const pad = (n) => String(n).padStart(2, '0');
        const value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
        setFormData({ ...formData, fecha_nacimiento: value });
    };

    // Parsea un string de fecha YYYY-MM-DD para inicializar correctamente el DatePicker en el UI
    const getParsedDate = (dateStr) => {
        if (!dateStr) return null;
        const [year, month, day] = dateStr.split('-');
        if (year && month && day) {
            return new Date(year, month - 1, day);
        }
        return null;
    };

    // Sube archivos de estudios médicos asociados al paciente mediante Axios
    const handleUploadArchivo = async () => {
        if (!archivoSeleccionado) {
            return Swal.fire({ icon: 'warning', title: 'Atención', text: 'Seleccioná un archivo primero.' });
        }

        const data = new FormData();
        data.append('archivo', archivoSeleccionado);
        data.append('paciente_id', id);

        try {
            await axios.post(`${API_URL}/archivos`, data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            Swal.fire({ icon: 'success', title: '¡Subido!', text: 'El estudio se guardó correctamente.', timer: 1500, showConfirmButton: false });
            setArchivoSeleccionado(null);
            document.getElementById('fileInput').value = ''; 
            
            // Recargar la lista de archivos para mostrar el nuevo
            const resArchivos = await axios.get(`${API_URL}/archivos/${id}`);
            setArchivos(resArchivos.data);
            
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo subir el archivo.' });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Resolver ID de Obra Social según el término tipeado o seleccionado
            let finalObraSocialId = formData.obra_social_id;
            if (searchTerm && searchTerm.trim() !== '') {
                const matched = obrasSociales.find(o => o.nombre.toLowerCase().trim() === searchTerm.toLowerCase().trim());
                if (matched) {
                    finalObraSocialId = matched.id;
                }
            }

            const payload = {
                ...formData,
                obra_social_id: finalObraSocialId === '' ? null : finalObraSocialId
            };

            if (isEditing) {
                await axios.put(`${API_URL}/pacientes/${id}`, payload);
                Swal.fire({ icon: 'success', title: '¡Actualizado!', text: 'Paciente actualizado con éxito.', timer: 1500, showConfirmButton: false });
            } else {
                await axios.post(`${API_URL}/pacientes`, payload);
                Swal.fire({ icon: 'success', title: '¡Registrado!', text: 'Paciente registrado con éxito.', timer: 1500, showConfirmButton: false });
            }
            setTimeout(() => navigate('/pacientes'), 1600);
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: 'error', title: 'Error', text: 'Ocurrió un error al guardar.' });
        }
    };

    // useMemo optimiza el filtrado del dropdown de obras sociales para evitar recálculos en renders innecesarios
    const filteredObras = useMemo(() => {
        return obrasSociales.filter(obra =>
            obra.nombre.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [obrasSociales, searchTerm]);

    return (
        <div className="form-page">
            <div className="form-container-layout">
                <div className="form-card-wrapper">
                    <div className="form-card">
                        <div className="form-card-header blue">
                            <div className="form-header-icon blue">👤</div>
                            <div className="form-header-text">
                                <h2>{isEditing ? 'Editar Paciente' : 'Registrar Nuevo Paciente'}</h2>
                                <p>{isEditing ? 'Actualizá los datos y estudios del paciente' : 'Completá el formulario para agregar un paciente'}</p>
                            </div>
                        </div>

                        <div className="form-card-body">
                            {formData.alergias && formData.alergias.trim() !== '' && (
                                <div className="premium-warning-banner">
                                    <span className="premium-warning-icon">⚠️</span>
                                    <div className="premium-warning-text">
                                        <strong>ATENCIÓN CLÍNICA - ALERGIAS REGISTRADAS:</strong>
                                        <p>{formData.alergias}</p>
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleSubmit}>
                                <div className="form-section-label">Datos Personales</div>
                                <div className="form-row cols-2">
                                    <div className="form-group">
                                        <label className="form-label-custom">Nombre <span className="required">*</span></label>
                                        <input className="form-input" type="text" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Ej: María" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label-custom">Apellido <span className="required">*</span></label>
                                        <input className="form-input" type="text" name="apellido" value={formData.apellido} onChange={handleChange} placeholder="Ej: González" required />
                                    </div>
                                </div>
                                <div className="form-row cols-2">
                                    <div className="form-group">
                                        <label className="form-label-custom">DNI <span className="required">*</span></label>
                                        <input className="form-input" type="text" name="dni" value={formData.dni} onChange={handleChange} placeholder="Ej: 30123456" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label-custom">Fecha de Nacimiento <span className="required">*</span></label>
                                        <div className="datepicker-wrapper" style={{ width: '100%' }}>
                                            <DatePicker
                                                selected={getParsedDate(formData.fecha_nacimiento)}
                                                onChange={handleDateChange}
                                                dateFormat="dd/MM/yyyy"
                                                className="form-input"
                                                placeholderText="Selecciona la fecha..."
                                                locale="es"
                                                showMonthDropdown
                                                showYearDropdown
                                                dropdownMode="select"
                                                maxDate={new Date()}
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-section-label">Contacto</div>
                                <div className="form-row cols-2">
                                    <div className="form-group">
                                        <label className="form-label-custom">Email <span className="required">*</span></label>
                                        <input className="form-input" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="correo@email.com" required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label-custom">Teléfono Celular</label>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <div className="phone-prefix-addon">
                                                🇦🇷 +54 9
                                            </div>
                                            <input 
                                                className="form-input" 
                                                type="tel" 
                                                name="telefono" 
                                                value={formData.telefono} 
                                                onChange={handleChange} 
                                                placeholder="11 1234-5678" 
                                                style={{ paddingLeft: '100px' }} 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="form-section-label">Obra Social</div>
                                <div className="form-row cols-2">
                                    <div className="form-group" style={{ position: 'relative' }}>
                                        <label className="form-label-custom">Obra Social</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder="🔍 Buscar obra social..."
                                            value={searchTerm}
                                            onChange={(e) => {
                                                setSearchTerm(e.target.value);
                                                setShowDropdown(true);
                                                if (e.target.value === '') setFormData({ ...formData, obra_social_id: null });
                                            }}
                                            onFocus={() => setShowDropdown(true)}
                                            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                                        />
                                        {showDropdown && (
                                            <ul className="dropdown-list shadow" style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000, background: 'white', maxHeight: '200px', overflowY: 'auto', listStyle: 'none', padding: 0, margin: 0, border: '1px solid #ccc', borderRadius: '4px' }}>
                                                {filteredObras.length > 0 ? filteredObras.map(obra => (
                                                    <li
                                                        key={obra.id}
                                                        style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
                                                        onMouseDown={() => {
                                                            setFormData({ ...formData, obra_social_id: obra.id });
                                                            setSearchTerm(obra.nombre);
                                                            setShowDropdown(false);
                                                        }}
                                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f0f8ff'}
                                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'white'}
                                                    >
                                                        {obra.nombre}
                                                    </li>
                                                )) : (
                                                    <li style={{ padding: '10px', color: '#888' }}>No se encontraron resultados</li>
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label-custom">N° Afiliado</label>
                                        <input className="form-input" type="text" name="numero_afiliado" value={formData.numero_afiliado} onChange={handleChange} placeholder="Ej: 12345678" />
                                    </div>
                                </div>

                                <div className="form-section-label">Información Clínica Avanzada</div>
                                <div className="form-row cols-2">
                                    <div className="form-group">
                                        <label className="form-label-custom">Sexo / Género</label>
                                        <div className="form-select-wrap">
                                            <select className="form-select-custom" name="sexo" value={formData.sexo} onChange={handleChange}>
                                                <option value="">Seleccione...</option>
                                                <option value="Femenino">👩 Femenino</option>
                                                <option value="Masculino">👨 Masculino</option>
                                                <option value="Otro">🌈 Otro</option>
                                                <option value="No especifica">⚪ No especifica</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label-custom">Grupo Sanguíneo y Factor</label>
                                        <div className="form-select-wrap">
                                            <select className="form-select-custom" name="grupo_sanguineo" value={formData.grupo_sanguineo} onChange={handleChange}>
                                                <option value="">Seleccione...</option>
                                                <option value="0+">🩸 0+</option>
                                                <option value="0-">🩸 0-</option>
                                                <option value="A+">🩸 A+</option>
                                                <option value="A-">🩸 A-</option>
                                                <option value="B+">🩸 B+</option>
                                                <option value="B-">🩸 B-</option>
                                                <option value="AB+">🩸 AB+</option>
                                                <option value="AB-">🩸 AB-</option>
                                                <option value="No sabe">⚪ No sabe</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                <div className="form-row cols-2">
                                    <div className="form-group">
                                        <label className="form-label-custom">Domicilio / Dirección</label>
                                        <input className="form-input" type="text" name="direccion" value={formData.direccion} onChange={handleChange} placeholder="Ej: Av. Santa Fe 1234, CABA" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label-custom">Contacto de Emergencia</label>
                                        <input className="form-input" type="text" name="contacto_emergencia" value={formData.contacto_emergencia} onChange={handleChange} placeholder="Ej: Juan Pérez (Esposo) - 11 9876-5432" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label-custom">¿Posee Alergias Conocidas?</label>
                                    <textarea className="form-textarea" name="alergias" value={formData.alergias} onChange={handleChange} placeholder="Ej: Alérgico a la penicilina y dipirona. Dejar en blanco si no posee." />
                                </div>

                                {/* Footer Principal */}
                                <div className="form-footer" style={{ borderBottom: isEditing ? '1px solid #eee' : 'none', paddingBottom: isEditing ? '20px' : '0', marginBottom: isEditing ? '20px' : '0' }}>
                                    <Link to="/pacientes" className="form-btn-cancel">← Cancelar</Link>
                                    <button type="submit" className="form-btn-submit">
                                        {isEditing ? '💾 Actualizar Paciente' : '✅ Guardar Paciente'}
                                    </button>
                                </div>
                            </form>

                            {/* 👇 SECCIÓN DE ARCHIVOS (Solo si estamos editando) */}
                            {isEditing && (
                                <div className="archivos-section">
                                    <div className="form-section-label" style={{ color: '#0056b3' }}>📎 Estudios y Archivos Médicos</div>
                                    
                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '20px', background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px dashed #ccc' }}>
                                        <input 
                                            id="fileInput"
                                            type="file" 
                                            onChange={(e) => setArchivoSeleccionado(e.target.files[0])} 
                                            style={{ flex: 1 }}
                                            accept=".pdf, image/*" 
                                        />
                                        <button 
                                            type="button" 
                                            onClick={handleUploadArchivo}
                                            style={{ background: '#28a745', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                                        >
                                            ⬆️ Subir Estudio
                                        </button>
                                    </div>

                                    {archivos.length > 0 ? (
                                        <ul style={{ listStyle: 'none', padding: 0 }}>
                                            {archivos.map(archivo => (
                                                <li key={archivo.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #eee', alignItems: 'center' }}>
                                                    <div>
                                                        📄 <strong>{archivo.nombre_original}</strong>
                                                        <span style={{ fontSize: '0.8rem', color: '#666', marginLeft: '10px' }}>
                                                            ({new Date(archivo.fecha_subida).toLocaleDateString()})
                                                        </span>
                                                    </div>
                                                    <a 
                                                        href={`${API_URL}/uploads/${archivo.nombre_archivo}`} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer"
                                                        style={{ background: '#007bff', color: 'white', padding: '5px 10px', borderRadius: '4px', textDecoration: 'none', fontSize: '0.9rem' }}
                                                    >
                                                        👁️ Ver Archivo
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p style={{ color: '#666', fontStyle: 'italic', textAlign: 'center' }}>No hay estudios cargados para este paciente.</p>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </div>

                {/* Guía del Asistente */}
                <div className="form-guide-side-card">
                    <h3 style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.15rem', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        💡 Guía de Registro
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: '1.5', marginBottom: '20px' }}>
                        Asistencia paso a paso para el registro de pacientes en el centro médico:
                    </p>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="d-flex align-items-start">
                            <span className="guide-step-number" style={{ background: '#1a73e8' }}>1</span>
                            <div>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Identificación Única</strong>
                                <p className="m-0 mt-1 text-muted" style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                                    El campo DNI/Pasaporte es mandatorio y único. Evite ingresar caracteres especiales o puntos para agilizar búsquedas.
                                </p>
                            </div>
                        </div>
                        
                        <div className="d-flex align-items-start">
                            <span className="guide-step-number" style={{ background: '#1a73e8' }}>2</span>
                            <div>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Contacto Crítico</strong>
                                <p className="m-0 mt-1 text-muted" style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                                    El celular y el email deben registrarse correctamente. El sistema los utiliza para despachar notificaciones automáticas y alertas de citas.
                                </p>
                            </div>
                        </div>
                        
                        <div className="d-flex align-items-start">
                            <span className="guide-step-number" style={{ background: '#1a73e8' }}>3</span>
                            <div>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>Cobertura Médica</strong>
                                <p className="m-0 mt-1 text-muted" style={{ fontSize: '0.82rem', lineHeight: '1.4' }}>
                                    Seleccione la obra social del paciente o escriba "Particular" si no cuenta con cobertura registrada en recepción.
                                </p>
                            </div>
                        </div>

                        <div className="p-3 rounded mt-2" style={{ background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)' }}>
                            <strong style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}>
                                📊 Retenciones del Centro
                            </strong>
                            <p className="m-0 mt-1 text-muted" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                                El porcentaje de retención que cobra la clínica <strong>no se asigna al paciente</strong>, sino que se define en la ficha de cada <strong>Profesional</strong> (médico) ya que es la comisión por sus servicios.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PacientesForm;