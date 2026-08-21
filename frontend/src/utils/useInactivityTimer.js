import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

// Tiempo por defecto: 15 minutos de inactividad
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;

export const useInactivityTimer = (timeoutMs = INACTIVITY_TIMEOUT_MS) => {
    const navigate = useNavigate();
    const timerRef = useRef(null);

    const handleLogoutByInactivity = () => {
        const token = localStorage.getItem('token');
        if (!token) return; // Si ya está deslogueado, no hace nada

        localStorage.removeItem('token');
        localStorage.removeItem('user');

        Swal.fire({
            icon: 'warning',
            title: 'Sesión Cerrada por Inactividad',
            text: 'No se detectó actividad en el sistema durante 15 minutos. Por motivos de seguridad, se ha cerrado su sesión.',
            confirmButtonText: 'Entendido',
            confirmButtonColor: '#2563eb'
        }).then(() => {
            navigate('/login');
        });
    };

    const resetTimer = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        const token = localStorage.getItem('token');
        if (token) {
            timerRef.current = setTimeout(handleLogoutByInactivity, timeoutMs);
        }
    };

    useEffect(() => {
        const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
        
        // Iniciar temporizador inicial
        resetTimer();

        // Agregar listeners
        const eventHandler = () => resetTimer();
        events.forEach(ev => window.addEventListener(ev, eventHandler));

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(ev => window.removeEventListener(ev, eventHandler));
        };
    }, [navigate, timeoutMs]);
};
