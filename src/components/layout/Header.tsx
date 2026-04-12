'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Header() {
    const pathname = usePathname();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const navigation = [
        {
            name: 'Inicio',
            href: '/',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
            )
        },
        {
            name: 'Proveedor',
            href: '/proveedor',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
            )
        },
        {
            name: 'Dashboard',
            href: '/dashboard',
            icon: (
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
            )
        },
    ];

    const isActive = (href: string) => pathname === href;

    return (
        <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/80 shadow-sm sticky top-0 z-50 transition-all duration-300">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">

                    {/* Logo y nombre del proyecto */}
                    <Link href="/" className="flex items-center gap-3 group">
                        <div className="bg-gradient-to-br from-green-500 to-green-600 p-2 rounded-lg shadow-md shadow-green-600/20 group-hover:scale-105 transition-transform duration-300">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <span className="font-extrabold text-lg text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight hidden sm:block">
                            ESG Supplier Auditor
                        </span>
                        <span className="font-extrabold text-lg text-gray-900 sm:hidden">
                            ESG
                        </span>
                    </Link>

                    {/* Navegación desktop */}
                    <nav className="hidden md:flex space-x-1 bg-gray-50/80 border border-gray-200/60 rounded-xl p-1 shadow-sm">
                        {navigation.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`
                  px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
                  flex items-center space-x-2 relative group overflow-hidden
                  ${isActive(item.href)
                                        ? 'bg-white text-green-700 shadow-sm ring-1 ring-gray-900/5'
                                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100/50'
                                    }
                `}
                            >
                                {/* Subrayado animado activo */}
                                {isActive(item.href) && (
                                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-[2px] bg-green-500 rounded-t-full"></span>
                                )}
                                <span className={`transition-colors duration-300 ${isActive(item.href) ? 'text-green-600' : 'text-gray-400 group-hover:text-green-500'}`}>
                                    {item.icon}
                                </span>
                                <span>{item.name}</span>
                            </Link>
                        ))}
                    </nav>

                    {/* Botón menú móvil */}
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden p-2 rounded-xl text-gray-600 bg-gray-50 border border-gray-200/60 hover:bg-gray-100 hover:text-gray-900 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/20"
                        aria-label="Menú"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {isMenuOpen ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            )}
                        </svg>
                    </button>
                </div>

                {/* Menú móvil desplegable */}
                <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${isMenuOpen ? 'max-h-80 opacity-100 py-4' : 'max-h-0 opacity-0'}`}>
                    <div className="border-t border-gray-100 pt-4">
                        <nav className="flex flex-col space-y-1">
                            {navigation.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    onClick={() => setIsMenuOpen(false)}
                                    className={`
                    px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                    flex items-center space-x-3
                    ${isActive(item.href)
                                            ? 'bg-green-50 text-green-700 border border-green-100/50'
                                            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                                        }
                  `}
                                >
                                    <span className={`${isActive(item.href) ? 'text-green-600' : 'text-gray-400'}`}>
                                        {item.icon}
                                    </span>
                                    <span>{item.name}</span>
                                    {isActive(item.href) && (
                                        <span className="ml-auto w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                    )}
                                </Link>
                            ))}
                        </nav>
                        <div className="mt-6 pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between px-4 bg-gray-50 rounded-xl py-3 border border-gray-100">
                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Estado del sistema</span>
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    <span className="text-xs font-medium text-green-600">Operativo</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}