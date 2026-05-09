'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import GradingPanel from '@/components/GradingPanel';
import CollaboratorsPanel from '@/components/CollaboratorsPanel';
import { FolderGit2, ArrowLeft, Terminal, FileCode, MessageSquare, Upload, X, Trash2, Check, Loader2 } from 'lucide-react';
import Link from 'next/link';
import CodeSandbox from '@/components/CodeSandbox';

interface RepoDetails {
  id: string;
  name: string;
  description: string | null;
  primary_language: string | null;
  owner_id: string;
  created_at: string;
}

interface RepoFile {
  id: string;
  repo_id: string;
  path: string;
  content: string | null;
  created_at: string;
}

interface CodeComment {
  id: string;
  file_id: string;
  line_number: number;
  author_id: string;
  content: string;
  created_at: string;
  author_name?: string;
}

// Detect language from file extension for syntax highlighting
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    py: 'python', java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp',
    go: 'go', rs: 'rust', php: 'php', rb: 'ruby', swift: 'swift',
    html: 'html', css: 'css', scss: 'css', json: 'json', md: 'markdown',
    sql: 'sql', sh: 'bash', yaml: 'yaml', yml: 'yaml', xml: 'xml',
  };
  return langMap[ext] || 'javascript';
}

export default function RepositoryDetailsPage() {
  const { user, profile } = useAuthStore();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [repo, setRepo] = useState<RepoDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // File explorer state
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<RepoFile | null>(null);

  // Comment state
  const [commentingLine, setCommentingLine] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<CodeComment[]>([]);
  const [commentSaving, setCommentSaving] = useState(false);

  const [editContent, setEditContent] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // File creation modal
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newFilePath, setNewFilePath] = useState('');
  const [newFileContent, setNewFileContent] = useState('');
  const [uploadLoading, setUploadLoading] = useState(false);

  // Load repo details
  const loadRepo = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('repositories').select('*').eq('id', id).single();
    if (data) setRepo(data);
    setLoading(false);
  }, [id]);

  // Load files for this repo
  const loadFiles = useCallback(async () => {
    setFilesLoading(true);
    const { data } = await supabase
      .from('repository_files')
      .select('*')
      .eq('repo_id', id)
      .order('path', { ascending: true });
    setFiles(data || []);
    setFilesLoading(false);
  }, [id]);

  // Load comments for a specific file
  const loadComments = useCallback(async (fileId: string) => {
    const { data } = await supabase
      .from('code_comments')
      .select('*')
      .eq('file_id', fileId)
      .order('created_at', { ascending: true });

    if (!data || data.length === 0) {
      setComments([]);
      return;
    }

    // Fetch author names
    const authorIds = [...new Set(data.map((c) => c.author_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', authorIds);
    const nameMap: Record<string, string> = {};
    profiles?.forEach((p) => { nameMap[p.id] = p.full_name || 'Anónimo'; });

    setComments(data.map((c) => ({ ...c, author_name: nameMap[c.author_id] || 'Anónimo' })));
  }, []);

  // Initial load
  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    loadRepo();
    loadFiles();
  }, [user, router, loadRepo, loadFiles]);

  // Load comments when file changes & subscribe to realtime
  useEffect(() => {
    if (!selectedFile) {
      setComments([]);
      return;
    }

    loadComments(selectedFile.id);

    // Realtime subscription for new comments on this file
    const channel = supabase
      .channel(`comments-${selectedFile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'code_comments',
        filter: `file_id=eq.${selectedFile.id}`,
      }, () => {
        loadComments(selectedFile.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedFile, loadComments]);

  // Add a comment to the database
  const handleAddComment = async () => {
    if (!commentText.trim() || commentingLine === null || !selectedFile || !user) return;
    setCommentSaving(true);

    await supabase.from('code_comments').insert({
      file_id: selectedFile.id,
      line_number: commentingLine,
      author_id: user.id,
      content: commentText,
    });

    setCommentText('');
    setCommentingLine(null);
    setCommentSaving(false);
    // Realtime will trigger a reload, but also do it explicitly as fallback
    await loadComments(selectedFile.id);
  };

  // Create a new file in this repo
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newFilePath.trim()) return;
    setUploadLoading(true);

    const { error } = await supabase.from('repository_files').insert({
      repo_id: id,
      path: newFilePath.trim(),
      content: newFileContent || '',
    });

    if (error) {
      alert('Error al crear el archivo: ' + error.message);
    } else {
      setShowUploadModal(false);
      setNewFilePath('');
      setNewFileContent('');
      await loadFiles();
    }
    setUploadLoading(false);
  };

  // Delete a file
  const handleDeleteFile = async (fileId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('¿Estás seguro de eliminar este archivo?')) return;
    await supabase.from('repository_files').delete().eq('id', fileId);
    if (selectedFile?.id === fileId) {
      setSelectedFile(null);
      setComments([]);
    }
    await loadFiles();
    setEditContent('');
  };

  const isDocente = profile?.role === 'docente' || profile?.role === 'superadministrador';
  const isOwner = repo?.owner_id === user?.id;
  const canManageFiles = isOwner || profile?.role === 'superadministrador';
  // Any authenticated user can edit code — RLS enforces actual write permissions
  const canEditCode = !!user;

  // Auto-save: debounced save to Supabase
  const performAutoSave = useCallback(async (content: string, fileId: string) => {
    setAutoSaveStatus('saving');
    const { error } = await supabase
      .from('repository_files')
      .update({ content })
      .eq('id', fileId);

    if (error) {
      console.error('[AutoSave] Error:', error.message);
      setAutoSaveStatus('error');
      setTimeout(() => setAutoSaveStatus('idle'), 3000);
    } else {
      // Update local state
      setSelectedFile(prev => prev && prev.id === fileId ? { ...prev, content } : prev);
      setFiles(prev => prev.map(f => f.id === fileId ? { ...f, content } : f));
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    }
  }, []);

  const handleInlineEdit = useCallback((newContent: string) => {
    setEditContent(newContent);
    // Clear previous debounce timer
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    // Set new debounce timer (1.5s after user stops typing)
    if (selectedFile) {
      const fileId = selectedFile.id;
      autoSaveTimerRef.current = setTimeout(() => {
        performAutoSave(newContent, fileId);
      }, 1500);
    }
  }, [selectedFile, performAutoSave]);

  // Initialize edit content when selecting a file
  useEffect(() => {
    if (selectedFile) {
      setEditContent(selectedFile.content || '');
      setAutoSaveStatus('idle');
    }
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [selectedFile?.id]);

  // Group comments by line number for easy lookup
  const commentsByLine: Record<number, CodeComment[]> = {};
  comments.forEach((c) => {
    if (!commentsByLine[c.line_number]) commentsByLine[c.line_number] = [];
    commentsByLine[c.line_number].push(c);
  });

  // Extract filename from path
  const getFileName = (path: string) => path.split('/').pop() || path;

  if (!user) return null;

  return (
    <>
      <Sidebar />
      <div className="main-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '100vh' }}>
        <div className="animate-in">
          <Link href="/repos" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--on-surface-variant)', textDecoration: 'none', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
            <ArrowLeft size={16} /> Volver a repositorios
          </Link>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem 0' }}><div className="spinner"></div></div>
          ) : !repo ? (
            <div className="empty-state">
              <FolderGit2 size={48} style={{ color: 'var(--error)' }} />
              <h3>Repositorio no encontrado</h3>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ marginBottom: '2rem', padding: '2rem', background: 'var(--surface-variant)', borderRadius: '1rem', border: '1px solid rgba(72, 72, 73, 0.15)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <FolderGit2 size={28} color="var(--primary)" />
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, margin: 0 }}>{repo.name}</h1>
                  </div>
                  {repo.description && <p style={{ fontSize: '1rem', color: 'var(--on-surface-variant)', marginTop: '0.5rem' }}>{repo.description}</p>}
                </div>
                {canManageFiles && (
                  <button className="btn-primary" onClick={() => setShowUploadModal(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                    <Upload size={16} /> Agregar Archivo
                  </button>
                )}
              </div>

              {/* Grading + Collaborators Panels */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.5rem' }}>
                <GradingPanel repoId={repo.id} userId={user!.id} userRole={profile?.role || 'estudiante'} repoOwnerId={repo.owner_id} />
                <CollaboratorsPanel repoId={repo.id} userId={user!.id} userRole={profile?.role || 'estudiante'} repoOwnerId={repo.owner_id} />
              </div>

              {/* Layout: Explorer left, Code right */}
              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '1.5rem', alignItems: 'start' }}>

                {/* File Explorer */}
                <div style={{ background: 'var(--surface-container-high)', border: '1px solid rgba(72, 72, 73, 0.15)', borderRadius: '1rem', overflow: 'hidden' }}>
                  <div style={{ background: 'rgba(72, 72, 73, 0.1)', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(72, 72, 73, 0.15)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                    <Terminal size={18} /> Explorador
                  </div>
                  <div style={{ padding: '0' }}>
                    {filesLoading ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                        <div className="spinner" style={{ width: 24, height: 24 }}></div>
                      </div>
                    ) : files.length === 0 ? (
                      <div style={{ padding: '2rem 1.5rem', textAlign: 'center', color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>
                        <FileCode size={32} strokeWidth={1} style={{ margin: '0 auto 0.5rem', display: 'block', opacity: 0.5 }} />
                        Sin archivos aún.
                        {canManageFiles && (
                          <button onClick={() => setShowUploadModal(true)} style={{ display: 'block', margin: '0.75rem auto 0', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                            + Agregar archivo
                          </button>
                        )}
                      </div>
                    ) : (
                      files.map((file, i) => (
                        <div key={file.id} style={{ borderBottom: i === files.length - 1 ? 'none' : '1px solid rgba(72, 72, 73, 0.1)' }}>
                          <div
                            onClick={() => setSelectedFile(file)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              width: '100%', padding: '0.875rem 1.5rem', border: 'none', cursor: 'pointer',
                              background: selectedFile?.id === file.id ? 'rgba(109, 221, 255, 0.1)' : 'transparent',
                              color: selectedFile?.id === file.id ? 'var(--primary)' : 'var(--on-surface)',
                              fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', overflow: 'hidden' }}>
                              <FileCode size={16} style={{ flexShrink: 0 }} />
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.path}</span>
                            </div>
                            {canManageFiles && (
                              <button
                                onClick={(e) => handleDeleteFile(file.id, e)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)', padding: '0.125rem', flexShrink: 0, opacity: 0.5 }}
                                title="Eliminar archivo"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Code Editor / Viewer */}
                <div style={{ background: 'var(--surface-container-high)', border: '1px solid rgba(72, 72, 73, 0.15)', borderRadius: '1rem', overflow: 'hidden' }}>
                  {selectedFile ? (
                    <>
                      {/* File header with auto-save status */}
                      <div style={{ background: 'rgba(72, 72, 73, 0.1)', padding: '1rem 1.5rem', borderBottom: '1px solid rgba(72, 72, 73, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <FileCode size={18} color="var(--primary)" /> {selectedFile.path}
                          <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', fontWeight: 400, fontStyle: 'italic' }}>
                            — edición directa con autoguardado
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {autoSaveStatus === 'saving' && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--secondary)', fontWeight: 500 }}>
                              <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...
                            </span>
                          )}
                          {autoSaveStatus === 'saved' && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--tertiary)', fontWeight: 500 }}>
                              <Check size={13} /> Guardado
                            </span>
                          )}
                          {autoSaveStatus === 'error' && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', color: 'var(--error)', fontWeight: 500 }}>
                              ⚠ Error al guardar
                            </span>
                          )}
                          {isDocente && (
                            <span style={{ fontSize: '0.68rem', color: 'var(--outline)', background: 'rgba(193,128,255,0.08)', padding: '0.15rem 0.45rem', borderRadius: '0.2rem' }}>
                              Docente
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Always-editable code textarea */}
                      <textarea
                        value={editContent}
                        onChange={(e) => handleInlineEdit(e.target.value)}
                        spellCheck={false}
                        style={{
                          width: '100%',
                          minHeight: '500px',
                          background: '#131314',
                          color: '#e0e0e0',
                          border: 'none',
                          outline: 'none',
                          resize: 'vertical',
                          padding: '1rem 1.5rem',
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '0.85rem',
                          lineHeight: '1.6',
                          tabSize: 2,
                          boxSizing: 'border-box',
                          display: 'block',
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            const target = e.target as HTMLTextAreaElement;
                            const start = target.selectionStart;
                            const end = target.selectionEnd;
                            const newValue = editContent.substring(0, start) + '  ' + editContent.substring(end);
                            handleInlineEdit(newValue);
                            requestAnimationFrame(() => {
                              target.selectionStart = target.selectionEnd = start + 2;
                            });
                          }
                          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                            e.preventDefault();
                            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
                            if (selectedFile) performAutoSave(editContent, selectedFile.id);
                          }
                        }}
                        onBlur={() => {
                          if (autoSaveTimerRef.current) {
                            clearTimeout(autoSaveTimerRef.current);
                            if (selectedFile && editContent !== selectedFile.content) {
                              performAutoSave(editContent, selectedFile.id);
                            }
                          }
                        }}
                      />

                      {/* Comments section — visible below editor */}
                      {Object.keys(commentsByLine).length > 0 && (
                        <div style={{ borderTop: '1px solid rgba(72,72,73,0.15)', padding: '1rem 1.5rem', background: 'rgba(26, 25, 27, 0.5)' }}>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--on-surface-variant)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <MessageSquare size={14} color="var(--primary)" /> Comentarios del Docente
                          </h4>
                          {Object.entries(commentsByLine).map(([line, lineComments]) => (
                            <div key={line} style={{ marginBottom: '0.75rem' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--outline)', fontFamily: 'JetBrains Mono, monospace', marginBottom: '0.3rem', display: 'block' }}>
                                Línea {line}
                              </span>
                              {lineComments.map((comment) => (
                                <div key={comment.id} style={{ background: 'var(--surface-container-high)', border: '1px solid rgba(109,221,255,0.2)', padding: '0.65rem 0.85rem', borderRadius: '0.5rem', marginBottom: '0.4rem', display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                                  <MessageSquare size={14} color="var(--primary)" style={{ marginTop: '2px', flexShrink: 0 }} />
                                  <div>
                                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--primary)', display: 'block', marginBottom: '0.15rem' }}>
                                      {comment.author_name || 'Docente'}
                                    </span>
                                    <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--on-surface)', lineHeight: 1.5 }}>{comment.content}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Docente comment input */}
                      {isDocente && (
                        <div style={{ borderTop: '1px solid rgba(72,72,73,0.15)', padding: '1rem 1.5rem', background: 'rgba(193,128,255,0.03)' }}>
                          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <input
                                  className="input-field"
                                  type="number"
                                  min="1"
                                  placeholder="Línea #"
                                  value={commentingLine || ''}
                                  onChange={(e) => setCommentingLine(e.target.value ? Number(e.target.value) : null)}
                                  style={{ width: '80px', fontSize: '0.8rem' }}
                                />
                                <input
                                  className="input-field"
                                  placeholder="Escribe tu observación sobre el código..."
                                  value={commentText}
                                  onChange={(e) => setCommentText(e.target.value)}
                                  style={{ flex: 1, fontSize: '0.8rem' }}
                                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                                />
                              </div>
                            </div>
                            <button className="btn-primary" onClick={handleAddComment} disabled={commentSaving || !commentText.trim() || !commentingLine} style={{ padding: '0.45rem 0.85rem', fontSize: '0.8rem', flexShrink: 0 }}>
                              {commentSaving ? 'Guardando...' : 'Comentar'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Code Sandbox Component */}
                      <CodeSandbox 
                        code={selectedFile.content || ''} 
                        language={getLanguage(getFileName(selectedFile.path))} 
                      />
                    </>
                  ) : (
                    <div className="empty-state" style={{ minHeight: '400px' }}>
                      <Terminal size={48} color="var(--on-surface-variant)" />
                      <p>Selecciona un archivo del explorador para ver su código.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal: Crear Archivo */}
        {showUploadModal && (
          <div className="modal-overlay" onClick={() => setShowUploadModal(false)}>
            <div className="modal-content animate-in" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Agregar Archivo al Repositorio</h2>
                <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}><X size={20} /></button>
              </div>
              <form onSubmit={handleCreateFile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Ruta del Archivo</label>
                  <input className="input-field" placeholder="Ej: src/main.tsx" value={newFilePath} onChange={(e) => setNewFilePath(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Contenido del Código</label>
                  <textarea
                    className="input-field"
                    placeholder="Pega o escribe el código fuente aquí..."
                    value={newFileContent}
                    onChange={(e) => setNewFileContent(e.target.value)}
                    rows={12}
                    style={{ resize: 'vertical', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem' }}
                  />
                </div>
                <button type="submit" className="btn-primary" disabled={uploadLoading}>
                  {uploadLoading ? 'Guardando...' : 'Crear Archivo'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
