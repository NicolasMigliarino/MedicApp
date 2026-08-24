import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import './Login.css';
import { API_URL } from '../config';

// ============================================================================
// ForgotPassword — Formulario de solicitud de recuperación de contraseña
// El usuario ingresa su email y recibe un link de reset por correo.
// ============================================================================
const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email || !email.includes('@')) {
            Swal.fire({
                icon: 'warning',
                title: 'Email inválido',
                text: 'Por favor, ingresá un correo electrónico válido.',
                confirmButtonColor: '#3c23c9'
            });
            return;
        }

        setLoading(true);

        try {
            await axios.post(`${API_URL}/auth/forgot-password`, { email: email.trim() });

            setSent(true);
            Swal.fire({
                icon: 'success',
                title: '¡Correo enviado!',
                text: 'Si el email está registrado, recibirás las instrucciones en tu bandeja de entrada.',
                confirmButtonColor: '#3c23c9'
            });
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Ocurrió un error al procesar tu solicitud. Intentá nuevamente.',
                confirmButtonColor: '#3c23c9'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="card-login">
                {/* Panel decorativo azul/violeta (derecha) */}
                <div className="card-bg login-mode"></div>

                {/* Texto sobre el panel azul */}
                <div className="hero register active">
                    <h2>MedCloud</h2>
                    <p>Te enviaremos un enlace seguro a tu correo electrónico para restablecer tu contraseña.</p>
                </div>

                {/* Formulario de recuperación (izquierda) */}
                <div className="form-section login active">
                    {!sent ? (
                        <>
                            <div className="recovery-icon">🔐</div>
                            <h2>Recuperar Contraseña</h2>
                            <p className="recovery-subtitle">
                                Ingresá el correo electrónico asociado a tu cuenta.
                            </p>
                            <form onSubmit={handleSubmit}>
                                <input
                                    type="email"
                                    placeholder="tucorreo@ejemplo.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                                <button 
                                    type="submit" 
                                    className="action-btn" 
                                    disabled={loading}
                                    style={{ opacity: loading ? 0.7 : 1 }}
                                >
                                    {loading ? 'ENVIANDO...' : 'ENVIAR INSTRUCCIONES'}
                                </button>
                            </form>
                            <Link to="/login" className="recovery-back-link">
                                ← Volver al inicio de sesión
                            </Link>
                        </>
                    ) : (
                        <>
                            <div className="recovery-icon sent">✉️</div>
                            <h2>¡Revisá tu correo!</h2>
                            <p className="recovery-subtitle">
                                Si <strong>{email}</strong> está registrado en el sistema, recibirás un email con las instrucciones para restablecer tu contraseña.
                            </p>
                            <p className="recovery-hint">
                                No te olvides de revisar la carpeta de spam o correo no deseado.
                            </p>
                            <Link to="/login" className="action-btn" style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>
                                VOLVER AL LOGIN
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;
