'use client';

import Link from 'next/link';

export default function Footer() {
    const currentYear = new Date().getFullYear();

    type FooterLink = { name: string; href: string; external?: boolean };

    const footerSections: { title: string; links: FooterLink[] }[] = [
        {
            title: 'Navegación',
            links: [
                { name: 'Inicio', href: '/' },
                { name: 'Portal del Proveedor', href: '/proveedor' },
                { name: 'Dashboard ESG', href: '/dashboard' },
            ],
        },
        {
            title: 'Nuestra Empresa',
            links: [
                { name: 'Sobre Nosotros', href: '#' },
                { name: 'Nuestra Misión', href: '#' },
                { name: 'Política de Privacidad', href: '#' },
                { name: 'Centro de Ayuda', href: '#' },
            ],
        },
        {
            title: 'Redes Sociales',
            links: [
                { name: 'LinkedIn', href: 'https://linkedin.com', external: true },
                { name: 'Twitter / X', href: 'https://x.com', external: true },
                { name: 'Sitio Corporativo', href: '#', external: true },
                { name: 'GitHub', href: 'https://github.com/Ferinjoque/esg-supplier-auditor', external: true },
            ],
        },
    ];

    return (
        <footer className="bg-gradient-to-b from-gray-900 to-gray-950 text-gray-300 mt-auto border-t border-gray-800 shadow-inner">
            {/* Main footer */}
            <div className="container mx-auto px-6 py-12 lg:py-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 lg:gap-8">

                    {/* Información del proyecto (Ocupa 2 columnas en pantallas grandes) */}
                    <div className="space-y-5 lg:col-span-2">
                        <div className="flex items-center space-x-3">
                            <div className="bg-gradient-to-br from-green-400 to-green-600 p-2 rounded-lg shadow-lg shadow-green-900/20">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <span className="font-extrabold text-xl text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 tracking-tight">
                                ESG Supplier Auditor
                            </span>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed pr-4">
                            Sistema inteligente de automatización de sostenibilidad para la evaluación de proveedores.
                            Calcula y monitorea la huella de carbono e hídrica en tiempo real mediante Arquitectura Cloud y un enfoque orientado a objetos.
                        </p>
                        <div className="flex flex-wrap gap-2 pt-2">
                            <span className="text-[10px] font-medium uppercase tracking-wider bg-gray-800/80 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-full shadow-sm">v1.0.0</span>
                            <span className="text-[10px] font-medium uppercase tracking-wider bg-gray-800/80 border border-gray-700 text-gray-300 px-3 py-1.5 rounded-full shadow-sm">MIT License</span>
                            <span className="text-[10px] font-medium uppercase tracking-wider bg-green-900/30 border border-green-800/50 text-green-400 px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1.5:">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse inline-block mr-1.5"></span>
                                Producción
                            </span>
                        </div>
                    </div>

                    {/* Secciones de links */}
                    {footerSections.map((section) => (
                        <div key={section.title} className="space-y-4">
                            <h3 className="font-semibold text-white/90 text-sm uppercase tracking-wider after:content-[''] after:block after:w-8 after:h-0.5 after:bg-green-500 after:mt-2">
                                {section.title}
                            </h3>
                            <ul className="space-y-3">
                                {section.links.map((link) => (
                                    <li key={link.name}>
                                        {link.external ? (
                                            <a
                                                href={link.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="group flex items-center gap-1.5 text-sm text-gray-400 hover:text-green-400 transition-all duration-300"
                                            >
                                                <span className="relative overflow-hidden">
                                                    {link.name}
                                                    <span className="absolute bottom-0 left-0 w-0 h-px bg-green-400 transition-all duration-300 group-hover:w-full"></span>
                                                </span>
                                                <svg className="w-3.5 h-3.5 opacity-0 -translate-y-1 translate-x-1 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0 transition-all duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        ) : (
                                            <Link
                                                href={link.href}
                                                className="group relative text-sm text-gray-400 hover:text-green-400 transition-colors duration-300 inline-block"
                                            >
                                                {link.name}
                                                <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-green-400 transition-all duration-300 group-hover:w-full"></span>
                                            </Link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Línea divisoria con estadísticas */}
                <div className="border-t border-gray-800/80 mt-12 pt-8">
                    <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-500 gap-4">
                        <p className="flex items-center gap-2">
                            © {currentYear} ESG Supplier Auditor. Todos los derechos reservados.
                        </p>
                        <div className="flex flex-wrap justify-center items-center gap-4 mt-2 md:mt-0">
                            <span className="flex items-center gap-2 bg-gray-800/30 px-3 py-1.5 rounded-full border border-gray-800/50">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                                </span>
                                <span className="text-xs font-medium text-gray-400">Sistema Activo</span>
                            </span>
                            <span className="text-gray-700 hidden sm:block">•</span>
                            <span className="flex items-center gap-1.5 text-gray-400 font-medium text-xs uppercase tracking-wider">
                                Sostenibilidad
                            </span>
                            <span className="text-gray-700 hidden sm:block">•</span>
                            <span className="flex items-center gap-1.5 text-gray-400 font-medium text-xs uppercase tracking-wider">
                                Auditoría Real-Time
                            </span>
                        </div>
                    </div>
                </div>

                {/* Mensaje de sostenibilidad */}
                <div className="text-center mt-8 pt-6 border-t border-gray-800/40">
                    <p className="text-xs text-gray-500/80 max-w-3xl mx-auto leading-relaxed">
                        Este sistema automatiza el cálculo de huella ambiental usando factores de conversión estandarizados.
                        Contribuye a los Objetivos de Desarrollo Sostenible (ODS): <strong className="text-gray-400 font-medium">Acción por el clima (ODS 13)</strong> y
                        <strong className="text-gray-400 font-medium"> Producción y Consumo Responsable (ODS 12)</strong>.
                    </p>
                </div>
            </div>
        </footer>
    );
}