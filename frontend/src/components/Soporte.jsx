import { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import { getLoggedInUser } from '../utils/auth';
import { API_URL } from '../config';
import './forms.css';

const Soporte = () => {
    const user = getLoggedInUser();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState({
        category: 'Problema Técnico',
        subject: '',
        description: '',
        contactEmail: user?.email || '' // Pre-llenado opcional del usuario
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.subject.trim() || !formData.description.trim() || !formData.contactEmail.trim()) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos incompletos',
                text: 'Por favor complete todos los campos requeridos para enviar el reporte.',
                confirmButtonColor: 'var(--primary)'
            });
            return;
        }

        setLoading(true);

        try {
            // Enviamos el reporte de soporte al backend
            const res = await axios.post(`${API_URL}/api/soporte`, formData);

            Swal.fire({
                icon: 'success',
                title: 'Reporte Enviado',
                text: res.data.message || 'El reporte de soporte fue enviado con éxito. Nos pondremos en contacto a la brevedad.',
                confirmButtonColor: '#1a73e8'
            });

            // Redirigir al dashboard
            navigate('/');
        } catch (error) {
            console.error('Error enviando reporte:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error de envío',
                text: error.response?.data?.message || 'Hubo un error al enviar el reporte. Por favor intente nuevamente.',
                confirmButtonColor: '#d33'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="form-page animate-fade-in" style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div className="form-container-layout">
                
                {/* LADO IZQUIERDO: Formulario de Soporte */}
                <div className="form-card-wrapper">
                    <div className="form-card wide">
                        <div className="form-card-header rose">
                            <div className="d-flex align-items-center gap-3">
                                <div className="bg-danger text-white rounded p-2 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px', borderRadius: '12px' }}>
                                    <ion-icon name="help-buoy-outline" style={{ fontSize: '24px' }}></ion-icon>
                                </div>
                                <div>
                                    <h4 className="m-0 fw-bold" style={{ color: 'var(--text-primary)' }}>Reportar Incidente / Feedback</h4>
                                    <p className="m-0 small text-muted">Envía un ticket de ayuda o sugerencia directamente al administrador</p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4">
                            <div className="row g-3">
                                
                                {/* CATEGORIA */}
                                <div className="col-md-6">
                                    <label className="form-label-custom">Categoría del Reporte <span className="text-danger">*</span></label>
                                    <select
                                        name="category"
                                        className="form-select"
                                        style={{
                                            backgroundColor: 'var(--input-bg)',
                                            color: 'var(--input-color)',
                                            border: '1.5px solid var(--input-border)',
                                            borderRadius: '10px',
                                            padding: '10px 14px'
                                        }}
                                        value={formData.category}
                                        onChange={handleChange}
                                    >
                                        <option value="Problema Técnico">⚠️ Problema Técnico / Error</option>
                                        <option value="Sugerencia / Feedback">💡 Sugerencia / Feedback</option>
                                        <option value="Pregunta de Licencia">🔑 Pregunta de Licencia o Periodo de Prueba</option>
                                        <option value="Consulta General">❓ Consulta General</option>
                                        <option value="Otro">📁 Otro</option>
                                    </select>
                                </div>

                                {/* EMAIL DE CONTACTO */}
                                <div className="col-md-6">
                                    <label className="form-label-custom">Tu correo electrónico (para recibir la respuesta) <span className="text-danger">*</span></label>
                                    <input
                                        type="email"
                                        name="contactEmail"
                                        className="form-input"
                                        placeholder="tu-correo@dominio.com"
                                        value={formData.contactEmail}
                                        onChange={handleChange}
                                        required
                                    />
                                    <span className="small text-muted" style={{ fontSize: '0.78rem' }}>Escribe tu propia casilla. El administrador te responderá a este correo.</span>
                                </div>

                                {/* ASUNTO */}
                                <div className="col-12">
                                    <label className="form-label-custom">Asunto / Resumen <span className="text-danger">*</span></label>
                                    <input
                                        type="text"
                                        name="subject"
                                        className="form-input"
                                        placeholder="Ej: Error al liquidar consultas del Dr. Gómez"
                                        value={formData.subject}
                                        onChange={handleChange}
                                        maxLength={80}
                                        required
                                    />
                                </div>

                                {/* DESCRIPCION */}
                                <div className="col-12">
                                    <label className="form-label-custom">Detalle del Incidente o Sugerencia <span className="text-danger">*</span></label>
                                    <textarea
                                        name="description"
                                        className="form-input"
                                        rows="6"
                                        placeholder="Describe de la forma más detallada posible el error, comportamiento esperado o tu sugerencia para mejorar la plataforma..."
                                        value={formData.description}
                                        onChange={handleChange}
                                        style={{ height: 'auto', resize: 'vertical' }}
                                        required
                                    />
                                </div>

                            </div>

                            {/* BOTONES DE ACCIÓN */}
                            <div className="d-flex justify-content-end gap-3 mt-4 pt-3 border-top" style={{ borderColor: 'var(--border-separator)' }}>
                                <Link to="/" className="btn btn-outline-secondary" style={{ borderRadius: '12px', padding: '10px 24px', fontWeight: '600' }}>
                                    Cancelar
                                </Link>
                                <button
                                    type="submit"
                                    className="btn btn-primary d-flex align-items-center gap-2"
                                    disabled={loading}
                                    style={{
                                        borderRadius: '12px',
                                        padding: '10px 28px',
                                        fontWeight: '600',
                                        background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
                                        border: 'none',
                                        boxShadow: '0 4px 14px rgba(99, 102, 241, 0.25)'
                                    }}
                                >
                                    {loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                            Enviando...
                                        </>
                                    ) : (
                                        <>
                                            <ion-icon name="paper-plane-outline" style={{ fontSize: '18px' }}></ion-icon>
                                            Enviar Reporte
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* LADO DERECHO: Tarjeta Guía Lateral */}
                <div className="form-guide-side-card shadow-sm border" style={{ borderColor: 'var(--border-card)' }}>
                    <h5 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <ion-icon name="information-circle-outline" style={{ fontSize: '20px', color: '#6366f1' }}></ion-icon>
                        ¿Cómo funciona?
                    </h5>
                    <ul className="list-unstyled d-flex flex-column gap-3 small text-muted" style={{ paddingLeft: '0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                        <li className="d-flex gap-2">
                            <span style={{ color: '#6366f1', fontWeight: 'bold' }}>✓</span>
                            <span>Este reporte se envía inmediatamente a la casilla de correo del equipo de soporte de MedCloud (<strong>nmigliarino@gmail.com</strong>).</span>
                        </li>
                        <li className="d-flex gap-2">
                            <span style={{ color: '#6366f1', fontWeight: 'bold' }}>✓</span>
                            <span>Se incluirán automáticamente tus datos de sesión (Nombre de usuario: <strong>{user?.username}</strong> y Rol: <strong>{user?.rol_nombre || user?.rol}</strong>) para agilizar la solución.</span>
                        </li>
                        <li className="d-flex gap-2">
                            <span style={{ color: '#6366f1', fontWeight: 'bold' }}>✓</span>
                            <span>Si estás experimentando un error técnico, intenta describir qué estabas haciendo y qué mensaje de error apareció en pantalla.</span>
                        </li>
                    </ul>
                </div>

            </div>
        </div>
    );
};

export default Soporte;
