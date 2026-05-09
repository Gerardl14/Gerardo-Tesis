'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { User, Save, Mail, Shield, KeyRound, RefreshCw } from 'lucide-react';

export default function ProfilePage() {
  const { user, profile, profileError, fetchProfile } = useAuthStore();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }

    if (!profile && !profileError) {
      fetchProfile(user.id);
    }
  }, [user, profile, profileError, router, fetchProfile]);

  // Sync local state when profile loads
  useEffect(() => {
    if (profile) {
      // eslint-disable-next-line
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) {
      setMsg('Error al guardar los cambios.');
    } else {
      setMsg('Perfil actualizado correctamente.');
      await fetchProfile(user.id);
    }
    setSaving(false);
    setTimeout(() => setMsg(''), 3000);
  };

  if (!user) return null;

  // Error state
  if (profileError) {
    return (
      <>
        <Sidebar />
        <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(255,113,108,0.1)', display: 'flex',
              alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
            }}>
              <User size={28} color="var(--error)" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Error al cargar el perfil
            </h2>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              No se pudo recuperar tu información. Esto puede ser un error temporal.
            </p>
            <button
              className="btn-primary"
              onClick={() => user && fetchProfile(user.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <RefreshCw size={16} /> Reintentar
            </button>
          </div>
        </div>
      </>
    );
  }

  // Loading state
  if (!profile) {
    return (
      <>
        <Sidebar />
        <div className="main-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>Cargando perfil...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const roleName = profile.role === 'superadministrador'
    ? 'Super Administrador'
    : profile.role === 'docente'
      ? 'Docente / Preparador'
      : 'Estudiante';

  const roleColor = profile.role === 'superadministrador'
    ? 'var(--error)'
    : profile.role === 'docente'
      ? 'var(--secondary)'
      : 'var(--primary)';

  const memberSince = (() => {
    try {
      const dateStr = profile.created_at?.replace(' ', 'T');
      if (!dateStr) return '';
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString('es-VE', { year: 'numeric', month: 'long' });
    } catch {
      return '';
    }
  })();

  return (
    <>
      <Sidebar />
      <div className="main-content">
        <div className="animate-in">
          {/* Banner */}
          <div style={{
            height: '160px',
            borderRadius: '1rem',
            background: 'linear-gradient(135deg, rgba(109,221,255,0.15) 0%, rgba(193,128,255,0.1) 50%, rgba(155,255,206,0.08) 100%)',
            marginBottom: '-3rem',
            position: 'relative',
          }} />

          {/* Avatar + Info */}
          <div style={{ padding: '0 2rem', position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '4px solid var(--surface)',
              marginBottom: '1rem',
            }}>
              <User size={36} color="var(--on-primary-fixed)" />
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>{profile.full_name || 'Sin nombre'}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                padding: '0.2rem 0.65rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                background: `color-mix(in srgb, ${roleColor} 15%, transparent)`,
                color: roleColor,
              }}>
                <Shield size={12} />
                {roleName}
              </span>
              {memberSince && (
                <span style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>
                  Miembro desde {memberSince}
                </span>
              )}
            </div>
          </div>

          {/* Formulario */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '2rem' }}>
            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={18} color="var(--primary)" />
                Información Personal
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre Completo</label>
                  <input className="input-field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Mail size={13} />
                      Correo Electrónico
                    </span>
                  </label>
                  <input className="input-field" value={user.email || ''} disabled style={{ opacity: 0.6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <Shield size={13} />
                      Rol
                    </span>
                  </label>
                  <input className="input-field" value={roleName} disabled style={{ opacity: 0.6 }} />
                </div>

                {msg && (
                  <p style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                    background: msg.includes('Error') ? 'rgba(159,5,25,0.15)' : 'rgba(155,255,206,0.1)',
                    color: msg.includes('Error') ? 'var(--error)' : 'var(--tertiary)',
                  }}>{msg}</p>
                )}

                <button onClick={handleSave} className="btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                  <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </div>

            <div className="card">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <KeyRound size={18} color="var(--secondary)" />
                Configuración de Cuenta
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ padding: '1rem', background: 'var(--surface-container-highest)', borderRadius: '0.5rem' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Correos de Notificación</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>Los correos de confirmación y recuperación son gestionados por Supabase.</p>
                </div>
                <div style={{ padding: '1rem', background: 'var(--surface-container-highest)', borderRadius: '0.5rem' }}>
                  <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>Seguridad</p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>Para cambiar tu contraseña, usa la opción de recuperación desde el inicio de sesión.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
