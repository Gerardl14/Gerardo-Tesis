'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import Link from 'next/link';
import { ArrowLeft, FileCode, Plus, MessageSquare, Play, Square, Terminal, X, Loader2 } from 'lucide-react';
import { Highlight, themes } from 'prism-react-renderer';

interface PageProps {
  params: Promise<{ id: string; path: string[] }>;
}

// Language mapping for Piston API
const RUNNABLE_LANGUAGES: Record<string, { language: string; version: string; prismLang: string }> = {
  'js': { language: 'javascript', version: '18.15.0', prismLang: 'javascript' },
  'javascript': { language: 'javascript', version: '18.15.0', prismLang: 'javascript' },
  'ts': { language: 'typescript', version: '5.0.3', prismLang: 'typescript' },
  'typescript': { language: 'typescript', version: '5.0.3', prismLang: 'typescript' },
  'py': { language: 'python', version: '3.10.0', prismLang: 'python' },
  'python': { language: 'python', version: '3.10.0', prismLang: 'python' },
  'java': { language: 'java', version: '15.0.2', prismLang: 'java' },
  'c': { language: 'c', version: '10.2.0', prismLang: 'c' },
  'cpp': { language: 'c++', version: '10.2.0', prismLang: 'cpp' },
  'cs': { language: 'csharp', version: '6.12.0', prismLang: 'csharp' },
  'go': { language: 'go', version: '1.16.2', prismLang: 'go' },
  'rs': { language: 'rust', version: '1.68.2', prismLang: 'rust' },
  'rb': { language: 'ruby', version: '3.0.1', prismLang: 'ruby' },
  'php': { language: 'php', version: '8.2.3', prismLang: 'php' },
  'sh': { language: 'bash', version: '5.2.0', prismLang: 'bash' },
  'bash': { language: 'bash', version: '5.2.0', prismLang: 'bash' },
};

function getFileExtension(path: string): string {
  const parts = path.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

function getPrismLanguage(ext: string): string {
  const map: Record<string, string> = {
    js: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    py: 'python', java: 'java', c: 'c', cpp: 'cpp', cs: 'csharp',
    go: 'go', rs: 'rust', rb: 'ruby', php: 'php', html: 'markup',
    css: 'css', json: 'json', md: 'markdown', sql: 'sql',
    sh: 'bash', bash: 'bash', yaml: 'yaml', yml: 'yaml',
    xml: 'markup', svg: 'markup', vue: 'markup', svelte: 'markup',
  };
  return map[ext] || 'typescript';
}

export default function CodeViewerPage(props: PageProps) {
  const params = use(props.params);
  const { user, profile } = useAuthStore();
  const router = useRouter();

  const [fileContent, setFileContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [commentingLine, setCommentingLine] = useState<number | null>(null);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Record<number, { id: string; author: string; content: string }[]>>({});

  // Code execution state
  const [isRunning, setIsRunning] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState('');
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  const filePath = params.path.join('/');
  const ext = getFileExtension(filePath);
  const prismLang = getPrismLanguage(ext);
  const isRunnable = RUNNABLE_LANGUAGES[ext] !== undefined;
  const isDocente = profile?.role === 'docente' || profile?.role === 'superadministrador';

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    loadFile();
    loadComments();
  }, [user, router, params.id, filePath]);

  const loadFile = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('repository_files')
      .select('content')
      .eq('repo_id', params.id)
      .eq('file_path', filePath)
      .single();

    if (data) {
      setFileContent(data.content || '// Archivo vacío');
    } else {
      setFileContent(`// Error cargando archivo: ${error?.message || 'No encontrado'}`);
    }
    setLoading(false);
  };

  const loadComments = async () => {
    const { data } = await supabase
      .from('code_comments')
      .select('id, line_number, content, author_id')
      .eq('repo_id', params.id)
      .eq('file_path', filePath)
      .order('created_at', { ascending: true });

    if (!data || data.length === 0) return;

    // Fetch author names
    const authorIds = [...new Set(data.map(c => c.author_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', authorIds);

    const nameMap: Record<string, string> = {};
    profiles?.forEach(p => { nameMap[p.id] = p.full_name || 'Usuario'; });

    const grouped: Record<number, { id: string; author: string; content: string }[]> = {};
    data.forEach(c => {
      if (!grouped[c.line_number]) grouped[c.line_number] = [];
      grouped[c.line_number].push({
        id: c.id,
        author: nameMap[c.author_id] || 'Docente',
        content: c.content,
      });
    });
    setComments(grouped);
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || commentingLine === null || !user) return;

    const { error } = await supabase.from('code_comments').insert({
      repo_id: params.id,
      file_path: filePath,
      line_number: commentingLine,
      content: commentText.trim(),
      author_id: user.id,
    });

    if (!error) {
      setCommentText('');
      setCommentingLine(null);
      loadComments();
    }
  };

  // Execute code via Piston API
  const handleRunCode = async () => {
    if (!isRunnable || isRunning) return;
    const langConfig = RUNNABLE_LANGUAGES[ext];

    setIsRunning(true);
    setShowConsole(true);
    setConsoleOutput('⏳ Ejecutando código...\n');
    setExecutionTime(null);

    const startTime = Date.now();

    try {
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: langConfig.language,
          version: langConfig.version,
          files: [{ name: filePath.split('/').pop() || 'main', content: fileContent }],
          stdin: '',
          args: [],
          run_timeout: 10000, // 10 second timeout
        }),
      });

      const elapsed = Date.now() - startTime;
      setExecutionTime(elapsed);

      if (!response.ok) throw new Error(`API error: ${response.status}`);

      const result = await response.json();

      let output = '';

      // Compile output (for compiled languages)
      if (result.compile && result.compile.stderr) {
        output += `⚠️ Errores de compilación:\n${result.compile.stderr}\n\n`;
      }

      // Runtime output
      if (result.run) {
        if (result.run.stdout) output += result.run.stdout;
        if (result.run.stderr) output += `\n⚠️ stderr:\n${result.run.stderr}`;
        if (result.run.signal === 'SIGKILL') output += '\n⏰ Ejecución cancelada: tiempo excedido (10s)';
        if (result.run.code !== 0 && !result.run.stderr) output += `\n❌ Proceso terminó con código: ${result.run.code}`;
      }

      setConsoleOutput(output || '✅ Ejecución completada sin salida.');

    } catch (err: any) {
      setExecutionTime(Date.now() - startTime);
      setConsoleOutput(`❌ Error de ejecución: ${err.message}\n\nAsegúrate de tener conexión a internet.`);
    } finally {
      setIsRunning(false);
    }
  };

  if (!user) return null;

  return (
    <>
      <Sidebar />
      <div className="main-content">
        <div className="animate-in">
          <Link href={`/repos/${params.id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--on-surface-variant)', textDecoration: 'none', marginBottom: '1.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
            <ArrowLeft size={16} /> Volver al Repositorio
          </Link>

          {/* Header de Archivo + Run Button */}
          <div style={{
            background: 'var(--surface-container-high)',
            border: '1px solid rgba(72, 72, 73, 0.15)',
            borderRadius: '0.75rem 0.75rem 0 0',
            padding: '0.75rem 1.25rem',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <FileCode size={20} color="var(--primary)" />
              <h2 style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.95rem', fontWeight: 600, margin: 0 }}>
                {filePath}
              </h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isRunnable && (
                <button
                  onClick={handleRunCode}
                  disabled={isRunning || loading}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.4rem 0.9rem',
                    borderRadius: '0.5rem',
                    border: 'none',
                    cursor: isRunning ? 'wait' : 'pointer',
                    background: isRunning ? 'rgba(155,255,206,0.15)' : 'rgba(155,255,206,0.1)',
                    color: 'var(--tertiary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => { if (!isRunning) e.currentTarget.style.background = 'rgba(155,255,206,0.2)'; }}
                  onMouseLeave={(e) => { if (!isRunning) e.currentTarget.style.background = 'rgba(155,255,206,0.1)'; }}
                >
                  {isRunning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Play size={14} />}
                  {isRunning ? 'Ejecutando...' : 'Ejecutar'}
                </button>
              )}
              {showConsole && (
                <button
                  onClick={() => setShowConsole(false)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--on-surface-variant)', padding: '0.3rem',
                  }}
                  title="Cerrar consola"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Visor de Código */}
          <div style={{
            background: '#131314',
            border: '1px solid rgba(72, 72, 73, 0.15)',
            borderTop: 'none',
            borderRadius: showConsole ? '0' : '0 0 0.75rem 0.75rem',
            overflowX: 'auto',
            padding: '1rem 0',
          }}>
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
                <div className="spinner" />
              </div>
            ) : (
              <Highlight theme={themes.palenight} code={fileContent} language={prismLang}>
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                  <pre className={className} style={{ ...style, background: 'transparent', margin: 0, padding: 0, fontSize: '0.85rem' }}>
                    {tokens.map((line, i) => {
                      const lineNumber = i + 1;
                      const lineComments = comments[lineNumber];
                      const hasComments = lineComments && lineComments.length > 0;
                      const isHovered = activeLine === lineNumber;
                      const isCommenting = commentingLine === lineNumber;

                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column' }}>
                          <div
                            {...getLineProps({ line, key: i })}
                            onMouseEnter={() => setActiveLine(lineNumber)}
                            onMouseLeave={() => setActiveLine(null)}
                            style={{
                              display: 'flex', position: 'relative',
                              background: hasComments ? 'rgba(109, 221, 255, 0.05)' : isHovered ? 'rgba(255, 255, 255, 0.03)' : 'transparent',
                              padding: '0 1rem',
                            }}
                          >
                            <span style={{
                              width: '40px', textAlign: 'right', paddingRight: '1rem',
                              color: 'var(--outline-variant)', userSelect: 'none',
                              fontFamily: 'JetBrains Mono, monospace',
                            }}>
                              {lineNumber}
                            </span>

                            <div style={{ flex: 1, fontFamily: 'JetBrains Mono, monospace' }}>
                              {line.map((token, key) => (
                                <span key={key} {...getTokenProps({ token, key })} />
                              ))}
                            </div>

                            {isDocente && isHovered && !isCommenting && (
                              <button
                                onClick={() => setCommentingLine(lineNumber)}
                                style={{
                                  position: 'absolute', left: '10px',
                                  background: 'var(--primary)', color: '#002c37',
                                  border: 'none', borderRadius: '4px',
                                  width: '20px', height: '20px', cursor: 'pointer',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  zIndex: 10,
                                }}
                              >
                                <Plus size={14} />
                              </button>
                            )}
                          </div>

                          {(hasComments || isCommenting) && (
                            <div style={{ background: 'rgba(26, 25, 27, 0.5)', borderTop: '1px solid rgba(72, 72, 73, 0.1)', borderBottom: '1px solid rgba(72, 72, 73, 0.1)', padding: '1rem 1rem 1rem 3.5rem' }}>
                              {lineComments?.map((c) => (
                                <div key={c.id} style={{ background: 'var(--surface-container-high)', border: '1px solid rgba(109,221,255,0.2)', padding: '0.8rem 1rem', borderRadius: '0.5rem', marginBottom: '0.5rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                                  <MessageSquare size={16} color="var(--primary)" style={{ marginTop: '2px' }} />
                                  <div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', display: 'block', marginBottom: '0.2rem' }}>{c.author}</span>
                                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--on-surface)', lineHeight: 1.5 }}>{c.content}</p>
                                  </div>
                                </div>
                              ))}

                              {isCommenting && (
                                <div style={{ marginTop: '0.5rem' }}>
                                  <textarea
                                    className="input-field"
                                    placeholder="Escribe tu observación sobre esta línea de código..."
                                    value={commentText}
                                    onChange={(e) => setCommentText(e.target.value)}
                                    rows={3}
                                    style={{ marginBottom: '0.5rem', resize: 'vertical' }}
                                  />
                                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                                    <button className="btn-ghost" onClick={() => { setCommentingLine(null); setCommentText(''); }} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                      Cancelar
                                    </button>
                                    <button className="btn-primary" onClick={handleAddComment} style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                                      Dejar Comentario
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </pre>
                )}
              </Highlight>
            )}
          </div>

          {/* Console Output Panel */}
          {showConsole && (
            <div style={{
              background: '#0d0d0e',
              border: '1px solid rgba(72, 72, 73, 0.15)',
              borderTop: '1px solid rgba(155,255,206,0.2)',
              borderRadius: '0 0 0.75rem 0.75rem',
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0.5rem 1rem',
                background: 'rgba(155,255,206,0.05)',
                borderBottom: '1px solid rgba(72, 72, 73, 0.1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--tertiary)' }}>
                  <Terminal size={14} />
                  Consola de Salida
                  {isRunning && <span style={{ color: 'var(--on-surface-variant)' }}>Ejecutando...</span>}
                </div>
                {executionTime !== null && (
                  <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>
                    ⏱ {executionTime}ms
                  </span>
                )}
              </div>
              <pre style={{
                margin: 0,
                padding: '1rem',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.8rem',
                color: 'var(--on-surface)',
                lineHeight: 1.7,
                maxHeight: '250px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {consoleOutput}
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
