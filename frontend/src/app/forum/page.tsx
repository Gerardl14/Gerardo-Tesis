'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { Plus, MessageSquare, Send, Trash2, X, Code, Hash } from 'lucide-react';

interface Thread {
  id: string;
  title: string;
  category: string;
  author_id: string;
  created_at: string;
  author_name?: string;
}

interface Message {
  id: string;
  thread_id: string;
  author_id: string;
  content: string;
  is_code: boolean;
  created_at: string;
  author_name?: string;
}

const CATEGORIES = ['General', 'Frontend', 'Backend', 'Base de Datos', 'Algoritmos', 'Redes', 'Seguridad'];

export default function ForumPage() {
  const { user, profile } = useAuthStore();
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newMsg, setNewMsg] = useState('');
  const [isCode, setIsCode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedThread) return;
    loadMessages(selectedThread.id);

    const channel = supabase
      .channel(`forum-${selectedThread.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_messages', filter: `thread_id=eq.${selectedThread.id}` }, () => {
        loadMessages(selectedThread.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedThread]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadThreads = async () => {
    let q = supabase.from('forum_threads').select('*').order('created_at', { ascending: false });
    if (selectedCategory) q = q.eq('category', selectedCategory);
    const { data } = await q;
    if (!data) return;

    const authorIds = [...new Set(data.map((t) => t.author_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', authorIds);
    const nameMap: Record<string, string> = {};
    profiles?.forEach((p) => { nameMap[p.id] = p.full_name || 'Anónimo'; });

    setThreads(data.map((t) => ({ ...t, author_name: nameMap[t.author_id] || 'Anónimo' })));
  };

  const loadMessages = async (threadId: string) => {
    const { data } = await supabase.from('forum_messages').select('*').eq('thread_id', threadId).order('created_at', { ascending: true });
    if (!data) return;

    const authorIds = [...new Set(data.map((m) => m.author_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', authorIds);
    const nameMap: Record<string, string> = {};
    profiles?.forEach((p) => { nameMap[p.id] = p.full_name || 'Anónimo'; });

    setMessages(data.map((m) => ({ ...m, author_name: nameMap[m.author_id] || 'Anónimo' })));
  };

  const createThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const { data } = await supabase.from('forum_threads').insert({ title: newTitle, category: newCategory, author_id: user.id }).select().single();
    setShowNewThread(false);
    setNewTitle('');
    loadThreads();
    if (data) setSelectedThread({ ...data, author_name: profile?.full_name || 'Anónimo' });
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedThread || !newMsg.trim()) return;
    await supabase.from('forum_messages').insert({ thread_id: selectedThread.id, author_id: user.id, content: newMsg, is_code: isCode });
    setNewMsg('');
    setIsCode(false);
  };

  const deleteThread = async (id: string) => {
    if (!confirm('¿Eliminar este hilo y todas sus respuestas?')) return;
    await supabase.from('forum_threads').delete().eq('id', id);
    if (selectedThread?.id === id) { setSelectedThread(null); setMessages([]); }
    loadThreads();
  };

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router, selectedCategory]);

  if (!user) return null;

  // Fix: show date safely
  const safeDate = (d: string) => {
    try {
      const dt = new Date(d.replace(' ', 'T'));
      return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('es-VE');
    } catch { return ''; }
  };

  return (
    <>
      <Sidebar />
      <div className="main-content" style={{ display: 'flex', gap: '1rem', height: '100vh', overflow: 'hidden' }}>
        {/* Categorías */}
        <div style={{ width: '180px', flexShrink: 0 }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem', padding: '0 0.5rem' }}>
            Categorías
          </p>
          <button
            onClick={() => setSelectedCategory('')}
            style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Inter', marginBottom: '0.25rem',
              background: !selectedCategory ? 'rgba(109,221,255,0.1)' : 'transparent',
              color: !selectedCategory ? 'var(--primary)' : 'var(--on-surface-variant)',
            }}
          >
            Todas
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{ width: '100%', textAlign: 'left', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', border: 'none', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'Inter', marginBottom: '0.25rem',
                background: selectedCategory === cat ? 'rgba(109,221,255,0.1)' : 'transparent',
                color: selectedCategory === cat ? 'var(--primary)' : 'var(--on-surface-variant)',
              }}
            >
              <Hash size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              {cat}
            </button>
          ))}
        </div>

        {/* Lista de hilos */}
        <div style={{ width: '320px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: 'var(--surface-container-low)', borderRadius: '0.75rem', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>Hilos del Foro</h2>
            <button className="btn-primary" onClick={() => setShowNewThread(true)} style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem' }}>
              <Plus size={14} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {threads.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <MessageSquare size={32} strokeWidth={1} />
                <p style={{ fontSize: '0.8rem' }}>No hay hilos aún</p>
              </div>
            ) : (
              threads.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelectedThread(t)}
                  style={{
                    padding: '0.875rem 1rem',
                    cursor: 'pointer',
                    borderLeft: selectedThread?.id === t.id ? '3px solid var(--primary)' : '3px solid transparent',
                    background: selectedThread?.id === t.id ? 'rgba(109,221,255,0.05)' : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem', flex: 1 }}>{t.title}</h4>
                    {(t.author_id === user?.id || profile?.role === 'superadministrador' || profile?.role === 'docente') && (
                      <button onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)', padding: '0.125rem', flexShrink: 0 }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="badge badge-cyan" style={{ fontSize: '0.65rem', padding: '0.125rem 0.5rem' }}>{t.category}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>{t.author_name}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Panel de mensajes */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--surface-container)', borderRadius: '0.75rem', overflow: 'hidden' }}>
          {selectedThread ? (
            <>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(72,72,73,0.15)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{selectedThread.title}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)' }}>
                  {selectedThread.author_name} • {selectedThread.category} • {safeDate(selectedThread.created_at)}
                </p>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {messages.map((msg) => (
                  <div key={msg.id} style={{
                    padding: '0.875rem',
                    borderRadius: '0.5rem',
                    background: msg.author_id === user?.id ? 'rgba(109,221,255,0.08)' : 'var(--surface-container-high)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, color: msg.author_id === user?.id ? 'var(--primary)' : 'var(--on-surface)' }}>{msg.author_name}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>
                        {msg.created_at ? new Date(msg.created_at.replace(' ', 'T')).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                    {msg.is_code ? (
                      <pre style={{ background: 'var(--surface)', padding: '0.75rem', borderRadius: '0.5rem', fontSize: '0.8rem', overflowX: 'auto', fontFamily: 'JetBrains Mono', lineHeight: 1.6 }}>
                        <code>{msg.content}</code>
                      </pre>
                    ) : (
                      <p style={{ fontSize: '0.85rem', lineHeight: 1.6 }}>{msg.content}</p>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={sendMessage} style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(72,72,73,0.15)', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                <button type="button" onClick={() => setIsCode(!isCode)} title={isCode ? 'Modo texto' : 'Modo código'} style={{
                  background: isCode ? 'rgba(109,221,255,0.15)' : 'transparent', border: '1px solid rgba(72,72,73,0.2)',
                  borderRadius: '0.5rem', padding: '0.5rem', cursor: 'pointer', color: isCode ? 'var(--primary)' : 'var(--on-surface-variant)',
                }}>
                  <Code size={18} />
                </button>
                <textarea
                  className="input-field"
                  placeholder={isCode ? 'Pega tu código aquí...' : 'Escribe tu respuesta...'}
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  rows={1}
                  style={{ flex: 1, resize: 'none', fontFamily: isCode ? 'JetBrains Mono' : 'Inter' }}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                />
                <button type="submit" className="btn-primary" style={{ padding: '0.625rem' }}><Send size={18} /></button>
              </form>
            </>
          ) : (
            <div className="empty-state" style={{ flex: 1 }}>
              <MessageSquare size={48} strokeWidth={1} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Selecciona un hilo</h3>
              <p style={{ fontSize: '0.85rem' }}>Elige un hilo del panel izquierdo o crea uno nuevo para comenzar a colaborar.</p>
            </div>
          )}
        </div>

        {/* Modal Nuevo Hilo */}
        {showNewThread && (
          <div className="modal-overlay" onClick={() => setShowNewThread(false)}>
            <div className="modal-content animate-in" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Nueva Pregunta</h2>
                <button onClick={() => setShowNewThread(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}><X size={20} /></button>
              </div>
              <form onSubmit={createThread} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Título de la Pregunta</label>
                  <input className="input-field" placeholder="Ej: ¿Cómo optimizar este componente React?" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.5rem', fontWeight: 500 }}>Categoría</label>
                  <select className="input-field" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button type="submit" className="btn-primary">Publicar Pregunta</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
