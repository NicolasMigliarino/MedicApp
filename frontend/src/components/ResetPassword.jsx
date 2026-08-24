import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import './Login.css';
import { API_URL } from '../config';

// ============================================================================
// ResetPassword — Formulario para establecer una nueva contraseña
// Recibe el token de recuperación por URL, lo valida y permite el cambio.
// ============================================================================
const ResetPassword = () => {
    const { token } = useParams();
    const navigate = useNavigate();

    const [validating, setValidating] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [username, setUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // ── Validar el token al cargar el componente ────────────────────────────
    useEffect(() => {
        const validate = async () => {
            try {
                const res = await axios.post(`${API_URL}/auth/validate-reset-token`, { token });

                if (res.data.valid) {
                    setTokenValid(true);
                    setUsername(res.data.username || '');
                } else {
                    setTokenValid(false);
                }
            } catch (err) {
                setTokenValid(false);
            } finally {
                setValidating(false);
            }
        };

        if (token) {
            validate();
        } else {
            setValidating(false);
            setTokenValid(false);
        }
    }, [token]);

    // ── Enviar nueva contraseña ─────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (newPassword.length < 4) {
            Swal.fire({
                icon: 'warning',
                title: 'Contraseña muy corta',
                text: 'La contraseña debe tener al menos 4 caracteres.',
                confirmButtonColor: '#3c23c9'
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            Swal.fire({
                icon: 'warning',
                title: 'Contraseñas no coinciden',
                text: 'Las contraseñas ingresadas no son iguales. Por favor, verificalas.',
                confirmButtonColor: '#3c23c9'
            });
            return;
        }

        setLoading(true);

        try {
            await axios.post(`${API_URL}/auth/reset-password`, {
                token,
                newPassword
            });

            await Swal.fire({
                icon: 'success',
                title: '¡Contraseña Actualizada!',
                text: 'Tu contraseña ha sido restablecida correctamente. Ya podés iniciar sesión.',
                confirmButtonColor: '#3c23c9',
                timer: 2500,
                showConfirmButton: true
            });

            navigate('/login');
        } catch (err) {
            const msg = err.response?.data?.message || 'Ocurrió un error al restablecer la contraseña.';
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: msg,
                confirmButtonColor: '#3c23c9'
            });
        } finally {
            setLoading(false);
        }
    };

    // ── Estado de carga: verificando token ──────────────────────────────────
    if (validating) {
        return (
            <div className="login-container">
                <div className="card-login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div className="recovery-icon loading-spin">🔄</div>
                        <h2 style={{ color: '#333', marginTop: '1rem' }}>Verificando enlace...</h2>
                        <p style={{ color: '#64748b' }}>Estamos validando tu solicitud de recuperación.</p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Token inválido o expirado ───────────────────────────────────────────
    if (!tokenValid) {
        return (
            <div className="login-container">
                <div className="card-login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center', padding: '2rem', maxWidth: '380px' }}>
                        <div className="recovery-icon expired">⏰</div>
                        <h2 style={{ color: '#333', marginTop: '1rem' }}>Enlace Expirado</h2>
                        <p style={{ color: '#64748b', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                            Este enlace de recuperación ya fue utilizado o ha expirado. 
                            Los enlaces son válidos por <strong>1 hora</strong> y solo se pueden usar una vez.
                        </p>
                        <Link to="/forgot-password" className="action-btn" style={{ textDecoration: 'none', display: 'inline-block' }}>
                            SOLICITAR NUEVO ENLACE
                        </Link>
                        <br />
                        <Link to="/login" className="recovery-back-link" style={{ marginTop: '1rem', display: 'inline-block' }}>
                            ← Volver al inicio de sesión
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ── Formulario de nueva contraseña (token válido) ───────────────────────
    return (
        <div className="login-container">
            <div className="card-login">
                {/* Panel decorativo */}
                <div className="card-bg login-mode"></div>

                {/* Texto sobre el panel azul */}
                <div className="hero register active">
                    <h2>MedCloud</h2>
                    <p>Establecé una nueva contraseña segura para acceder a tu cuenta.</p>
                </div>

                {/* Formulario de nueva contraseña (izquierda) */}
                <div className="form-section login active">
                    <div className="recovery-icon">🔑</div>
                    <h2>Nueva Contraseña</h2>
                    {username && (
                        <p className="recovery-subtitle">
                            Hola <strong>{username}</strong>, ingresá tu nueva contraseña.
                        </p>
                    )}
                    <form onSubmit={handleSubmit}>
                        <input
                            type="password"
                            placeholder="Nueva contraseña"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            autoFocus
                        />
                        <input
                            type="password"
                            placeholder="Confirmar nueva contraseña"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                        <button 
                            type="submit" 
                            className="action-btn" 
                            disabled={loading}
                            style={{ opacity: loading ? 0.7 : 1 }}
                        >
                            {loading ? 'GUARDANDO...' : 'RESTABLECER CONTRASEÑA'}
                        </button>
                    </form>
                    <Link to="/login" className="recovery-back-link">
                        ← Volver al inicio de sesión
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
