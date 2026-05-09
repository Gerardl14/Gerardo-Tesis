'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Award, CheckCircle, XCircle, Edit3, Save, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface Grade {
  id: string;
  teacher_id: string;
  student_id: string;
  repo_id: string;
  score: number;
  feedback: string | null;
  created_at: string;
  updated_at: string;
  teacher_name?: string;
  student_name?: string;
}

interface Props {
  repoId: string;
  userId: string;
  userRole: string;
  repoOwnerId: string;
}

export default function GradingPanel({ repoId, userId, userRole, repoOwnerId }: Props) {
  const [grades, setGrades] = useState<Grade[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [score, setScore] = useState<number>(0);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [studentsList, setStudentsList] = useState<{id: string, name: string}[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  const isTeacher = userRole === 'docente' || userRole === 'superadministrador';
  const isOwner = userId === repoOwnerId;

  useEffect(() => {
    loadGrades();
    if (isTeacher) loadStudents();
  }, [repoId, isTeacher]);

  const loadStudents = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('role', 'estudiante')
      .order('full_name');
    if (data) {
      setStudentsList(data.map(s => ({ id: s.id, name: s.full_name || 'Sin nombre' })));
    }
  };

  const loadGrades = async () => {
    const { data, error } = await supabase
      .from('grades')
      .select('*')
      .eq('repo_id', repoId)
      .order('created_at', { ascending: false });

    if (error) { console.error('[Grades] Load error:', error); return; }

    if (data && data.length > 0) {
      const userIds = [...new Set([...data.map(g => g.teacher_id), ...data.map(g => g.student_id)].filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);

      const nameMap: Record<string, string> = {};
      profiles?.forEach(p => { nameMap[p.id] = p.full_name || 'Usuario'; });

      data.forEach(g => { 
        g.teacher_name = nameMap[g.teacher_id] || 'Docente'; 
        g.student_name = nameMap[g.student_id] || 'Estudiante';
      });
    }

    setGrades(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (score < 0 || score > 100) return;
    setLoading(true);

    try {
      if (editingId) {
        // Update existing grade
        const { error } = await supabase
          .from('grades')
          .update({ score, feedback: feedback || null, updated_at: new Date().toISOString() })
          .eq('id', editingId);
        if (error) throw error;
      } else {
        if (!selectedStudentId) { alert('Debes seleccionar un estudiante'); setLoading(false); return; }
        // Insert new grade
        const { error } = await supabase
          .from('grades')
          .insert({
            teacher_id: userId,
            student_id: selectedStudentId,
            repo_id: repoId,
            score,
            feedback: feedback || null,
          });
        if (error) throw error;
      }

      setShowForm(false);
      setEditingId(null);
      setScore(0);
      setFeedback('');
      loadGrades();
    } catch (err: any) {
      console.error('[Grades] Save error:', err);
      alert(err.message || 'Error al guardar la calificación');
    } finally {
      setLoading(false);
    }
  };

  const deleteGrade = async (id: string) => {
    if (!confirm('¿Eliminar esta calificación?')) return;
    await supabase.from('grades').delete().eq('id', id);
    loadGrades();
  };

  const startEdit = (grade: Grade) => {
    setEditingId(grade.id);
    setScore(grade.score);
    setFeedback(grade.feedback || '');
    setSelectedStudentId(grade.student_id);
    setShowForm(true);
  };

  const getScoreColor = (s: number) => {
    if (s >= 80) return 'var(--tertiary)';
    if (s >= 60) return 'var(--primary)';
    if (s >= 40) return '#ffb74d';
    return 'var(--error)';
  };

  const getScoreLabel = (s: number) => {
    if (s >= 90) return 'Excelente';
    if (s >= 80) return 'Muy Bueno';
    if (s >= 70) return 'Bueno';
    if (s >= 60) return 'Aprobado';
    return 'Reprobado';
  };

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
          <Award size={20} color="var(--secondary)" />
          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Evaluación del Repositorio</span>
          {grades.length > 0 && (
            <span className="badge badge-purple" style={{ marginLeft: '0.5rem' }}>
              {grades.length} {grades.length === 1 ? 'nota' : 'notas'}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={18} color="var(--on-surface-variant)" /> : <ChevronDown size={18} color="var(--on-surface-variant)" />}
      </button>

      {isExpanded && (
        <div style={{ padding: '0 1.25rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Existing grades */}
          {grades.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {grades.map(grade => (
                <div key={grade.id} style={{
                  background: 'var(--surface-container-high)',
                  border: '1px solid rgba(72,72,73,0.1)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  display: 'flex',
                  gap: '1.25rem',
                  alignItems: 'flex-start',
                }}>
                  {/* Score circle */}
                  <div style={{
                    width: '64px', height: '64px',
                    borderRadius: '50%',
                    border: `3px solid ${getScoreColor(grade.score)}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    background: `${getScoreColor(grade.score)}11`,
                  }}>
                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: getScoreColor(grade.score), lineHeight: 1 }}>
                      {grade.score}
                    </span>
                    <span style={{ fontSize: '0.55rem', color: 'var(--on-surface-variant)', fontWeight: 500 }}>/100</span>
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      {grade.score >= 60
                        ? <CheckCircle size={16} color="var(--tertiary)" />
                        : <XCircle size={16} color="var(--error)" />
                      }
                      <span style={{
                        fontSize: '0.85rem', fontWeight: 700,
                        color: grade.score >= 60 ? 'var(--tertiary)' : 'var(--error)',
                      }}>
                        {getScoreLabel(grade.score)}
                      </span>
                    </div>
                    {grade.feedback && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)', lineHeight: 1.6, marginBottom: '0.5rem' }}>
                        {grade.feedback}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--outline)' }}>
                        Estudiante: <strong style={{ color: 'var(--primary)' }}>{grade.student_name}</strong>
                        <br />
                        Evaluado por <strong style={{ color: 'var(--secondary)' }}>{grade.teacher_name}</strong>
                        {' · '}
                        {new Date(grade.created_at).toLocaleDateString('es-VE', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                      {/* Edit/Delete buttons for the teacher who gave the grade or superadmin */}
                      {(grade.teacher_id === userId || userRole === 'superadministrador') && (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            onClick={() => startEdit(grade)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '0.25rem' }}
                            title="Editar calificación"
                          >
                            <Edit3 size={14} />
                          </button>
                          {userRole === 'superadministrador' && (
                            <button
                              onClick={() => deleteGrade(grade.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: '0.25rem' }}
                              title="Eliminar calificación"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '1.5rem 1rem', color: 'var(--on-surface-variant)', fontSize: '0.85rem' }}>
              Este repositorio aún no ha sido evaluado.
            </div>
          )}

          {/* Grade form — only for teachers, hidden if they are grading their own repo */}
          {isTeacher && !isOwner && (
            <>
              {!showForm ? (
                <button
                  className="btn-primary"
                  onClick={() => {
                    setShowForm(true);
                    if (!editingId && studentsList.length > 0 && !selectedStudentId) {
                      const isOwnerStudent = studentsList.some(s => s.id === repoOwnerId);
                      setSelectedStudentId(isOwnerStudent ? repoOwnerId : studentsList[0].id);
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <Award size={16} /> Asignar Calificación
                </button>
              ) : (
                <form onSubmit={handleSubmit} style={{
                  background: 'var(--surface-container-high)',
                  border: '1px solid rgba(193,128,255,0.2)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Award size={16} color="var(--secondary)" />
                    {editingId ? 'Editar Calificación' : 'Nueva Calificación'}
                  </h4>

                  {/* Student selector */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface)', marginBottom: '0.5rem', fontWeight: 500 }}>
                      Estudiante a evaluar
                    </label>
                    <select 
                      className="input-field" 
                      value={selectedStudentId} 
                      onChange={e => setSelectedStudentId(e.target.value)}
                      required
                    >
                      {studentsList.length === 0 && <option value="">No hay estudiantes disponibles</option>}
                      {studentsList.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Score slider + number input */}
                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface)', marginBottom: '0.5rem', fontWeight: 500 }}>
                      Puntuación: <strong style={{ color: getScoreColor(score), fontSize: '1.1rem' }}>{score}/100</strong>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: score >= 60 ? 'var(--tertiary)' : 'var(--error)' }}>
                        ({getScoreLabel(score)})
                      </span>
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={score}
                        onChange={(e) => setScore(Number(e.target.value))}
                        style={{
                          flex: 1,
                          accentColor: getScoreColor(score),
                          height: '6px',
                        }}
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={score}
                        onChange={(e) => setScore(Math.min(100, Math.max(0, Number(e.target.value))))}
                        className="input-field"
                        style={{ width: '70px', textAlign: 'center', padding: '0.5rem' }}
                      />
                    </div>
                    {/* Visual bar */}
                    <div style={{ marginTop: '0.5rem', height: '4px', borderRadius: '2px', background: 'var(--surface-bright)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${score}%`,
                        background: `linear-gradient(90deg, var(--error), #ffb74d, var(--primary), var(--tertiary))`,
                        borderRadius: '2px',
                        transition: 'width 0.2s ease',
                      }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--on-surface)', marginBottom: '0.5rem', fontWeight: 500 }}>
                      Feedback / Observaciones <span style={{ color: 'var(--on-surface-variant)' }}>(Opcional)</span>
                    </label>
                    <textarea
                      className="input-field"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Escribe tu retroalimentación para el estudiante..."
                      rows={3}
                      style={{ resize: 'vertical' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => { setShowForm(false); setEditingId(null); setScore(0); setFeedback(''); }}
                      style={{ flex: 1 }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn-primary"
                      disabled={loading}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                    >
                      <Save size={16} /> {loading ? 'Guardando...' : editingId ? 'Actualizar' : 'Guardar Calificación'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* Student view: if the current user is the owner, show a simple message */}
          {isOwner && grades.length === 0 && (
            <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', textAlign: 'center', fontStyle: 'italic' }}>
              Tu docente aún no ha evaluado este repositorio.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
