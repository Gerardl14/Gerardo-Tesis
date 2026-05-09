import React, { useState } from 'react';
import { X, Search, CheckCircle, Loader2, FolderGit2, Info } from 'lucide-react';
import GithubIcon from '@/components/GithubIcon';
import { supabase } from '@/lib/supabase';

interface GithubRepo {
  id: number;
  name: string;
  description: string | null;
  language: string | null;
  default_branch: string;
  pushed_at: string;
  owner: { login: string };
  private: boolean;
}

interface Props {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function GithubImportModal({ userId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Search, 2: Select, 3: Importing
  const [username, setUsername] = useState('');
  const [token, setToken] = useState(''); // Optional PAT for private repos/rate limits
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<GithubRepo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, currentFile: '' });

  // 1. Fetch repositories from GitHub
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() && !token.trim()) {
      setError('Debes proveer un usuario o un Token de Acceso Personal');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const headers: Record<string, string> = {};
      if (token.trim()) {
        headers['Authorization'] = `token ${token.trim()}`;
      }

      // Si tenemos token pero no usuario, buscamos los repositorios del usuario autenticado
      const endpoint = (token.trim() && !username.trim())
        ? 'https://api.github.com/user/repos?sort=updated&per_page=100'
        : `https://api.github.com/users/${username.trim()}/repos?sort=updated&per_page=100`;

      const res = await fetch(endpoint, { headers });
      
      if (!res.ok) {
        if (res.status === 404) throw new Error('Usuario no encontrado');
        if (res.status === 403) throw new Error('Límite de la API de GitHub superado. Usa un Token provisto.');
        if (res.status === 401) throw new Error('Token de GitHub inválido');
        throw new Error(`Error de GitHub: ${res.statusText}`);
      }

      const data: GithubRepo[] = await res.json();
      setRepos(data);
      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Error al buscar repositorios');
    } finally {
      setLoading(false);
    }
  };

  // 2. Fetch the entire tree of the selected repo and import to Supabase
  const handleImport = async () => {
    if (!selectedRepo) return;
    setStep(3);
    setLoading(true);
    setError('');

    try {
      const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
      };
      if (token.trim()) {
        headers['Authorization'] = `token ${token.trim()}`;
      }

      // Paso 1: Crear el repositorio en Supabase
      const { data: repoData, error: repoError } = await supabase
        .from('repositories')
        .insert({
          name: selectedRepo.name,
          description: selectedRepo.description || 'Importado desde GitHub',
          primary_language: selectedRepo.language || 'Desconocido',
          owner_id: userId,
        })
        .select()
        .single();

      if (repoError) throw new Error(`Ocurrió un error al crear el repositorio en Supabase: ${repoError.message}`);
      
      const newRepoId = repoData.id;

      // Paso 2: Obtener el árbol de archivos (recursivo) de GitHub
      setImportProgress({ current: 0, total: 0, currentFile: 'Obteniendo estructura...' });
      
      const treeUrl = `https://api.github.com/repos/${selectedRepo.owner.login}/${selectedRepo.name}/git/trees/${selectedRepo.default_branch}?recursive=1`;
      const treeRes = await fetch(treeUrl, { headers });
      
      if (!treeRes.ok) throw new Error('No se pudo obtener la estructura del repositorio desde GitHub');
      
      const treeData = await treeRes.json();
      
      // Filtrar solo archivos (blobs), omitir carpetas vacías (trees) y submodulos (commits)
      const files = treeData.tree.filter((node: any) => node.type === 'blob');
      
      setImportProgress({ current: 0, total: files.length, currentFile: 'Preparando descarga...' });

      // Definir límite de archivos para no sobrecargar el navegador de golpe (batch processing)
      const maxFiles = Math.min(files.length, 150); // Importar máximo 150 archivos para evitar límites
      
      // Paso 3: Descargar el contenido de los archivos y guardarlos
      let processed = 0;
      
      for (let i = 0; i < maxFiles; i++) {
        const fileNode = files[i];
        setImportProgress({ current: i, total: maxFiles, currentFile: fileNode.path });
        
        // Determinar cómo descargar:
        // Si el archivo es grande o es binario, lo saltamos por simplicidad (AIS Lab está pensado para código)
        // Obtenemos el contenido directamente con fetch rawusercontent o API contents
        
        let fileContent = '';
        const rawUrl = `https://raw.githubusercontent.com/${selectedRepo.owner.login}/${selectedRepo.name}/${selectedRepo.default_branch}/${fileNode.path}`;
        
        try {
          const contentRes = await fetch(rawUrl, { headers });
          if (contentRes.ok) {
            fileContent = await contentRes.text();
            
            // Insertar archivo en Supabase
            await supabase.from('repository_files').insert({
              repo_id: newRepoId,
              path: fileNode.path,
              content: fileContent,
            });
            processed++;
          }
        } catch (fileErr) {
          console.warn(`[GithubImport] Error al procesar ${fileNode.path}:`, fileErr);
          // Continuamos con el siguiente
        }
      }

      setImportProgress({ current: maxFiles, total: maxFiles, currentFile: `¡Completado! ${processed} archivos importados.` });
      
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Error durante la importación');
      setStep(2); // Volver atrás si falla
    } finally {
      if (step !== 3) setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content animate-in" 
        onClick={(e) => e.stopPropagation()} 
        style={{ maxWidth: '600px', width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <GithubIcon size={24} color="var(--primary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Importar de GitHub</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,113,108,0.1)', color: 'var(--error)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        {/* STEP 1: Search configuration */}
        {step === 1 && (
          <form onSubmit={handleSearch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', marginBottom: '0.5rem', lineHeight: 1.5 }}>
              Ingresa el nombre de usuario de GitHub para buscar repositorios públicos. Si necesitas importar un repositorio privado, debes proporcionar un Personal Access Token.
            </p>
            
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Usuario de GitHub <span style={{ color: 'var(--on-surface-variant)' }}>(Opcional si usas Token)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={18} color="var(--on-surface-variant)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input 
                  className="input-field" 
                  placeholder="ej. torvalds" 
                  value={username} 
                  onChange={(e) => setUsername(e.target.value)} 
                  style={{ paddingLeft: '2.5rem' }} 
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Token de Acceso Personal (PAT) <span style={{ color: 'var(--on-surface-variant)' }}>(Opcional)</span>
              </label>
              <input 
                type="password"
                className="input-field" 
                placeholder="ghp_****************************" 
                value={token} 
                onChange={(e) => setToken(e.target.value)} 
              />
              <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginTop: '0.5rem' }}>
                Concédele permisos de <strong>"repo"</strong> en GitHub si deseas importar archivos privados.
              </p>
            </div>

            <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
              {loading ? <Loader2 size={18} className="spinner" style={{ border: 'none' }} /> : <Search size={18} />}
              {loading ? 'Buscando...' : 'Buscar Repositorios'}
            </button>
          </form>
        )}

        {/* STEP 2: Select Repository */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>
                Se encontraron <strong>{repos.length}</strong> repositorios para <strong>{username || 'tu cuenta'}</strong>.
              </p>
              <button 
                onClick={() => setStep(1)} 
                style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500 }}
              >
                Cambiar búsqueda
              </button>
            </div>
            
            <div style={{ border: '1px solid rgba(72,72,73,0.3)', borderRadius: '0.5rem', maxHeight: '300px', overflowY: 'auto', background: 'var(--surface-container)' }}>
              {repos.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--on-surface-variant)' }}>No hay repositorios disponibles.</div>
              ) : (
                repos.map(repo => (
                  <div 
                    key={repo.id}
                    onClick={() => setSelectedRepo(repo)}
                    style={{ 
                      padding: '1rem', 
                      borderBottom: '1px solid rgba(72,72,73,0.2)',
                      cursor: 'pointer',
                      background: selectedRepo?.id === repo.id ? 'rgba(109,221,255,0.1)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedRepo?.id !== repo.id) e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    }}
                    onMouseLeave={(e) => {
                      if (selectedRepo?.id !== repo.id) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <FolderGit2 size={24} color={selectedRepo?.id === repo.id ? 'var(--primary)' : 'var(--on-surface-variant)'} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ fontSize: '1rem' }}>{repo.name}</strong>
                        {repo.private && <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', background: 'var(--surface-bright)', borderRadius: '1rem', border: '1px solid var(--outline)' }}>Privado</span>}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginTop: '0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '350px' }}>
                        {repo.description || 'Sin descripción'}
                      </p>
                    </div>
                    {selectedRepo?.id === repo.id && <CheckCircle size={20} color="var(--primary)" />}
                  </div>
                ))
              )}
            </div>

            <div style={{ background: 'rgba(109,221,255,0.05)', padding: '1rem', borderRadius: '0.5rem', display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
              <Info size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
                Al importar, se crearán copias Snapshot del código actual de la rama principal (<strong>{selectedRepo?.default_branch || 'main'}</strong>) localmente en AIS Lab para acelerar la vista del código.
              </p>
            </div>

            <button 
              onClick={handleImport} 
              className="btn-primary" 
              disabled={!selectedRepo || loading}
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '0.5rem' }}
            >
              {loading ? 'Preparando...' : `Importar ${selectedRepo ? `'${selectedRepo.name}'` : ''}`}
            </button>
          </div>
        )}

        {/* STEP 3: Progress Indicator */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2rem 1rem' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
              <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="36" fill="transparent" stroke="var(--surface-bright)" strokeWidth="6" />
                <circle 
                  cx="40" cy="40" r="36" 
                  fill="transparent" 
                  stroke="var(--primary)" 
                  strokeWidth="6"
                  strokeDasharray="226"
                  strokeDashoffset={226 - (226 * (importProgress.current / Math.max(importProgress.total, 1)))}
                  style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 700 }}>
                {importProgress.total > 0 ? Math.round((importProgress.current / importProgress.total) * 100) : 0}%
              </div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Clonando repositorio...</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontFamily: 'monospace', maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {importProgress.currentFile}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: '1rem', fontWeight: 500 }}>
                {importProgress.current} / {importProgress.total} archivos procesados
              </p>
            </div>
            
            <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', textAlign: 'center', marginTop: '1rem' }}>
              Por favor, no cierres esta ventana hasta que el proceso termine.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
