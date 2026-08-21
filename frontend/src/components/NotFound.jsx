import React from 'react';
import { useNavigate } from 'react-router-dom';
import './modules.css';

const NotFound = () => {
    const navigate = useNavigate();

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '75vh',
            padding: '24px'
        }}>
            <div className="assistant-guide-card light-blue-theme" style={{
                maxWidth: '500px',
                width: '100%',
                textAlign: 'center',
                padding: '40px 30px',
                borderRadius: '16px',
                boxShadow: 'var(--shadow-card)',
                animation: 'zoomIn 0.3s ease-out'
            }}>
                <div style={{
                    fontSize: '72px',
                    fontWeight: '800',
                    background: 'linear-gradient(135deg, #1a73e8, #7c3aed)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '10px',
                    lineHeight: '1'
                }}>
                    404
                </div>
                
                <h2 style={{
                    fontSize: '1.5rem',
                    fontWeight: '700',
                    color: 'var(--text-primary)',
                    marginBottom: '16px'
                }}>
                    Página no encontrada
                </h2>
                
                <p style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.92rem',
                    lineHeight: '1.6',
                    marginBottom: '28px'
                }}>
                    La sección a la que intentás acceder no existe, ha sido movida o la ruta ingresada es incorrecta.
                </p>
                
                <button 
                    onClick={() => navigate('/')} 
                    className="mod-btn-add"
                    style={{
                        padding: '12px 28px',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        borderRadius: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        margin: '0 auto'
                    }}
                >
                    🏠 Volver al Inicio
                </button>
            </div>
        </div>
    );
};

export default NotFound;
