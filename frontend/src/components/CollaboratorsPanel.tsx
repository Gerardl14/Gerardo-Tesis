'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Users, UserPlus, X, Check, XCircle, Trash2, Search, Shield, Eye, Edit3, ChevronDown, ChevronUp } from 'lucide-react';

interface Collaborator {
  id: string;
  repo_id: string;
  user_id: string;
  role: 'viewer' | 'editor';
  invited_by: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  user_name?: string;
  user_email?: string;
}

interface SearchResult {
  id: string;
  full_name: string | null;
  role: string;
}

interface Props {
  repoId: string;
  userId: string;
  userRole: string;
  repoOwnerId: string;
}

export default function CollaboratorsPanel({ repoId, userId, userRole, repoOwnerId }: Props) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [inviteRole, setInviteRole] = useState<'viewer' | 'editor'>('viewer');
  const [loading, setLoading] = useState(false);

  const isOwner = userId === repoOwnerId;
  const isSuperAdmin = userRole === 'superadministrador';
  const canManage = isOwner || isSuperAdmin;

  useEffect(() => {
    loadCollaborators();
  }, [repoId]);

  const loadCollaborators = async () => {
    const { data, error } = await supabase
      .from('repository_collaborators')
      .select('*')
      .eq('repo_id', repoId)
      .order('created_at', { ascending: true });

    if (error) { console.error('[Collabs] Load error:', error); return; }

    // Fetch user names
    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(c => c.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const nameMap: Record<string, string> = {};
      profiles?.forEach(p => { nameMap[p.id] = p.full_name || 'Usuario'; });
      data.forEach(c => { c.user_name = nameMap[c.user_id] || 'Usuario'; });
    }

    setCollaborators(data || []);
  };

  const searchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }

    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .ilike('full_name', `%${query}%`)
      .limit(10);

    // Filter out existing collaborators and the repo owner
    const existingIds = new Set([repoOwnerId, ...collaborators.map(c => c.user_id)]);
    setSearchResults((data || []).filter(u => !existingIds.has(u.id)));
  };

  const inviteUser = async (targetUserId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from('repository_collaborators').insert({
        repo_id: repoId,
        user_id: targetUserId,
        role: inviteRole,
        invited_by: userId,
        status: 'pending',
      });
      if (error) throw error;

      setSearchQuery('');
      setSearchResults([]);
      loadCollaborators();
    } catch (err: any) {
      console.error('[Collabs] Invite error:', err);
      alert(err.message || 'Error al enviar la invitación');
    } finally {
      setLoading(false);
    }
  };

  const respondInvitation = async (collabId: string, response: 'accepted' | 'rejected') => {
    await supabase
      .from('repository_collaborators')
      .update({ status: response })
      .eq('id', collabId);
    loadCollaborators();
  };

  const removeCollaborator = async (collabId: string) => {
    if (!confirm('¿Eliminar este colaborador?')) return;
    await supabase.from('repository_collaborators').delete().eq('id', collabId);
    loadCollaborators();
  };

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: 'Pendiente', color: '#ffb74d', bg: 'rgba(255,183,77,0.1)' },
    accepted: { label: 'Activo', color: 'var(--tertiary)', bg: 'rgba(155,255,206,0.1)' },
    rejected: { label: 'Rechazado', color: 'var(--error)', bg: 'rgba(255,113,108,0.1)' },
  };

  // Check if current user has a pending invitation
  const myPendingInvite = collaborators.find(c => c.user_id === userId && c.status === 'pending');

  return (
    <div style={{
      background: 'var(--surface-container)',
      border: '1px solid rgba(72,72,73,0.15)',
      borderRadius: '0.75rem',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.25rem', background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--on-surface)', fontFamily: 'Inter',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Users size={20} color="var(--primary)" />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Colaboradores</span>
          {collaborators.filter(c => c.status === 'accepted').length > 0 && (
            <span className="badge badge-cyan" style={{ marginLeft: '0.5rem' }}>
              {collaborators.filter(c => c.status === 'accepted').length} activos
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={18} color="var(--on-surface-variant)" /> : <ChevronDown size={18} color="var(--on-surface-variant)" />}
      </button>

      {isExpanded && (
        <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

          {/* Pending invitation for the current user */}
          {myPendingInvite && (
            <div style={{
              background: 'rgba(109,221,255,0.08)',
              border: '1px solid rgba(109,221,255,0.2)',
              borderRadius: '0.75rem',
              padding: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
            }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                Te han invitado a colaborar en este repositorio como{' '}
                <strong style={{ color: 'var(--primary)' }}>{myPendingInvite.role === 'editor' ? 'Editor' : 'Observador'}</strong>
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                <button
                  className="btn-primary"
                  onClick={() => respondInvitation(myPendingInvite.id, 'accepted')}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Check size={14} /> Aceptar
                </button>
                <button
                  className="btn-ghost"
                  onClick={() => respondInvitation(myPendingInvite.id, 'rejected')}
                  style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', color: 'var(--error)', borderColor: 'rgba(255,113,108,0.3)' }}
                >
                  Rechazar
                </button>
              </div>
            </div>
          )}

          {/* Collaborator list */}
          {collaborators.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {collaborators.map(collab => (
                <div key={collab.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem',
                  background: 'var(--surface-container-high)',
                  borderRadius: '0.5rem',
                }}>
                  {/* Avatar placeholder */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(109,221,255,0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)',
                    flexShrink: 0,
                  }}>
                    {(collab.user_name || 'U')[0].toUpperCase()}
                  </div>

                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{collab.user_name}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.15rem' }}>
                      <span style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.2rem', color: 'var(--on-surface-variant)' }}>
                        {collab.role === 'editor' ? <><Edit3 size={10} /> Editor</> : <><Eye size={10} /> Observador</>}
                      </span>
                      <span style={{
                        fontSize: '0.65rem', fontWeight: 600,
                        padding: '0.1rem 0.4rem', borderRadius: '9999px',
                        background: statusConfig[collab.status].bg,
                        color: statusConfig[collab.status].color,
                      }}>
                        {statusConfig[collab.status].label}
                      </span>
                    </div>
                  </div>

                  {/* Remove button */}
                  {canManage && (
                    <button
                      onClick={() => removeCollaborator(collab.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)', padding: '0.25rem' }}
                      title="Eliminar colaborador"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ textAlign: 'center', padding: '1rem', color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>
              No hay colaboradores en este repositorio.
            </p>
          )}

          {/* Invite section — only for owner / superadmin */}
          {canManage && (
            <>
              {!showInvite ? (
                <button
                  onClick={() => setShowInvite(true)}
                  className="btn-ghost"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <UserPlus size={16} /> Invitar Colaborador
                </button>
              ) : (
                <div style={{
                  background: 'var(--surface-container-high)',
                  border: '1px solid rgba(109,221,255,0.15)',
                  borderRadius: '0.75rem',
                  padding: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <UserPlus size={16} color="var(--primary)" /> Invitar Colaborador
                    </h4>
                    <button onClick={() => { setShowInvite(false); setSearchQuery(''); setSearchResults([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                      <X size={16} />
                    </button>
                  </div>

                  {/* Role selector */}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => setInviteRole('viewer')}
                      style={{
                        flex: 1, padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem',
                        fontWeight: 600, fontFamily: 'Inter', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                        background: inviteRole === 'viewer' ? 'rgba(109,221,255,0.12)' : 'transparent',
                        border: `1px solid ${inviteRole === 'viewer' ? 'rgba(109,221,255,0.3)' : 'rgba(72,72,73,0.2)'}`,
                        color: inviteRole === 'viewer' ? 'var(--primary)' : 'var(--on-surface-variant)',
                      }}
                    >
                      <Eye size={14} /> Observador
                    </button>
                    <button
                      onClick={() => setInviteRole('editor')}
                      style={{
                        flex: 1, padding: '0.5rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.8rem',
                        fontWeight: 600, fontFamily: 'Inter', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem',
                        background: inviteRole === 'editor' ? 'rgba(193,128,255,0.12)' : 'transparent',
                        border: `1px solid ${inviteRole === 'editor' ? 'rgba(193,128,255,0.3)' : 'rgba(72,72,73,0.2)'}`,
                        color: inviteRole === 'editor' ? 'var(--secondary)' : 'var(--on-surface-variant)',
                      }}
                    >
                      <Edit3 size={14} /> Editor
                    </button>
                  </div>

                  {/* Search */}
                  <div style={{ position: 'relative' }}>
                    <Search size={16} color="var(--on-surface-variant)" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                    <input
                      className="input-field"
                      placeholder="Buscar por nombre..."
                      value={searchQuery}
                      onChange={(e) => searchUsers(e.target.value)}
                      style={{ paddingLeft: '2.25rem' }}
                    />
                  </div>

                  {/* Results */}
                  {searchResults.length > 0 && (
                    <div style={{ border: '1px solid rgba(72,72,73,0.2)', borderRadius: '0.5rem', maxHeight: '180px', overflowY: 'auto', background: 'var(--surface-container)' }}>
                      {searchResults.map(user => (
                        <div
                          key={user.id}
                          onClick={() => inviteUser(user.id)}
                          style={{
                            padding: '0.75rem',
                            borderBottom: '1px solid rgba(72,72,73,0.1)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(109,221,255,0.06)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: '50%',
                            background: 'rgba(193,128,255,0.15)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.8rem', fontWeight: 700, color: 'var(--secondary)',
                          }}>
                            {(user.full_name || 'U')[0].toUpperCase()}
                          </div>
                          <div style={{ flex: 1 }}>
                            <p style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.full_name || 'Sin nombre'}</p>
                            <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>{user.role}</p>
                          </div>
                          <UserPlus size={16} color="var(--primary)" />
                        </div>
                      ))}
                    </div>
                  )}
                  {searchQuery.length >= 2 && searchResults.length === 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', textAlign: 'center', padding: '0.5rem' }}>
                      No se encontraron usuarios.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
