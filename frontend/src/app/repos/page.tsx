'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import GithubImportModal from '@/components/GithubImportModal';
import LocalUploadModal from '@/components/LocalUploadModal';
import GithubIcon from '@/components/GithubIcon';
import { Plus, FolderGit2, Trash2, Code, Clock, X, FileArchive } from 'lucide-react';

interface Repo {
  id: string;
  name: string;
  description: string | null;
  primary_language: string | null;
  owner_id: string;
  created_at: string;
}

export default function ReposPage() {
  const { user, profile } = useAuthStore();
  const router = useRouter();
  const [repos, setRepos] = useState<Repo[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showGithubModal, setShowGithubModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [lang, setLang] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    loadRepos();
  }, [user, router]);

  const loadRepos = async () => {
    const { data } = await supabase.from('repositories').select('*').order('created_at', { ascending: false });
    setRepos(data || []);
  };

  const createRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);
    await supabase.from('repositories').insert({ name, description: desc || null, primary_language: lang || null, owner_id: user.id });
    setShowModal(false);
    setName(''); setDesc(''); setLang('');
    setLoading(false);
    loadRepos();
  };

  const deleteRepo = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este repositorio?')) return;
    await supabase.from('repositories').delete().eq('id', id);
    loadRepos();
  };

  if (!user) return null;

  const languages = ['JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Go', 'Rust', 'Otro'];

  return (
    <>
      <Sidebar />
      <div className="main-content">
        <div className="animate-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                Repositorios Colaborativos
              </p>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Mis Proyectos</h1>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button className="btn-ghost" onClick={() => setShowUploadModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)' }}>
                <FileArchive size={18} /> Subir .ZIP
              </button>
              <button className="btn-ghost" onClick={() => setShowGithubModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--outline-variant)', color: 'var(--on-surface)' }}>
                <GithubIcon size={18} /> Importar de GitHub
              </button>
              <button className="btn-primary" onClick={() => setShowModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={18} /> Nuevo Repositorio
              </button>
            </div>
          </div>

          {repos.length === 0 ? (
            <div className="empty-state">
              <FolderGit2 size={48} strokeWidth={1} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Sin repositorios aún</h3>
              <p style={{ fontSize: '0.85rem' }}>Crea tu primer repositorio o importa uno para comenzar.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
              {repos.map((repo) => (
                <div key={repo.id} className="card glass-hover" style={{ cursor: 'pointer', position: 'relative' }} onClick={() => router.push(`/repos/${repo.id}`)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <FolderGit2 size={22} color="var(--primary)" />
                      <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{repo.name}</h3>
                    </div>
                    {((repo.owner_id && user && repo.owner_id === user.id) || profile?.role === 'superadministrador') && (
                      <button onClick={(e) => { e.stopPropagation(); deleteRepo(repo.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)', padding: '0.25rem' }}>
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  {repo.description && (
                    <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem', marginTop: '0.75rem', lineHeight: 1.5 }}>
                      {repo.description}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '1rem' }}>
                    {repo.primary_language && (
                      <span className="badge badge-cyan"><Code size={12} style={{ marginRight: 4 }} />{repo.primary_language}</span>
                    )}
                    <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} />
                      {repo.created_at ? new Date(repo.created_at.replace(' ', 'T')).toLocaleDateString('es-VE') : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Crear Repo */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal-content animate-in" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Nuevo Repositorio</h2>
                <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={createRepo} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre del Proyecto</label>
                  <input className="input-field" placeholder="Ej: Algoritmos Avanzados" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Descripción</label>
                  <textarea className="input-field" placeholder="Describe tu proyecto..." value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} style={{ resize: 'vertical' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Lenguaje Principal</label>
                  <select className="input-field" value={lang} onChange={(e) => setLang(e.target.value)}>
                    <option value="">Seleccionar...</option>
                    {languages.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Creando...' : 'Crear Repositorio'}</button>
              </form>
            </div>
          </div>
        )}

        {/* Modal Importar de GitHub */}
        {showGithubModal && user && (
          <GithubImportModal 
            userId={user.id} 
            onClose={() => setShowGithubModal(false)} 
            onSuccess={() => {
              setShowGithubModal(false);
              loadRepos();
            }} 
          />
        )}

        {/* Modal Subir Archivo ZIP */}
        {showUploadModal && user && (
          <LocalUploadModal
            userId={user.id}
            onClose={() => setShowUploadModal(false)}
            onSuccess={() => {
              setShowUploadModal(false);
              loadRepos();
            }}
          />
        )}
      </div>
    </>
  );
}
