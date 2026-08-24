import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import Swal from 'sweetalert2';
import './Login.css'; 
import { API_URL } from '../config';

const LoginPage = () => {
    const [loginData, setLoginData] = useState({ username: '', password: '' });

    // States for mandatory password change
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [loggedInUser, setLoggedInUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');
    const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

    const navigate = useNavigate();

    const handleLoginChange = (e) => setLoginData({ ...loginData, [e.target.name]: e.target.value });

    // --- ACCIÓN DE LOGIN ---
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post(`${API_URL}/login`, loginData);

            if (res.data.user.debe_cambiar_pass) {
                setLoggedInUser({ token: res.data.token, user: res.data.user });
                setShowChangePassword(true);
            } else {
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('user', JSON.stringify(res.data.user));
                
                await Swal.fire({
                    icon: 'success',
                    title: '¡Hola de nuevo!',
                    text: `¡Qué bueno verte de nuevo, ${res.data.user.username}!`,
                    timer: 1800,
                    showConfirmButton: false
                });
                
                navigate('/');
                window.location.reload();
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error de ingreso',
                text: 'Usuario o contraseña incorrectos. Por favor, verificá tus credenciales.',
                confirmButtonColor: '#3b82f6'
            });
        }
    };

    // --- ACCIÓN DE CAMBIO DE CONTRASEÑA ---
    const handlePasswordChangeSubmit = async (e) => {
        e.preventDefault();
        if (newPassword !== newPasswordConfirm) {
            Swal.fire({
                icon: 'warning',
                title: 'Contraseñas no coinciden',
                text: 'Las contraseñas ingresadas no son iguales. Por favor, verificalas.',
                confirmButtonColor: '#3b82f6'
            });
            return;
        }
        try {
            await axios.put(`${API_URL}/usuarios/${loggedInUser.user.id}/password`, {
                newPassword: newPassword
            });

            // On success, save to localStorage and navigate
            localStorage.setItem('token', loggedInUser.token);
            const userNoFlag = { ...loggedInUser.user, debe_cambiar_pass: false };
            localStorage.setItem('user', JSON.stringify(userNoFlag));

            await Swal.fire({
                icon: 'success',
                title: '¡Contraseña Actualizada!',
                text: 'Tu contraseña ha sido actualizada correctamente. ¡Bienvenido!',
                timer: 2000,
                showConfirmButton: false
            });
            
            navigate('/');
            window.location.reload();
        } catch (err) {
            console.error(err);
            if (err.response && err.response.data && err.response.data.includes('La nueva contraseña no puede ser igual a la anterior')) {
                Swal.fire({
                    icon: 'error',
                    title: 'Contraseña inválida',
                    text: 'La nueva contraseña no puede ser igual a la temporal anterior.',
                    confirmButtonColor: '#3b82f6'
                });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Ocurrió un error al intentar cambiar la contraseña.',
                    confirmButtonColor: '#3b82f6'
                });
            }
        }
    };



    if (showChangePassword) {
        return (
            <div className="login-container">
                <div className="card-login" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: '2rem', borderRadius: '15px' }}>
                    <h2 style={{ color: '#333', marginBottom: '1rem' }}>Cambio Obligatorio</h2>
                    <p style={{ color: '#666', marginBottom: '2rem', textAlign: 'center' }}>
                        Por tu seguridad, debes establecer una contraseña nueva y personal ahora mismo antes de continuar y acceder a la plataforma.
                    </p>
                    <form onSubmit={handlePasswordChangeSubmit} style={{ width: '100%', maxWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <input
                            type="password"
                            placeholder="Nueva Contraseña"
                            style={{ padding: '0.8rem', borderRadius: '5px', border: '1px solid #ddd' }}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                        <input
                            type="password"
                            placeholder="Confirmar Nueva Contraseña"
                            style={{ padding: '0.8rem', borderRadius: '5px', border: '1px solid #ddd' }}
                            value={newPasswordConfirm}
                            onChange={(e) => setNewPasswordConfirm(e.target.value)}
                            required
                        />
                        <button type="submit" className="action-btn" style={{ width: '100%', marginTop: '1rem' }}>Actualizar Contraseña</button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="card-login">

                {/* FONDO MÓVIL (EL PANEL AZUL FIJO A LA DERECHA) */}
                <div className="card-bg login-mode"></div>

                {/* --- TEXTO SOBRE EL PANEL AZUL (DERECHA) --- */}
                <div className="hero register active">
                    <h2>MedCloud</h2>
                    <p>Acceso restringido para personal autorizado.</p>
                </div>

                {/* --- FORM LOGIN (Inputs - A LA IZQUIERDA) --- */}
                <div className="form-section login active">
                    <h2>Bienvenido</h2>
                    <form onSubmit={handleLoginSubmit}>
                        <input
                            type="text" name="username" placeholder="Usuario"
                            onChange={handleLoginChange} required
                        />
                        <input
                            type="password" name="password" placeholder="Contraseña"
                            onChange={handleLoginChange} required
                        />
                        <button type="submit" className="action-btn">INGRESAR</button>
                    </form>
                    <Link to="/forgot-password" className="recovery-link">
                        ¿Olvidaste tu contraseña?
                    </Link>
                </div>

            </div>
        </div>
    );
};

export default LoginPage;