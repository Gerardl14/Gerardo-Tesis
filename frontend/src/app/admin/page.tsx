'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { Shield, Plus, Pencil, Trash2, X, Users, UserCheck, GraduationCap, Search } from 'lucide-react';

interface AdminUser {
  id: string;
  full_name: string | null;
  role: string;
  email: string;
  created_at: string;
}

export default function AdminPage() {
  const { user, profile, profileError, fetchProfile } = useAuthStore();
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState('docente');
  const [formError, setFormError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }

    if (!profile && !profileError) {
      fetchProfile(user.id);
      return;
    }

    if (profile && profile.role !== 'superadministrador') {
      router.replace('/dashboard');
      return;
    }

    if (profile) {
      loadUsers();
    }
  }, [user, profile, profileError, router, fetchProfile]);

  const getEdgeFunctionUrl = () => {
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/admin-create-user`;
  };

  const callAdmin = async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No autenticado');

    const res = await fetch(getEdgeFunctionUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  };

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await callAdmin({ action: 'list' });
      setUsers(data.users || []);
    } catch (e: any) {
      console.error('Error cargando usuarios:', e.message);
    }
    setLoading(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormLoading(true);
    try {
      await callAdmin({ action: 'create', email: formEmail, password: formPassword, full_name: formName, role: formRole });
      setShowCreateModal(false);
      resetForm();
      loadUsers();
    } catch (e: any) {
      setFormError(e.message);
    }
    setFormLoading(false);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setFormError('');
    setFormLoading(true);
    try {
      await callAdmin({ action: 'update', user_id: editingUser.id, full_name: formName, role: formRole });
      setShowEditModal(false);
      resetForm();
      loadUsers();
    } catch (e: any) {
      setFormError(e.message);
    }
    setFormLoading(false);
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`¿Estás seguro de eliminar al usuario "${userName}"? Esta acción no se puede deshacer.`)) return;
    try {
      // Eliminación optimista para actualizar UI inmediatamente (evita lag de read replica)
      setUsers((prev: AdminUser[]) => prev.filter((u: AdminUser) => u.id !== userId));

      await callAdmin({ action: 'delete', user_id: userId });
      // Removemos la carga síncrona aquí porque ya se quitó localmente
    } catch (e: any) {
      alert('Error al eliminar: ' + e.message);
      loadUsers(); // Revertimos en caso de error
    }
  };

  const openEdit = (u: AdminUser) => {
    setEditingUser(u);
    setFormName(u.full_name || '');
    setFormRole(u.role);
    setFormError('');
    setShowEditModal(true);
  };

  const resetForm = () => {
    setFormEmail(''); setFormPassword(''); setFormName(''); setFormRole('docente'); setFormError('');
  };

  if (!user) return null;

  // Show loading while we wait for the profile to be fetched
  if (!profile) {
    return (
      <>
        <Sidebar />
        <div className="main-content">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 1rem' }} />
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>Verificando permisos...</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (profile.role !== 'superadministrador') return null;

  const filteredUsers = users.filter((u: AdminUser) =>
    (u.full_name || '').toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    students: users.filter((u: AdminUser) => u.role === 'estudiante').length,
    teachers: users.filter((u: AdminUser) => u.role === 'docente').length,
    admins: users.filter((u: AdminUser) => u.role === 'superadministrador').length,
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'superadministrador': return <span className="badge badge-red">Super Admin</span>;
      case 'docente': return <span className="badge badge-purple">Docente</span>;
      default: return <span className="badge badge-cyan">Estudiante</span>;
    }
  };

  return (
    <>
      <Sidebar />
      <div className="main-content">
        <div className="animate-in">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--error)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Shield size={14} /> Panel de Administración
              </p>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Gestión de Usuarios</h1>
            </div>
            <button className="btn-primary" onClick={() => { resetForm(); setShowCreateModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} /> Crear Usuario
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
            <div className="stat-card">
              <span className="stat-label">Total Usuarios</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="stat-label">Estudiantes</span>
                <GraduationCap size={18} color="var(--primary)" />
              </div>
              <span className="stat-value" style={{ color: 'var(--primary)' }}>{stats.students}</span>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="stat-label">Docentes</span>
                <UserCheck size={18} color="var(--secondary)" />
              </div>
              <span className="stat-value" style={{ color: 'var(--secondary)' }}>{stats.teachers}</span>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="stat-label">Administradores</span>
                <Shield size={18} color="var(--error)" />
              </div>
              <span className="stat-value" style={{ color: 'var(--error)' }}>{stats.admins}</span>
            </div>
          </div>

          {/* Search */}
          <div style={{ marginBottom: '1rem', position: 'relative' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--on-surface-variant)' }} />
            <input className="input-field" placeholder="Buscar por nombre, correo o rol..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: '2.75rem' }} />
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <div className="spinner" />
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Correo</th>
                    <th>Rol</th>
                    <th>Registrado</th>
                    <th style={{ textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u: AdminUser) => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 600 }}>{u.full_name || 'Sin nombre'}</td>
                      <td style={{ color: 'var(--on-surface-variant)' }}>{u.email}</td>
                      <td>{getRoleBadge(u.role)}</td>
                    <td style={{ color: 'var(--on-surface-variant)' }}>{u.created_at ? new Date(u.created_at.replace(' ', 'T')).toLocaleDateString('es-VE') : ''}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button onClick={() => openEdit(u)} className="btn-ghost" style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Pencil size={14} /> Editar
                          </button>
                          {u.id !== user?.id && (
                            <button onClick={() => handleDelete(u.id, u.full_name || u.email)} className="btn-danger" style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Trash2 size={14} /> Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Crear */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content animate-in" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Crear Nuevo Usuario</h2>
                <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}><X size={20} /></button>
              </div>
              <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre Completo</label>
                  <input className="input-field" placeholder="Nombre del usuario" value={formName} onChange={(e) => setFormName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Correo Electrónico</label>
                  <input className="input-field" type="email" placeholder="correo@ejemplo.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Contraseña</label>
                  <input className="input-field" type="password" placeholder="Mínimo 6 caracteres" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} required minLength={6} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Rol</label>
                  <select className="input-field" value={formRole} onChange={(e) => setFormRole(e.target.value)}>
                    <option value="estudiante">Estudiante</option>
                    <option value="docente">Docente / Preparador</option>
                    <option value="superadministrador">Super Administrador</option>
                  </select>
                </div>
                {formError && (
                  <p style={{ color: 'var(--error)', fontSize: '0.8rem', padding: '0.5rem 0.75rem', background: 'rgba(159,5,25,0.15)', borderRadius: '0.5rem' }}>{formError}</p>
                )}
                <button type="submit" className="btn-primary" disabled={formLoading}>{formLoading ? 'Creando...' : 'Crear Usuario'}</button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Editar */}
        {showEditModal && editingUser && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content animate-in" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Editar Usuario</h2>
                <button onClick={() => setShowEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}><X size={20} /></button>
              </div>
              <form onSubmit={handleEdit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Correo (no editable)</label>
                  <input className="input-field" value={editingUser.email} disabled style={{ opacity: 0.6 }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre Completo</label>
                  <input className="input-field" value={formName} onChange={(e) => setFormName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Rol</label>
                  <select className="input-field" value={formRole} onChange={(e) => setFormRole(e.target.value)}>
                    <option value="estudiante">Estudiante</option>
                    <option value="docente">Docente / Preparador</option>
                    <option value="superadministrador">Super Administrador</option>
                  </select>
                </div>
                {formError && (
                  <p style={{ color: 'var(--error)', fontSize: '0.8rem', padding: '0.5rem 0.75rem', background: 'rgba(159,5,25,0.15)', borderRadius: '0.5rem' }}>{formError}</p>
                )}
                <button type="submit" className="btn-primary" disabled={formLoading}>{formLoading ? 'Guardando...' : 'Guardar Cambios'}</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
