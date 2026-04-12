import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/src/components/layout/Header';
import Footer from '@/src/components/layout/Footer';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
    title: 'ESG Supplier Auditor - Sistema de Evaluación de Sostenibilidad',
    description: 'Automatización de evaluación ambiental para proveedores. Calcula huella de carbono e hídrica en tiempo real.',
    keywords: 'ESG, sostenibilidad, huella de carbono, evaluación proveedores, medio ambiente, POO',
    authors: [{ name: 'ESG Auditor Team' }],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="es">
            <body className={`${inter.className} flex flex-col min-h-screen`}>
                <Header />
                <main className="flex-grow">
                    {children}
                </main>
                <Footer />
            </body>
        </html>
    );
}