'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Search, X, FolderGit2, MessageSquare, User, FileCode, ArrowRight, Command } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'repo' | 'thread' | 'user' | 'file';
  title: string;
  subtitle: string;
  link: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  repo: { icon: FolderGit2, color: 'var(--primary)', label: 'Repositorio' },
  thread: { icon: MessageSquare, color: '#ffb74d', label: 'Foro' },
  user: { icon: User, color: 'var(--secondary)', label: 'Usuario' },
  file: { icon: FileCode, color: 'var(--tertiary)', label: 'Archivo' },
};

export default function SearchModal({ isOpen, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-focus on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, results.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && results[selectedIndex]) {
        router.push(results[selectedIndex].link);
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, router, onClose]);

  const performSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);

    try {
      const allResults: SearchResult[] = [];

      // Search repositories
      const { data: repos } = await supabase
        .from('repositories')
        .select('id, name, description, primary_language')
        .or(`name.ilike.%${q}%,description.ilike.%${q}%`)
        .limit(5);

      repos?.forEach(r => {
        allResults.push({
          id: `repo-${r.id}`,
          type: 'repo',
          title: r.name,
          subtitle: r.description || r.primary_language || 'Repositorio',
          link: `/repos/${r.id}`,
        });
      });

      // Search forum threads
      const { data: threads } = await supabase
        .from('forum_threads')
        .select('id, title, category')
        .ilike('title', `%${q}%`)
        .limit(5);

      threads?.forEach(t => {
        allResults.push({
          id: `thread-${t.id}`,
          type: 'thread',
          title: t.title,
          subtitle: t.category || 'Foro',
          link: '/forum',
        });
      });

      // Search users/profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .ilike('full_name', `%${q}%`)
        .limit(5);

      profiles?.forEach(p => {
        const roleLabel = p.role === 'superadministrador' ? 'Admin' : p.role === 'docente' ? 'Docente' : 'Estudiante';
        allResults.push({
          id: `user-${p.id}`,
          type: 'user',
          title: p.full_name || 'Usuario',
          subtitle: roleLabel,
          link: '/profile',
        });
      });

      // Search files by path
      const { data: files } = await supabase
        .from('repository_files')
        .select('id, file_path, repo_id')
        .ilike('file_path', `%${q}%`)
        .limit(5);

      files?.forEach(f => {
        allResults.push({
          id: `file-${f.id}`,
          type: 'file',
          title: f.file_path.split('/').pop() || f.file_path,
          subtitle: f.file_path,
          link: `/repos/${f.repo_id}`,
        });
      });

      setResults(allResults);
      setSelectedIndex(0);
    } catch (err) {
      console.error('[Search] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => performSearch(value), 300);
  };

  const handleResultClick = (result: SearchResult) => {
    router.push(result.link);
    onClose();
  };

  if (!isOpen) return null;

  // Group results by type
  const grouped: Record<string, SearchResult[]> = {};
  results.forEach(r => {
    if (!grouped[r.type]) grouped[r.type] = [];
    grouped[r.type].push(r);
  });

  let flatIndex = 0;

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ alignItems: 'flex-start', paddingTop: '15vh' }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-container-high)',
          border: '1px solid rgba(72,72,73,0.25)',
          borderRadius: '1rem',
          width: '100%',
          maxWidth: '580px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          animation: 'fadeIn 0.15s ease',
        }}
      >
        {/* Search Input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          padding: '1rem 1.25rem',
          borderBottom: '1px solid rgba(72,72,73,0.15)',
        }}>
          <Search size={20} color="var(--primary)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="Buscar repositorios, archivos, usuarios, foro..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--on-surface)', fontSize: '1rem', fontFamily: 'Inter',
            }}
          />
          {loading && <div className="spinner" style={{ width: 18, height: 18 }} />}
          <kbd style={{
            background: 'var(--surface-bright)', borderRadius: '0.3rem',
            padding: '0.15rem 0.4rem', fontSize: '0.7rem',
            color: 'var(--on-surface-variant)', border: '1px solid rgba(72,72,73,0.3)',
            fontFamily: 'monospace',
          }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {query.length < 2 ? (
            <div style={{ padding: '2.5rem 2rem', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
              <Search size={32} strokeWidth={1} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p style={{ fontSize: '0.85rem' }}>Escribe al menos 2 caracteres para buscar</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--outline)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <kbd style={{ background: 'var(--surface-bright)', padding: '0.1rem 0.3rem', borderRadius: '0.2rem', fontSize: '0.65rem', border: '1px solid rgba(72,72,73,0.3)' }}>↑↓</kbd> navegar
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--outline)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <kbd style={{ background: 'var(--surface-bright)', padding: '0.1rem 0.3rem', borderRadius: '0.2rem', fontSize: '0.65rem', border: '1px solid rgba(72,72,73,0.3)' }}>↵</kbd> abrir
                </span>
              </div>
            </div>
          ) : results.length === 0 && !loading ? (
            <div style={{ padding: '2.5rem 2rem', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
              <p style={{ fontSize: '0.85rem' }}>No se encontraron resultados para &quot;{query}&quot;</p>
            </div>
          ) : (
            Object.entries(grouped).map(([type, items]) => {
              const config = typeConfig[type] || typeConfig.repo;
              return (
                <div key={type}>
                  {/* Section header */}
                  <div style={{
                    padding: '0.5rem 1.25rem',
                    fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: '0.05em', color: 'var(--on-surface-variant)',
                    background: 'rgba(72,72,73,0.05)',
                  }}>
                    {config.label}s
                  </div>
                  {items.map(result => {
                    const currentIndex = flatIndex++;
                    const Icon = config.icon;
                    const isSelected = currentIndex === selectedIndex;
                    return (
                      <div
                        key={result.id}
                        onClick={() => handleResultClick(result)}
                        style={{
                          padding: '0.75rem 1.25rem',
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          cursor: 'pointer',
                          background: isSelected ? 'rgba(109,221,255,0.08)' : 'transparent',
                          borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                          transition: 'all 0.1s ease',
                        }}
                        onMouseEnter={() => setSelectedIndex(currentIndex)}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: '0.5rem',
                          background: config.color + '15',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Icon size={16} color={config.color} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '0.9rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {result.title}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {result.subtitle}
                          </p>
                        </div>
                        {isSelected && <ArrowRight size={14} color="var(--primary)" />}
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
