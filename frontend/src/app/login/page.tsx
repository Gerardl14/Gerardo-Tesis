'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/store';
import { LogIn, Eye, EyeOff, GraduationCap, BookOpen, Shield } from 'lucide-react';

type LoginMode = 'estudiante' | 'docente' | 'superadministrador';

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, setUser, fetchProfile } = useAuthStore();
  const [mode, setMode] = useState<LoginMode>('estudiante');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If already logged in, redirect
  useEffect(() => {
    if (user && profile) {
      router.replace('/dashboard');
    }
  }, [user, profile, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError('Correo electrónico o contraseña incorrectos.');
        setLoading(false);
        return;
      }

      if (!data.user) {
        setError('No se pudo autenticar. Inténtalo de nuevo.');
        setLoading(false);
        return;
      }

      // Store user preference for session persistence
      if (rememberMe) {
        localStorage.setItem('remember_me', 'true');
      } else {
        localStorage.removeItem('remember_me');
      }

      // Explicitly set user and fetch profile BEFORE navigating
      setUser(data.user);
      await fetchProfile(data.user.id);

      // Redirect — profile is now guaranteed to be loaded
      router.replace('/dashboard');
    } catch (err) {
      console.error('[Login] Network error:', err);
      setError('Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo.');
      setLoading(false);
    }
  };

  const modeConfig = {
    estudiante: {
      icon: GraduationCap,
      label: 'Estudiante',
      color: 'var(--primary)',
      bg: 'rgba(109,221,255,0.1)',
      gradient: 'linear-gradient(135deg, rgba(109,221,255,0.12) 0%, transparent 70%)',
    },
    docente: {
      icon: BookOpen,
      label: 'Docente / Preparador',
      color: 'var(--secondary)',
      bg: 'rgba(193,128,255,0.1)',
      gradient: 'linear-gradient(135deg, rgba(193,128,255,0.12) 0%, transparent 70%)',
    },
    superadministrador: {
      icon: Shield,
      label: 'Administrador',
      color: 'var(--error)',
      bg: 'rgba(255,113,108,0.1)',
      gradient: 'linear-gradient(135deg, rgba(255,113,108,0.12) 0%, transparent 70%)',
    },
  };

  const current = modeConfig[mode];
  const Icon = current.icon;

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Panel izquierdo */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #0e0e0f 0%, #131314 40%, #1a191b 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '3rem', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', width: '500px', height: '500px', background: current.gradient, top: '10%', left: '20%', borderRadius: '50%', transition: 'background 0.5s ease' }} />
        <div style={{ position: 'absolute', width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(193,128,255,0.06) 0%, transparent 70%)', bottom: '15%', right: '15%', borderRadius: '50%' }} />

        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, fontFamily: 'Manrope', letterSpacing: '-0.03em', marginBottom: '1rem' }}>
            <span style={{ color: current.color, transition: 'color 0.3s' }}>AIS</span> Lab
          </h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '1rem', maxWidth: '380px', lineHeight: 1.7, marginBottom: '2rem' }}>
            Plataforma de aprendizaje colaborativo con integración de repositorios de código para el Área de Ingeniería en Sistemas.
          </p>

          {/* Role selector */}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {(Object.keys(modeConfig) as LoginMode[]).map((m) => {
              const cfg = modeConfig[m];
              const MIcon = cfg.icon;
              return (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.9rem', borderRadius: '9999px',
                    border: `1px solid ${mode === m ? cfg.color : 'rgba(72,72,73,0.3)'}`,
                    background: mode === m ? cfg.bg : 'transparent',
                    color: mode === m ? cfg.color : 'var(--on-surface-variant)',
                    cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    fontFamily: 'Inter', transition: 'all 0.2s',
                  }}
                >
                  <MIcon size={14} />
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Panel derecho - formulario */}
      <div style={{
        width: '460px', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '3rem',
        background: 'var(--surface-container-low)',
      }}>
        <div className="animate-in">
          {/* Header del form */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '2rem' }}>
            <div style={{
              width: 44, height: 44, borderRadius: '0.875rem',
              background: current.bg, border: `1px solid ${current.color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.3s',
            }}>
              <Icon size={22} color={current.color} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>Iniciar Sesión</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>
                Acceso como <span style={{ color: current.color, fontWeight: 600 }}>{current.label}</span>
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }} autoComplete="off">
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Correo Electrónico
              </label>
              <input
                type="email"
                className="input-field"
                placeholder="tucorreo@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
                name="email-no-autocomplete"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Checkbox Recordarme */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: current.color }}
              />
              <label htmlFor="rememberMe" style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', cursor: 'pointer', userSelect: 'none' }}>
                Mantener mi sesión iniciada
              </label>
            </div>

            {error && (
              <div style={{ color: 'var(--error)', fontSize: '0.82rem', padding: '0.6rem 0.875rem', background: 'rgba(255,113,108,0.1)', borderRadius: '0.6rem', border: '1px solid rgba(255,113,108,0.2)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: '0.25rem', padding: '0.8rem 1.5rem',
                background: `linear-gradient(135deg, ${current.color}, ${current.color}cc)`,
                color: mode === 'estudiante' ? 'var(--on-primary-fixed)' : '#fff',
                border: 'none', borderRadius: '0.75rem', fontWeight: 700,
                fontSize: '0.95rem', fontFamily: 'Inter', cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1, transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              }}
            >
              {loading ? (
                <>
                  <div className="spinner" style={{ width: 18, height: 18, borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />
                  Verificando...
                </>
              ) : (
                <>
                  <LogIn size={18} />
                  Entrar como {current.label}
                </>
              )}
            </button>
          </form>

          {mode === 'estudiante' && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--on-surface-variant)' }}>
                ¿No tienes cuenta?{' '}
                <Link href="/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                  Regístrate aquí
                </Link>
              </p>
            </div>
          )}

          {mode !== 'estudiante' && (
            <div style={{ marginTop: '1.5rem', padding: '0.875rem', background: 'rgba(72,72,73,0.1)', borderRadius: '0.6rem', border: '1px solid rgba(72,72,73,0.2)' }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--on-surface-variant)', textAlign: 'center' }}>
                {mode === 'docente'
                  ? 'Las cuentas de docente son creadas por el administrador del sistema.'
                  : 'El acceso de administrador está restringido. Contacta con soporte si tienes problemas.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
