import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { getLoggedInUser } from './utils/auth';
import { useInactivityTimer } from './utils/useInactivityTimer';
import 'bootstrap/dist/css/bootstrap.min.css';
import Footer from './components/Footer';

import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import PacientesList from './components/PacientesList';
import PacientesForm from './components/PacientesForm';
import ProfesionalList from './components/ProfesionalList';
import ProfesionalForm from './components/ProfesionalForm';
import UsuariosList from './components/UsuariosList';
import UsuariosForm from './components/UsuariosForm';
import RolList from './components/RolList'; 
import RolForm from './components/RolForm'; 
import TurnosList from './components/TurnosList';
import HistorialClinico from './components/HistorialClinico';
import TurnosForm from './components/TurnosForm';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import Soporte from './components/Soporte';
import Privacidad from './components/Privacidad';
import NotFound from './components/NotFound';


import ProtectedRoute from './components/ProtectedRoute';
import CajaControl from './components/CajaControl';
import CajaHistorial from './components/CajaHistorial';
import Liquidaciones from './components/Liquidaciones';

const MainLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isLogin = location.pathname === '/login' 
    || location.pathname === '/forgot-password' 
    || location.pathname.startsWith('/reset-password');

  // ⏱️ Activar el control de inactividad automático (15 minutos)
  useInactivityTimer();

  // 🛡️ Interceptor de Axios para capturar sesiones desplazadas por doble inicio de sesión
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      response => response,
      error => {
        if (error.response && error.response.status === 401) {
          const code = error.response.data?.code;
          const message = error.response.data?.message;

          if (code === 'CONCURRENT_LOGIN_DISPLACED') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            Swal.fire({
              icon: 'warning',
              title: 'Sesión Finalizada',
              text: message || 'Se ha iniciado sesión en otro navegador o dispositivo con este usuario.',
              confirmButtonText: 'Entendido',
              confirmButtonColor: '#2563eb'
            }).then(() => {
              navigate('/login');
            });
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [navigate]);

  // 💓 Heartbeat de Sesión Única (cada 30 segundos comprueba si la sesión sigue activa)
  useEffect(() => {
    if (isLogin) return;

    const checkSessionStatus = () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      axios.get('/auth/verify-session', {
        headers: { Authorization: `Bearer ${token}` }
      }).catch(() => {
        // El interceptor capturará el error 401 y disparará el logout automático
      });
    };

    // Comprobación inicial al cambiar de ruta
    checkSessionStatus();

    // Intervalo cada 30 segundos
    const interval = setInterval(checkSessionStatus, 30000);
    return () => clearInterval(interval);
  }, [isLogin, location.pathname]);

  // ── GESTIÓN DEL PERIODO DE PRUEBA (TRIAL) ──────────────────────────────────
  const user = getLoggedInUser();
  const diasRestantes = user ? user.trial_dias_restantes : null;
  const trialExpirado = diasRestantes !== null && diasRestantes < 0;
  const mostrarAvisoCercano = diasRestantes !== null && diasRestantes >= 0 && diasRestantes <= 3;

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
    window.location.reload();
  };

  // 🌓 Sistema Temático (Light / Dark Mode)
  const [theme, setTheme] = useState(() => {
    const localTheme = localStorage.getItem('theme');
    if (localTheme) return localTheme;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return systemPrefersDark ? 'dark' : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // 📱 Estado de Sidebar Mobile
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Cerrar sidebar mobile cuando cambia de ruta
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <div style={{
      display: 'flex',
      minHeight: '100vh',
      /* 👇 Aesthetic Mesh Gradient Background 👇 */
      background: 'var(--bg-app)',
      position: 'relative',
      transition: 'background 0.3s ease'
    }}>
      {/* Elementos decorativos (Blobs) para el fondo */}
      {!isLogin && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', zIndex: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: '-10%', left: '20%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(167, 139, 250, 0.08) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }} />
          <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '500px', height: '500px', background: 'radial-gradient(circle, rgba(96, 165, 250, 0.08) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }} />
        </div>
      )}

      {/* Overlay para cerrar sidebar mobile al hacer click fuera */}
      {!isLogin && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(3px)',
            zIndex: 999
          }}
        />
      )}

      {/* Si NO estamos en la pantalla de login, mostramos el menú lateral */}
      {!isLogin && (
        <Sidebar 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen} 
        />
      )}

      {/* El contenido principal se empuja 260px a la derecha para hacerle espacio al Sidebar */}
      <div 
        className="main-content-wrapper"
        style={{
          flexGrow: 1,
          marginLeft: isLogin ? '0' : '260px',
          transition: 'margin 0.3s ease, margin-left 0.3s ease',
          width: '100%',
          display: 'flex',          // ✅ 1. Lo convertimos en flexbox
          flexDirection: 'column',  // ✅ 2. Lo ponemos en formato columna
          position: 'relative',
          zIndex: 1
        }}
      >
        {/* Estilos CSS para animaciones */}
        <style>{`
          @keyframes fadeInDown {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes zoomIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
          }
        `}</style>

        {/* AVISO DE TRIAL CERCANO A EXPIRAR (Banner Superior) */}
        {!isLogin && mostrarAvisoCercano && (
          <div style={{
            background: 'linear-gradient(135deg, #d97706, #b45309)',
            color: '#ffffff',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: '600',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            boxShadow: '0 4px 12px rgba(180, 83, 9, 0.15)',
            position: 'relative',
            zIndex: 100,
            animation: 'fadeInDown 0.5s ease-out'
          }}>
            <span style={{ fontSize: '18px' }}>⏳</span>
            <span>
              Tu periodo de prueba gratuita expira en <strong>{diasRestantes} {diasRestantes === 1 ? 'día' : 'días'}</strong>. 
              Para evitar la interrupción del servicio, por favor contáctanos para activar tu licencia.
            </span>
            <a 
              href={`https://wa.me/5491122334455?text=Hola!%20Mi%20periodo%20de%20prueba%20de%20MedCloud%20expira%20en%20${diasRestantes}%20d%C3%ADas%20y%20quiero%20activar%20mi%20licencia.`}
              target="_blank"
              rel="noreferrer"
              style={{
                background: '#ffffff',
                color: '#b45309',
                padding: '4px 12px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '12px',
                fontWeight: '700',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                marginLeft: '8px',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.05)'; }}
            >
              Activar Licencia
            </a>
          </div>
        )}

        {!isLogin && (
          <Navbar 
            theme={theme} 
            toggleTheme={toggleTheme} 
            setSidebarOpen={setSidebarOpen} 
          />
        )}

        {/* ✅ 3. Le agregamos flexGrow: 1 para que ocupe todo el espacio libre y empuje el footer abajo */}
        <div className="container-fluid p-4" style={{ flexGrow: 1 }}>
          {children}
        </div>

        {/* ✅ 4. Agregamos el Footer al final de la columna (no se muestra en el login) */}
        {!isLogin && <Footer />}
      </div>

      {/* OVERLAY DE BLOQUEO ABSOLUTO (Si el trial expiró) */}
      {!isLogin && trialExpirado && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          animation: 'fadeIn 0.4s ease-out'
        }}>
          <div style={{
            background: 'var(--panel-bg, #ffffff)',
            borderRadius: '24px',
            padding: '48px 32px',
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            animation: 'zoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            <div style={{
              width: '80px',
              height: '80px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '40px',
              margin: '0 auto 24px auto',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.15)'
            }}>
              <ion-icon name="lock-closed"></ion-icon>
            </div>
            
            <h2 style={{
              fontWeight: '800',
              fontSize: '28px',
              background: 'linear-gradient(135deg, #ef4444, #f43f5e)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              marginBottom: '16px',
              letterSpacing: '-0.5px'
            }}>
              Periodo de Prueba Finalizado
            </h2>
            
            <p style={{
              color: 'var(--text-secondary, #64748b)',
              fontSize: '15px',
              lineHeight: '1.6',
              marginBottom: '32px'
            }}>
              Esperamos que hayas disfrutado la interacción y facilidad de uso de <strong>MedCloud</strong>. Tu acceso de prueba de 15 días ha concluido. Para poder seguir gestionando pacientes y agendas médicas, por favor contáctanos para activar tu licencia.
            </p>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }}>
              <a 
                href="https://wa.me/5491122334455?text=Hola!%20Termin%C3%B3%20mi%20periodo%20de%20prueba%20de%20MedCloud%20y%20quiero%20activar%20mi%20licencia."
                target="_blank"
                rel="noreferrer"
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  color: '#ffffff',
                  padding: '14px 28px',
                  borderRadius: '14px',
                  textDecoration: 'none',
                  fontSize: '15px',
                  fontWeight: '700',
                  boxShadow: '0 8px 16px rgba(59, 130, 246, 0.25)',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 20px rgba(59, 130, 246, 0.35)'; }}
                onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(59, 130, 246, 0.25)'; }}
              >
                <ion-icon name="logo-whatsapp" style={{ fontSize: '20px' }}></ion-icon>
                Activar Licencia por WhatsApp
              </a>
              
              <button 
                onClick={handleLogout}
                style={{
                  background: 'transparent',
                  color: 'var(--text-secondary, #64748b)',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  padding: '12px 28px',
                  borderRadius: '14px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = 'var(--panel-bg-hover, #f1f5f9)'; e.currentTarget.style.color = 'var(--text-main, #1e293b)'; }}
                onMouseOut={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary, #64748b)'; }}
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      {/* 👇 AQUÍ ESTÁ LA MAGIA: Envolvemos las rutas con MainLayout 👇 */}
      <MainLayout>
        <Routes>
          {/* RUTAS PÚBLICAS */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* ==========================================
              NIVEL 1: SOLO USUARIOS LOGUEADOS (Cualquiera)
              ========================================== */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pacientes" element={<PacientesList />} />
            <Route path="/turnos" element={<TurnosList />} />
            <Route path="/turnos/nuevo" element={<TurnosForm />} />
            <Route path="/turnos/editar/:id" element={<TurnosForm />} />
            <Route path="/soporte" element={<Soporte />} />
            <Route path="/privacidad" element={<Privacidad />} />
          </Route>

          {/* ==========================================
              NIVEL 2: ADMIN y RECEPCIÓN
              ========================================== */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'RECEPCION']} />}>
            <Route path="/profesionales" element={<ProfesionalList />} />
            <Route path="/profesionales/nuevo" element={<ProfesionalForm />} />
            <Route path="/profesionales/editar/:id" element={<ProfesionalForm />} />
            <Route path="/pacientes/nuevo" element={<PacientesForm />} />
            <Route path="/pacientes/editar/:id" element={<PacientesForm />} />

            {/* 👇 Movimos Usuarios y Roles aquí según tu pedido 👇 */}
            <Route path="/usuarios" element={<UsuariosList />} />
            <Route path="/usuarios/nuevo" element={<UsuariosForm />} />
            <Route path="/usuarios/editar/:id" element={<UsuariosForm />} />
            <Route path="/roles" element={<RolList />} />
            <Route path="/roles/nuevo" element={<RolForm />} />
            <Route path="/roles/editar/:id" element={<RolForm />} />

            {/* 💵 Rutas de Caja Diaria y Liquidaciones 🧮 */}
            <Route path="/caja" element={<CajaControl />} />
            <Route path="/caja/historial" element={<CajaHistorial />} />
            <Route path="/liquidaciones" element={<Liquidaciones />} />
          </Route>

          {/* ==========================================
              NIVEL 3: SOLO PROFESIONALES (MÉDICOS)
              ========================================== */}
          <Route element={<ProtectedRoute allowedRoles={['MEDICO']} />}>
            {/* 👇 Solo los doctores pueden entrar a esta URL 👇 */}
            <Route path="/pacientes/:paciente_id/historial" element={<HistorialClinico />} />
          </Route>

          {/* Fallback para páginas no encontradas (404) */}
          <Route path="*" element={<NotFound />} />

        </Routes>
      </MainLayout>
    </BrowserRouter>
  )
}

export default App;