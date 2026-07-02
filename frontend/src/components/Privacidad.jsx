import { Link } from 'react-router-dom';
import { clinicConfig } from './config';
import './forms.css';

const Privacidad = () => {
    return (
        <div className="form-page" style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div className="form-container-layout">
                
                {/* LADO IZQUIERDO: Declaración de Compromiso y Políticas */}
                <div className="form-card-wrapper">
                    <div className="form-card wide">
                        <div className="form-card-header blue">
                            <div className="d-flex align-items-center gap-3">
                                <div className="bg-primary text-white rounded p-2 d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px', borderRadius: '12px' }}>
                                    <ion-icon name="shield-checkmark-outline" style={{ fontSize: '24px' }}></ion-icon>
                                </div>
                                <div>
                                    <h4 className="m-0 fw-bold" style={{ color: 'var(--text-primary)' }}>Política de Privacidad e Información de Seguridad</h4>
                                    <p className="m-0 small text-muted">Compromiso MedCloud con el resguardo de datos médicos y confidencialidad</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                            <p className="mb-4">
                                En <strong>MedCloud</strong> entendemos que la privacidad de los pacientes y la confidencialidad de la información de salud es la prioridad absoluta. Por ello, diseñamos y mantenemos la plataforma bajo estrictos estándares de seguridad técnica y administrativa.
                            </p>

                            <div className="d-flex flex-column gap-4">
                                
                                {/* 1. Control de Roles */}
                                <div className="d-flex gap-3 align-items-start">
                                    <div className="text-primary fs-3" style={{ lineHeight: '1' }}>
                                        <ion-icon name="people-circle-outline"></ion-icon>
                                    </div>
                                    <div>
                                        <h5 className="fw-bold mb-1" style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>1. Control de Acceso Estricto por Roles</h5>
                                        <p className="small text-muted mb-0">
                                            Las historias clínicas confidenciales están completamente blindadas. Sólo los usuarios con rol de <strong>MÉDICO</strong> pueden acceder, visualizar o editar los historiales de los pacientes. Los roles administrativos o de recepción no tienen visibilidad técnica sobre los diagnósticos ni notas confidenciales.
                                        </p>
                                    </div>
                                </div>

                                {/* 2. Seguridad en Contraseñas */}
                                <div className="d-flex gap-3 align-items-start">
                                    <div className="text-primary fs-3" style={{ lineHeight: '1' }}>
                                        <ion-icon name="key-outline"></ion-icon>
                                    </div>
                                    <div>
                                        <h5 className="fw-bold mb-1" style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>2. Encriptación y Seguridad de Credenciales</h5>
                                        <p className="small text-muted mb-0">
                                            Todas las contraseñas de los usuarios del sistema se procesan a través de capas de encriptación seguras. El sistema fuerza a restablecer la clave en el primer inicio de sesión cuando el usuario es registrado por primera vez por un administrador.
                                        </p>
                                    </div>
                                </div>

                                {/* 3. Resguardo de la Base de Datos */}
                                <div className="d-flex gap-3 align-items-start">
                                    <div className="text-primary fs-3" style={{ lineHeight: '1' }}>
                                        <ion-icon name="server-outline"></ion-icon>
                                    </div>
                                    <div>
                                        <h5 className="fw-bold mb-1" style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>3. Resguardo e Integridad de la Base de Datos</h5>
                                        <p className="small text-muted mb-0">
                                            La información del sistema se encuentra hospedada en servidores dedicados y protegidos contra accesos no autorizados. Contamos con una política automatizada de copias de seguridad de datos (backups diarios) para prevenir pérdidas accidentales de información.
                                        </p>
                                    </div>
                                </div>

                                {/* 4. Ley de Protección de Datos Personales */}
                                <div className="d-flex gap-3 align-items-start">
                                    <div className="text-primary fs-3" style={{ lineHeight: '1' }}>
                                        <ion-icon name="document-text-outline"></ion-icon>
                                    </div>
                                    <div>
                                        <h5 className="fw-bold mb-1" style={{ color: 'var(--text-primary)', fontSize: '1.05rem' }}>4. Alineación Normativa</h5>
                                        <p className="small text-muted mb-0">
                                            MedCloud se alinea con la legislación de protección de datos personales de salud (incluyendo regulaciones de secreto médico y confidencialidad informática). Los datos ingresados pertenecen única y exclusivamente al profesional o clínica propietaria de la licencia.
                                        </p>
                                    </div>
                                </div>

                            </div>

                            <div className="d-flex justify-content-end mt-4 pt-3 border-top" style={{ borderColor: 'var(--border-separator)' }}>
                                <Link to="/" className="btn btn-primary" style={{ borderRadius: '12px', padding: '10px 28px', fontWeight: '600' }}>
                                    Entendido, Volver al Inicio
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* LADO DERECHO: Tarjeta Guía Lateral */}
                <div className="form-guide-side-card shadow-sm border" style={{ borderColor: 'var(--border-card)', width: '300px' }}>
                    <h5 className="fw-bold mb-3 d-flex align-items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                        <ion-icon name="lock-closed-outline" style={{ fontSize: '20px', color: '#1a73e8' }}></ion-icon>
                        Contacto Privado
                    </h5>
                    <p className="small text-muted mb-3" style={{ fontSize: '0.85rem' }}>
                        Por consultas sobre el manejo y la auditoría de accesos al sistema, puedes comunicarte directamente con el administrador de MedCloud:
                    </p>
                    <ul className="list-unstyled d-flex flex-column gap-2 small text-muted mb-0" style={{ paddingLeft: '0', fontSize: '0.82rem' }}>
                        <li className="d-flex align-items-center gap-2">
                            <ion-icon name="mail-outline" style={{ fontSize: '16px', color: '#1a73e8' }}></ion-icon>
                            <strong>{clinicConfig.email}</strong>
                        </li>
                        <li className="d-flex align-items-center gap-2">
                            <ion-icon name="call-outline" style={{ fontSize: '16px', color: '#1a73e8' }}></ion-icon>
                            <span>{clinicConfig.telefono}</span>
                        </li>
                        <li className="d-flex align-items-center gap-2">
                            <ion-icon name="globe-outline" style={{ fontSize: '16px', color: '#1a73e8' }}></ion-icon>
                            <span>{clinicConfig.sitioWeb}</span>
                        </li>
                    </ul>
                </div>

            </div>
        </div>
    );
};

export default Privacidad;
