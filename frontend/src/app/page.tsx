'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store';
import { Terminal, Code2, Users, Database, ArrowRight, ShieldCheck, Zap } from 'lucide-react';

export default function Home() {
  const { user, loading } = useAuthStore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true);
    if (user) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  if (!mounted || loading) return null; // Avoid hydration mismatch

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <header className="glass" style={{
        position: 'fixed', top: 0, width: '100%', zIndex: 50,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 2rem', borderBottom: '1px solid rgba(255,255,255,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Code2 size={28} color="var(--primary)" />
          <h1 style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: '1.5rem', color: 'var(--on-surface)', margin: 0, letterSpacing: '-0.03em' }}>
            AIS<span style={{ color: 'var(--on-surface-variant)', fontWeight: 400 }}> Lab</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <Link href="/login" className="btn-ghost" style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem', textDecoration: 'none' }}>
            Ingresar
          </Link>
          <Link href="/register" className="btn-primary" style={{ padding: '0.5rem 1.5rem', fontSize: '0.9rem', textDecoration: 'none' }}>
            Registro Estudiantes
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1 }}>
        <section className="landing-hero" style={{ minHeight: '80vh', justifyContent: 'center' }}>
          {/* Decorative Orbs */}
          <div className="floating-orb" style={{ width: 400, height: 400, background: 'rgba(109,221,255,0.15)', top: '-10%', left: '-5%' }} />
          <div className="floating-orb" style={{ width: 300, height: 300, background: 'rgba(193,128,255,0.15)', bottom: '10%', right: '5%', animationDelay: '-10s' }} />

          <div className="animate-in" style={{ position: 'relative', zIndex: 10, maxWidth: '800px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <span className="badge badge-cyan" style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <Zap size={14} style={{ marginRight: '6px' }} /> Plataforma UNERG v2.0
            </span>
            <h2 style={{ fontSize: '4.5rem', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.04em', margin: 0 }}>
              Código colaborativo para la <br/>
              <span className="text-gradient">Generación AIS</span>
            </h2>
            <p style={{ fontSize: '1.2rem', color: 'var(--on-surface-variant)', maxWidth: '600px', lineHeight: 1.6, marginTop: '1rem' }}>
              El entorno de aprendizaje definitivo. Sincroniza repositorios, colabora en tiempo real, compila tu código y recibe feedback directo de tus docentes.
            </p>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <Link href="/register" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '1rem 2rem', fontSize: '1.1rem', textDecoration: 'none' }}>
                Comenzar ahora <ArrowRight size={18} />
              </Link>
              <Link href="/login" className="btn-ghost" style={{ padding: '1rem 2rem', fontSize: '1.1rem', textDecoration: 'none' }}>
                Ya tengo cuenta
              </Link>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section style={{ padding: '4rem 0 6rem', background: 'var(--surface-container-low)', position: 'relative', zIndex: 5 }}>
          <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
            <h3 style={{ fontSize: '2.5rem', fontWeight: 800 }}>Herramientas de Nivel Profesional</h3>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '1.1rem' }}>Diseñado para hacer la enseñanza de programación más interactiva.</p>
          </div>
          
          <div className="feature-grid">
            <div className="card glass-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: 50, height: 50, borderRadius: '12px', background: 'rgba(109,221,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Terminal size={24} color="var(--primary)" />
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Sandbox en Vivo</h4>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Prueba código JavaScript directamente en el navegador de manera aislada y segura, viendo resultados instantáneos.
              </p>
            </div>

            <div className="card glass-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: 50, height: 50, borderRadius: '12px', background: 'rgba(193,128,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={24} color="var(--secondary)" />
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Feedback Línea por Línea</h4>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Docentes pueden dejar comentarios y correcciones exactamente en la línea de código donde ocurre el error.
              </p>
            </div>

            <div className="card glass-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: 50, height: 50, borderRadius: '12px', background: 'rgba(155,255,206,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Database size={24} color="var(--tertiary)" />
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Sincronización Rápida</h4>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Sube proyectos enteros mediante .ZIP en segundos, o importa de plataformas en la nube.
              </p>
            </div>
            
             <div className="card glass-hover" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ width: 50, height: 50, borderRadius: '12px', background: 'rgba(255,113,108,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={24} color="var(--error)" />
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Privacidad y Roles</h4>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Seguridad de nivel empresarial con accesos granulares para Estudiantes, Docentes y Super Administradores.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ padding: '2rem', textAlign: 'center', borderTop: '1px solid rgba(72,72,73,0.15)', background: 'var(--surface)' }}>
        <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>
          © {new Date().getFullYear()} Área de Ingeniería en Sistemas. Universidad Nacional Experimental Rómulo Gallegos. Tesis de Grado.
        </p>
      </footer>
    </div>
  );
}
