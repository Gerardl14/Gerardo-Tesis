'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      console.error('[Register] Network error:', err);
      setError('Error de conexión. Verifica tu conexión a internet e inténtalo de nuevo.');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)' }}>
        <div className="card animate-in" style={{ maxWidth: '440px', textAlign: 'center', padding: '3rem' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(155,255,206,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <UserPlus size={28} color="var(--tertiary)" />
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.75rem' }}>¡Registro Exitoso!</h2>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
            Hemos enviado un correo de confirmación a <strong style={{ color: 'var(--on-surface)' }}>{email}</strong>. 
            Por favor revisa tu bandeja de entrada y confirma tu cuenta para comenzar.
          </p>
          <Link href="/login">
            <button className="btn-primary" style={{ width: '100%' }}>Ir a Iniciar Sesión</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Panel Izquierdo */}
      <div style={{
        flex: 1,
        background: 'linear-gradient(135deg, #0e0e0f 0%, #131314 40%, #1a191b 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '3rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', width: '400px', height: '400px',
          background: 'radial-gradient(circle, rgba(155,255,206,0.1) 0%, transparent 70%)',
          top: '25%', left: '25%', borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', width: '300px', height: '300px',
          background: 'radial-gradient(circle, rgba(109,221,255,0.08) 0%, transparent 70%)',
          bottom: '25%', right: '25%', borderRadius: '50%',
        }} />
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <h1 style={{ fontSize: '3rem', fontWeight: 800, fontFamily: 'Manrope', letterSpacing: '-0.03em', marginBottom: '1rem' }}>
            Únete a <span style={{ color: 'var(--tertiary)' }}>AIS Lab</span>
          </h1>
          <p style={{ color: 'var(--on-surface-variant)', fontSize: '1.1rem', maxWidth: '400px', lineHeight: 1.6 }}>
            Comienza tu camino como estudiante del Área de Ingeniería en Sistemas. Colabora, comparte código y aprende junto a tus compañeros.
          </p>
        </div>
      </div>

      {/* Panel Derecho */}
      <div style={{
        width: '480px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '3rem',
        background: 'var(--surface-container-low)',
      }}>
        <div className="animate-in">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '0.75rem',
              background: 'linear-gradient(135deg, var(--tertiary), var(--tertiary-container))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserPlus size={20} color="#002c37" />
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Registro de Estudiante</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>Crea tu cuenta gratis</p>
            </div>
          </div>

          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Nombre Completo
              </label>
              <input type="text" className="input-field" placeholder="Ej: Carlos Pérez" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Correo Electrónico
              </label>
              <input type="email" className="input-field" placeholder="tucorreo@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} className="input-field" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ paddingRight: '3rem' }} />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Confirmar Contraseña
              </label>
              <input type="password" className="input-field" placeholder="Repite la contraseña" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>

            {error && (
              <p style={{ color: 'var(--error)', fontSize: '0.8rem', padding: '0.5rem 0.75rem', background: 'rgba(159,5,25,0.15)', borderRadius: '0.5rem' }}>
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
              {loading ? 'Registrando...' : 'Crear Cuenta de Estudiante'}
            </button>
          </form>

          <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>
              ¿Ya tienes una cuenta?{' '}
              <Link href="/login" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
                Inicia sesión
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
