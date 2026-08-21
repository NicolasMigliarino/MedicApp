// src/components/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { clinicConfig } from "./config";

const Footer = () => {
    return (
        // Aplicamos exactamente el mismo gradiente aesthetic del Sidebar
        <footer className="text-light mt-auto py-4" style={{
            background: 'linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)',
            borderTop: '1px solid rgba(255, 255, 255, 0.05)',
            boxShadow: '0 -4px 25px rgba(0, 0, 0, 0.1)'
        }}>
            <div className="container-fluid px-4">
                <div className="row align-items-center">

                    {/* COLUMNA 1: Logo y Copyright */}
                    <div className="col-md-6 mb-3 mb-md-0 text-center text-md-start">
                        <h4 className="fw-bold d-flex align-items-center justify-content-center justify-content-md-start gap-2">
                            {/* Un pequeño cuadradito simulando tu logo */}
                            <span className="bg-primary rounded p-1 d-inline-block" style={{ width: '24px', height: '24px' }}></span>
                            {clinicConfig.nombre}
                        </h4>
                        <p className="small mb-0 text-white-50">
                            {clinicConfig.nombre} © {clinicConfig.copyrightYear} - Sistema de Gestión Médica
                        </p>
                    </div>

                    {/* COLUMNA 2: Links y Contacto */}
                    <div className="col-md-6 mb-3 mb-md-0 text-center text-md-end">
                        <div className="d-flex flex-wrap justify-content-center justify-content-md-end gap-3 mb-2 small">
                            <a href="/analisis-funcional.html" target="_blank" rel="noopener noreferrer" className="text-light text-decoration-none">Documentación</a>
                            <Link to="/soporte" className="text-light text-decoration-none">Soporte</Link>
                            <a href="https://nicolasmigliarino.github.io/Portfolio/" target="_blank" rel="noopener noreferrer" className="text-light text-decoration-none">Contacto</a>
                            <Link to="/privacidad" className="text-light text-decoration-none">Política de Privacidad</Link>
                        </div>
                        <div className="small text-white-50">
                            <p className="mb-0">Teléfono: {clinicConfig.telefono} &nbsp;|&nbsp; Email: {clinicConfig.email}</p>
                            <p className="mb-0">{clinicConfig.sitioWeb}</p>
                        </div>
                    </div>

                </div>
            </div>
        </footer>
    );
};

export default Footer;