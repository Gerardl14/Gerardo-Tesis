'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { FileSpreadsheet, Download, Filter, Users, Award, FolderGit2, CheckCircle, XCircle, Printer } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface StudentGrade {
  student_id: string;
  student_name: string;
  student_role: string;
  repo_id: string;
  repo_name: string;
  repo_language: string | null;
  score: number;
  feedback: string | null;
  teacher_name: string;
  graded_at: string;
}

export default function ReportsPage() {
  const { user, profile } = useAuthStore();
  const router = useRouter();
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'passed' | 'failed'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'score' | 'date'>('name');

  const isTeacher = profile?.role === 'docente' || profile?.role === 'superadministrador';

  const loadGrades = async () => {
    setLoading(true);

    // Get all grades
    const { data: gradesData, error } = await supabase
      .from('grades')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !gradesData) { setLoading(false); return; }

    // Get all referenced user IDs (students + teachers)
    const allUserIds = [...new Set([
      ...gradesData.map(g => g.student_id),
      ...gradesData.map(g => g.teacher_id).filter(Boolean),
    ])];

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', allUserIds);

    const profileMap: Record<string, { name: string; role: string }> = {};
    profiles?.forEach(p => { profileMap[p.id] = { name: p.full_name || 'Sin nombre', role: p.role }; });

    // Get all referenced repo IDs
    const repoIds = [...new Set(gradesData.map(g => g.repo_id))];
    const { data: repos } = await supabase
      .from('repositories')
      .select('id, name, primary_language')
      .in('id', repoIds);

    const repoMap: Record<string, { name: string; language: string | null }> = {};
    repos?.forEach(r => { repoMap[r.id] = { name: r.name, language: r.primary_language }; });

    const mapped: StudentGrade[] = gradesData
      .filter(g => profileMap[g.student_id]?.role === 'estudiante')
      .map(g => ({
      student_id: g.student_id,
      student_name: profileMap[g.student_id]?.name || 'Desconocido',
      student_role: profileMap[g.student_id]?.role || 'estudiante',
      repo_id: g.repo_id,
      repo_name: repoMap[g.repo_id]?.name || 'Repo eliminado',
      repo_language: repoMap[g.repo_id]?.language || null,
      score: g.score,
      feedback: g.feedback,
      teacher_name: profileMap[g.teacher_id]?.name || 'Docente',
      graded_at: g.created_at,
    }));

    setGrades(mapped);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (!isTeacher) { router.replace('/dashboard'); return; }
    loadGrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, profile, router]);

  // Filtered & sorted data
  const filtered = grades.filter(g => {
    if (filterStatus === 'passed') return g.score >= 60;
    if (filterStatus === 'failed') return g.score < 60;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.student_name.localeCompare(b.student_name);
    if (sortBy === 'score') return b.score - a.score;
    if (sortBy === 'date') return new Date(b.graded_at).getTime() - new Date(a.graded_at).getTime();
    return 0;
  });

  // Stats
  const totalStudents = new Set(grades.map(g => g.student_id)).size;
  const avgScore = grades.length > 0 ? Math.round(grades.reduce((s, g) => s + g.score, 0) / grades.length) : 0;
  const passedCount = grades.filter(g => g.score >= 60).length;
  const failedCount = grades.filter(g => g.score < 60).length;

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    
    // Título y Cabecera
    doc.setFontSize(18);
    doc.text('Reporte de Calificaciones', 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generado el: ${new Date().toLocaleDateString('es-VE')}`, 14, 30);

    const tableColumn = ["Estudiante", "Repositorio", "Lenguaje", "Puntaje", "Estado", "Evaluador", "Feedback", "Fecha"];
    const tableRows: any[][] = [];

    sorted.forEach(g => {
      const status = g.score >= 60 ? 'Aprobado' : 'Reprobado';
      const date = new Date(g.graded_at).toLocaleDateString('es-VE');
      const rowData = [
        g.student_name,
        g.repo_name,
        g.repo_language || 'N/A',
        g.score,
        status,
        g.teacher_name,
        g.feedback || '—',
        date
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 36,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        6: { cellWidth: 40 } // Feedback column limit
      }
    });

    doc.save(`reporte_calificaciones_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Print-friendly version
  const handlePrint = () => {
    window.print();
  };

  if (!user || !isTeacher) return null;

  return (
    <>
      <Sidebar />
      <div className="main-content">
        <div className="animate-in">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
                Panel Docente
              </p>
              <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>Reportes Académicos</h1>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={handlePrint} className="btn-ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', border: '1px solid var(--outline-variant)' }}>
                <Printer size={16} /> Imprimir
              </button>
              <button onClick={exportPDF} className="btn-primary" disabled={sorted.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Download size={16} /> Exportar PDF
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
              <Users size={22} color="var(--primary)" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)', lineHeight: 1 }}>{totalStudents}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>Estudiantes Evaluados</p>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
              <Award size={22} color="var(--secondary)" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--secondary)', lineHeight: 1 }}>{avgScore}<span style={{ fontSize: '0.9rem', fontWeight: 400 }}>/100</span></p>
              <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>Promedio General</p>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
              <CheckCircle size={22} color="var(--tertiary)" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--tertiary)', lineHeight: 1 }}>{passedCount}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>Aprobados (≥60)</p>
            </div>
            <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
              <XCircle size={22} color="var(--error)" style={{ margin: '0 auto 0.5rem' }} />
              <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--error)', lineHeight: 1 }}>{failedCount}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>Reprobados (&lt;60)</p>
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} color="var(--on-surface-variant)" />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--on-surface-variant)' }}>Filtrar:</span>
            </div>
            {[
              { key: 'all' as const, label: 'Todos', count: grades.length },
              { key: 'passed' as const, label: 'Aprobados', count: passedCount },
              { key: 'failed' as const, label: 'Reprobados', count: failedCount },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                style={{
                  padding: '0.35rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem',
                  fontWeight: 600, fontFamily: 'Inter', cursor: 'pointer',
                  background: filterStatus === f.key ? 'rgba(109,221,255,0.12)' : 'transparent',
                  border: filterStatus === f.key ? '1px solid rgba(109,221,255,0.3)' : '1px solid rgba(72,72,73,0.2)',
                  color: filterStatus === f.key ? 'var(--primary)' : 'var(--on-surface-variant)',
                  transition: 'all 0.15s ease',
                }}
              >
                {f.label} ({f.count})
              </button>
            ))}

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)' }}>Ordenar:</span>
              <select
                className="input-field"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'score' | 'date')}
                style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', width: 'auto' }}
              >
                <option value="name">Nombre</option>
                <option value="score">Puntuación</option>
                <option value="date">Fecha</option>
              </select>
            </div>
          </div>

          {/* Grades Table */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
              <div className="spinner" />
            </div>
          ) : sorted.length === 0 ? (
            <div className="empty-state">
              <FileSpreadsheet size={48} strokeWidth={1} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Sin calificaciones registradas</h3>
              <p style={{ fontSize: '0.85rem' }}>Las calificaciones asignadas desde los repositorios aparecerán aquí.</p>
            </div>
          ) : (
            <div style={{ background: 'var(--surface-container)', border: '1px solid rgba(72,72,73,0.15)', borderRadius: '0.75rem', overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(72,72,73,0.15)', background: 'rgba(72,72,73,0.05)' }}>
                      <th style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--on-surface-variant)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estudiante</th>
                      <th style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--on-surface-variant)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Repositorio</th>
                      <th style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--on-surface-variant)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Puntuación</th>
                      <th style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 600, color: 'var(--on-surface-variant)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Estado</th>
                      <th style={{ padding: '0.875rem 1rem', textAlign: 'left', fontWeight: 600, color: 'var(--on-surface-variant)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Feedback</th>
                      <th style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--on-surface-variant)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((g, i) => (
                      <tr
                        key={`${g.student_id}-${g.repo_id}-${i}`}
                        style={{
                          borderBottom: '1px solid rgba(72,72,73,0.08)',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%',
                              background: 'rgba(193,128,255,0.15)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.75rem', fontWeight: 700, color: 'var(--secondary)', flexShrink: 0,
                            }}>
                              {g.student_name[0]?.toUpperCase()}
                            </div>
                            <span style={{ fontWeight: 600 }}>{g.student_name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <FolderGit2 size={14} color="var(--primary)" />
                            <span>{g.repo_name}</span>
                            {g.repo_language && (
                              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '0.25rem', background: 'rgba(109,221,255,0.1)', color: 'var(--primary)' }}>
                                {g.repo_language}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                          <span style={{
                            fontWeight: 800, fontSize: '1.1rem',
                            color: g.score >= 80 ? 'var(--tertiary)' : g.score >= 60 ? 'var(--primary)' : g.score >= 40 ? '#ffb74d' : 'var(--error)',
                          }}>
                            {g.score}
                          </span>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                          <span style={{
                            fontSize: '0.75rem', fontWeight: 600,
                            padding: '0.2rem 0.6rem', borderRadius: '9999px',
                            background: g.score >= 60 ? 'rgba(155,255,206,0.1)' : 'rgba(255,113,108,0.1)',
                            color: g.score >= 60 ? 'var(--tertiary)' : 'var(--error)',
                          }}>
                            {g.score >= 60 ? 'Aprobado' : 'Reprobado'}
                          </span>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', maxWidth: '220px' }}>
                          <p style={{
                            fontSize: '0.8rem', color: 'var(--on-surface-variant)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            margin: 0,
                          }}>
                            {g.feedback || '—'}
                          </p>
                        </td>
                        <td style={{ padding: '0.875rem 1rem', textAlign: 'right', color: 'var(--on-surface-variant)', fontSize: '0.8rem' }}>
                          {new Date(g.graded_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
