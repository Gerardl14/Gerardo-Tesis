'use client';

import React, { useState, useRef, useCallback } from 'react';
import JSZip from 'jszip';
import { X, UploadCloud, FileArchive, CheckCircle2, AlertTriangle, File } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Props {
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

// Extensions that are considered "code/text" and safe to store as text in the DB
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss', '.less', '.sass',
  '.html', '.htm', '.xml', '.svg', '.md', '.mdx', '.txt', '.yaml', '.yml',
  '.toml', '.ini', '.cfg', '.conf', '.env', '.env.local', '.env.example',
  '.py', '.pyw', '.pyi', '.java', '.kt', '.kts', '.scala', '.groovy',
  '.c', '.h', '.cpp', '.hpp', '.cc', '.cxx', '.cs', '.go', '.rs', '.rb',
  '.php', '.pl', '.pm', '.lua', '.r', '.R', '.swift', '.m', '.mm',
  '.sh', '.bash', '.zsh', '.fish', '.bat', '.cmd', '.ps1',
  '.sql', '.graphql', '.gql', '.prisma', '.proto',
  '.dockerfile', '.dockerignore', '.gitignore', '.gitattributes',
  '.editorconfig', '.prettierrc', '.eslintrc', '.babelrc',
  '.vue', '.svelte', '.astro',
  '.lock', '.map',
]);

// Directories to always skip
const IGNORED_DIRS = new Set([
  'node_modules', '.git', '__pycache__', '.vscode', '.idea',
  'dist', 'build', '.next', '.nuxt', 'vendor', '.cache',
  'coverage', '.nyc_output', 'target', 'bin', 'obj',
]);

function isTextFile(path: string): boolean {
  // Check if the file name itself is a known config file without extension
  const basename = path.split('/').pop() || '';
  if (['Makefile', 'Dockerfile', 'Procfile', 'Gemfile', 'Rakefile', '.gitignore', '.dockerignore', '.editorconfig'].includes(basename)) {
    return true;
  }
  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex === -1) return false; // No extension, skip unless it's a known file
  const ext = basename.substring(dotIndex).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function isIgnoredPath(path: string): boolean {
  const parts = path.split('/');
  return parts.some(part => IGNORED_DIRS.has(part));
}

export default function LocalUploadModal({ userId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1); // 1=select, 2=preview, 3=uploading
  const [file, setFile] = useState<File | null>(null);
  const [repoName, setRepoName] = useState('');
  const [repoDesc, setRepoDesc] = useState('');
  const [extractedFiles, setExtractedFiles] = useState<{ path: string; content: string }[]>([]);
  const [skippedCount, setSkippedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState({ current: 0, total: 0, currentFile: '' });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection (click or drop)
  const processFile = useCallback(async (selectedFile: File) => {
    if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
      setError('Solo se admiten archivos en formato .zip');
      return;
    }
    if (selectedFile.size > 100 * 1024 * 1024) { // 100MB limit
      setError('El archivo excede el límite de 100MB.');
      return;
    }

    setFile(selectedFile);
    setError('');
    setLoading(true);

    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(selectedFile);
      const files: { path: string; content: string }[] = [];
      let skipped = 0;

      // Find common root: if all files share a single top-level folder, strip it
      const allPaths = Object.keys(contents.files).filter(p => !contents.files[p].dir);
      let commonPrefix = '';
      if (allPaths.length > 0) {
        const firstSlash = allPaths[0].indexOf('/');
        if (firstSlash > 0) {
          const candidate = allPaths[0].substring(0, firstSlash + 1);
          if (allPaths.every(p => p.startsWith(candidate))) {
            commonPrefix = candidate;
          }
        }
      }

      for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
        if (zipEntry.dir) continue; // Skip directories

        // Strip common prefix
        const cleanPath = commonPrefix ? relativePath.replace(commonPrefix, '') : relativePath;
        if (!cleanPath) continue;

        if (isIgnoredPath(cleanPath)) { skipped++; continue; }
        if (!isTextFile(cleanPath)) { skipped++; continue; }

        try {
          const text = await zipEntry.async('string');
          // Skip files that look binary (contain null bytes)
          if (text.includes('\0')) { skipped++; continue; }
          // Skip very large individual files (>500KB)
          if (text.length > 500 * 1024) { skipped++; continue; }

          files.push({ path: cleanPath, content: text });
        } catch {
          skipped++;
        }
      }

      setExtractedFiles(files);
      setSkippedCount(skipped);

      // Suggest repo name from ZIP filename
      const suggestedName = selectedFile.name.replace(/\.zip$/i, '').replace(/[-_]/g, ' ');
      setRepoName(suggestedName);
      setStep(2);
    } catch (err) {
      console.error('[LocalUpload] Error reading zip:', err);
      setError('No se pudo leer el archivo ZIP. Verifica que no esté corrupto.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Drag & Drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) processFile(droppedFile);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  }, [processFile]);

  // Upload to Supabase
  const handleUpload = async () => {
    if (extractedFiles.length === 0 || !repoName.trim()) return;
    setStep(3);
    setLoading(true);
    setError('');

    try {
      // Create repo
      const { data: repoData, error: repoError } = await supabase
        .from('repositories')
        .insert({
          name: repoName.trim(),
          description: repoDesc.trim() || `Subido desde archivo local (${file?.name})`,
          primary_language: detectLanguage(extractedFiles),
          owner_id: userId,
        })
        .select()
        .single();

      if (repoError) throw new Error(`Error creando repositorio: ${repoError.message}`);
      const newRepoId = repoData.id;

      // Insert files in batches of 20
      const batchSize = 20;
      const total = extractedFiles.length;

      for (let i = 0; i < total; i += batchSize) {
        const batch = extractedFiles.slice(i, i + batchSize);
        setProgress({
          current: Math.min(i + batchSize, total),
          total,
          currentFile: batch[batch.length - 1]?.path || '',
        });

        const rows = batch.map(f => ({
          repo_id: newRepoId,
          path: f.path,
          content: f.content,
        }));

        const { error: insertError } = await supabase.from('repository_files').insert(rows);
        if (insertError) {
          console.warn('[LocalUpload] Batch insert error:', insertError.message);
        }
      }

      setProgress({ current: total, total, currentFile: '¡Completado!' });
      setTimeout(() => onSuccess(), 1200);
    } catch (err: any) {
      setError(err.message || 'Error durante la subida');
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content animate-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px', width: '100%' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FileArchive size={24} color="var(--secondary)" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Subir Archivo Comprimido</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ background: 'rgba(255,113,108,0.1)', color: 'var(--error)', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* STEP 1: Drag & Drop or Click to select */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Arrastra tu archivo <strong>.zip</strong> aquí o haz clic para seleccionarlo. El sistema extraerá automáticamente los archivos de código fuente y los subirá al repositorio.
            </p>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? 'var(--primary)' : 'var(--outline-variant)'}`,
                borderRadius: '1rem',
                padding: '3rem 2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '1rem',
                cursor: 'pointer',
                background: isDragging ? 'rgba(109,221,255,0.06)' : 'rgba(26,25,27,0.3)',
                transition: 'all 0.25s ease',
              }}
            >
              <UploadCloud size={48} color={isDragging ? 'var(--primary)' : 'var(--on-surface-variant)'} strokeWidth={1.5} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.25rem' }}>
                  {isDragging ? '¡Suelta el archivo aquí!' : 'Arrastra tu archivo .zip'}
                </p>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.8rem' }}>
                  o haz clic para seleccionar desde tu computadora
                </p>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--outline)', marginTop: '0.5rem' }}>
                Máximo 100 MB • Solo formato .zip
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              onChange={handleFileInput}
              style={{ display: 'none' }}
            />

            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem' }}>
                <div className="spinner" />
                <span style={{ fontSize: '0.9rem', color: 'var(--on-surface-variant)' }}>Leyendo archivo ZIP...</span>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Preview extracted files + config */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ background: 'rgba(109,221,255,0.06)', padding: '1rem', borderRadius: '0.75rem', textAlign: 'center' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{extractedFiles.length}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>Archivos de código</p>
              </div>
              <div style={{ background: 'rgba(193,128,255,0.06)', padding: '1rem', borderRadius: '0.75rem', textAlign: 'center' }}>
                <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--secondary)' }}>{skippedCount}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>Archivos omitidos</p>
              </div>
            </div>

            {/* Repo config */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Nombre del Repositorio
              </label>
              <input
                className="input-field"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                placeholder="Nombre de tu proyecto"
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Descripción <span style={{ color: 'var(--on-surface-variant)' }}>(Opcional)</span>
              </label>
              <input
                className="input-field"
                value={repoDesc}
                onChange={(e) => setRepoDesc(e.target.value)}
                placeholder="¿De qué trata este proyecto?"
              />
            </div>

            {/* File list preview */}
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface)', marginBottom: '0.5rem', fontWeight: 500 }}>
                Archivos a subir ({extractedFiles.length})
              </label>
              <div style={{
                border: '1px solid rgba(72,72,73,0.3)',
                borderRadius: '0.5rem',
                maxHeight: '180px',
                overflowY: 'auto',
                background: 'var(--surface-container)',
              }}>
                {extractedFiles.slice(0, 100).map((f, i) => (
                  <div key={i} style={{
                    padding: '0.5rem 0.75rem',
                    borderBottom: '1px solid rgba(72,72,73,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8rem',
                    fontFamily: 'JetBrains Mono, monospace',
                    color: 'var(--on-surface-variant)',
                  }}>
                    <File size={14} color="var(--primary)" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.path}</span>
                  </div>
                ))}
                {extractedFiles.length > 100 && (
                  <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.75rem', color: 'var(--outline)', textAlign: 'center' }}>
                    ... y {extractedFiles.length - 100} archivos más
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                className="btn-ghost"
                onClick={() => { setStep(1); setFile(null); setExtractedFiles([]); }}
                style={{ flex: 1 }}
              >
                Cambiar archivo
              </button>
              <button
                className="btn-primary"
                onClick={handleUpload}
                disabled={!repoName.trim() || extractedFiles.length === 0}
                style={{ flex: 1 }}
              >
                Subir {extractedFiles.length} archivos
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Progress */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '2rem 1rem' }}>
            <div style={{ position: 'relative', width: '80px', height: '80px' }}>
              <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="36" fill="transparent" stroke="var(--surface-bright)" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="36"
                  fill="transparent"
                  stroke="var(--secondary)"
                  strokeWidth="6"
                  strokeDasharray="226"
                  strokeDashoffset={226 - (226 * (progress.current / Math.max(progress.total, 1)))}
                  style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: 700 }}>
                {progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                {progress.current === progress.total ? '¡Subida completa!' : 'Subiendo archivos...'}
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', fontFamily: 'monospace', maxWidth: '400px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {progress.currentFile}
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--secondary)', marginTop: '1rem', fontWeight: 500 }}>
                {progress.current} / {progress.total} archivos procesados
              </p>
            </div>
            {progress.current === progress.total && (
              <CheckCircle2 size={32} color="var(--tertiary)" style={{ animation: 'fadeIn 0.5s ease' }} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Detect the primary language based on file extensions */
function detectLanguage(files: { path: string }[]): string {
  const counts: Record<string, number> = {};
  const langMap: Record<string, string> = {
    '.ts': 'TypeScript', '.tsx': 'TypeScript',
    '.js': 'JavaScript', '.jsx': 'JavaScript',
    '.py': 'Python', '.pyw': 'Python',
    '.java': 'Java', '.kt': 'Kotlin',
    '.c': 'C', '.cpp': 'C++', '.cs': 'C#',
    '.go': 'Go', '.rs': 'Rust', '.rb': 'Ruby',
    '.php': 'PHP', '.swift': 'Swift',
    '.html': 'HTML', '.css': 'CSS',
    '.vue': 'Vue', '.svelte': 'Svelte',
  };

  for (const f of files) {
    const ext = f.path.substring(f.path.lastIndexOf('.')).toLowerCase();
    const lang = langMap[ext];
    if (lang) counts[lang] = (counts[lang] || 0) + 1;
  }

  let best = 'Otro';
  let max = 0;
  for (const [lang, count] of Object.entries(counts)) {
    if (count > max) { max = count; best = lang; }
  }
  return best;
}
