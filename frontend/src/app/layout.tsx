import type { Metadata } from 'next';
import './globals.css';
import AuthProvider from '@/components/AuthProvider';
import ErrorBoundary from '@/components/ErrorBoundary';

export const metadata: Metadata = {
  title: 'AIS Lab - Plataforma de Aprendizaje Colaborativo',
  description: 'Plataforma de aprendizaje colaborativo con integración de repositorios de código para el Área de Ingeniería en Sistemas.',
  keywords: 'aprendizaje, colaborativo, código, repositorios, foro, UNERG, ingeniería, sistemas',
  authors: [{ name: 'AIS Lab' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0e0e0f" />
      </head>
      <body>
        <ErrorBoundary fallbackMessage="Ocurrió un error cargando la aplicación. Intenta recargar la página.">
          <AuthProvider>{children}</AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
