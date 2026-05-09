'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import {
  FolderGit2, MessageSquare, TrendingUp, Shield, BookOpen,
  GraduationCap, ArrowRight, RefreshCw, Award,
  FileCode, Clock, CheckCircle, Activity,
} from 'lucide-react';

interface Stats {
  repos: number;
  threads: number;
  messages: number;
  files: number;
  comments: number;
  collaborators: number;
}

interface GradeData {
  score: number;
  repo_name: string;
  created_at: string;
}

interface RecentRepo {
  id: string;
  name: string;
  primary_language: string | null;
  created_at: string;
}

interface RecentThread {
  id: string;
  title: string;
  category: string | null;
  created_at: string;
}

export default function DashboardPage() {
  const { user, profile, profileError, fetchProfile } = useAuthStore();
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({ repos: 0, threads: 0, messages: 0, files: 0, comments: 0, collaborators: 0 });
  const [grades, setGrades] = useState<GradeData[]>([]);
  const [recentRepos, setRecentRepos] = useState<RecentRepo[]>([]);
  const [recentThreads, setRecentThreads] = useState<RecentThread[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (!profile && !profileError) fetchProfile(user.id);
  }, [user, router, profile, profileError, fetchProfile]);

  const loadAll = async () => {
    setStatsLoading(true);
    try {
      await Promise.all([loadStats(), loadGrades(), loadRecentRepos(), loadRecentThreads()]);
    } catch (e) {
      console.error('[Dashboard] Error:', e);
    }
    setStatsLoading(false);
  };

  const loadStats = async () => {
    const [repos, threads, messages, files, comments] = await Promise.all([
      supabase.from('repositories').select('id', { count: 'exact', head: true }),
      supabase.from('forum_threads').select('id', { count: 'exact', head: true }),
      supabase.from('forum_messages').select('id', { count: 'exact', head: true }),
      supabase.from('repository_files').select('id', { count: 'exact', head: true }),
      supabase.from('code_comments').select('id', { count: 'exact', head: true }),
    ]);
    setStats({
      repos: repos.count ?? 0,
      threads: threads.count ?? 0,
      messages: messages.count ?? 0,
      files: files.count ?? 0,
      comments: comments.count ?? 0,
      collaborators: 0,
    });
  };

  const loadGrades = async () => {
    // For students: their own grades. For teachers: all grades.
    const isTeacher = profile?.role === 'docente' || profile?.role === 'superadministrador';
    let query = supabase.from('grades').select('score, repo_id, created_at').order('created_at', { ascending: true });
    if (!isTeacher && user) {
      query = query.eq('student_id', user.id);
    }
    const { data } = await query.limit(20);

    if (data && data.length > 0) {
      // Fetch repo names
      const repoIds = [...new Set(data.map(g => g.repo_id))];
      const { data: repos } = await supabase.from('repositories').select('id, name').in('id', repoIds);
      const repoMap: Record<string, string> = {};
      repos?.forEach(r => { repoMap[r.id] = r.name; });

      setGrades(data.map(g => ({
        score: g.score,
        repo_name: repoMap[g.repo_id] || 'Repo',
        created_at: g.created_at,
      })));
    }
  };

  const loadRecentRepos = async () => {
    const { data } = await supabase
      .from('repositories')
      .select('id, name, primary_language, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentRepos(data || []);
  };

  const loadRecentThreads = async () => {
    const { data } = await supabase
      .from('forum_threads')
      .select('id, title, category, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    setRecentThreads(data || []);
  };

  useEffect(() => {
    if (profile) loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  if (!user) return null;

  if (profileError) {
    return (
      <>
        <Sidebar />
        <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div style={{ textAlign: 'center', maxWidth: 400 }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,113,108,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Shield size={28} color="var(--error)" />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>Error al cargar el perfil</h2>
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              No se pudo recuperar tu información de perfil. Esto puede ser un error temporal.
            </p>
            <button className="btn-primary" onClick={() => user && fetchProfile(user.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <RefreshCw size={16} /> Reintentar
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!profile) {
    return (
      <>
        <Sidebar />
        <div className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="spinner" style={{ width: 36, height: 36, margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.9rem' }}>Cargando tu perfil...</p>
          </div>
        </div>
      </>
    );
  }

  const isAdmin = profile.role === 'superadministrador';
  const isDocente = profile.role === 'docente';
  const isTeacher = isAdmin || isDocente;
  const greeting = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
  const RoleIcon = isAdmin ? Shield : isDocente ? BookOpen : GraduationCap;
  const roleName = isAdmin ? 'Super Administrador' : isDocente ? 'Docente / Preparador' : 'Estudiante';
  const roleColor = isAdmin ? 'var(--error)' : isDocente ? 'var(--secondary)' : 'var(--primary)';

  // Grade stats
  const avgGrade = grades.length > 0 ? Math.round(grades.reduce((s, g) => s + g.score, 0) / grades.length) : 0;
  const passedGrades = grades.filter(g => g.score >= 60).length;
  const bestGrade = grades.length > 0 ? Math.max(...grades.map(g => g.score)) : 0;

  // Quick actions
  const quickActions = [
    { icon: FolderGit2, title: 'Repositorios', desc: isTeacher ? 'Revisa los proyectos de los estudiantes.' : 'Crea y administra tus proyectos.', href: '/repos', color: 'var(--primary)', bg: 'rgba(109,221,255,0.08)' },
    { icon: MessageSquare, title: 'Foro de Dudas', desc: isTeacher ? 'Responde preguntas y guía.' : 'Pregunta y aprende con compañeros.', href: '/forum', color: 'var(--secondary)', bg: 'rgba(193,128,255,0.08)' },
    ...(isTeacher ? [{ icon: Award, title: 'Reportes', desc: 'Consulta calificaciones y exporta informes.', href: '/reports', color: 'var(--tertiary)', bg: 'rgba(155,255,206,0.08)' }] : []),
    ...(isAdmin ? [{ icon: Shield, title: 'Administración', desc: 'Gestiona usuarios y configuración.', href: '/admin', color: 'var(--error)', bg: 'rgba(255,113,108,0.08)' }] : []),
  ];

  return (
    <>
      <Sidebar />
      <div className="main-content">
        <div className="animate-in">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(72,72,73,0.15)' }}>
            <div>
              <p style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', marginBottom: '0.25rem' }}>
                {greeting} 👋
              </p>
              <h1 style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {profile.full_name?.split(' ')[0] || 'Usuario'}
              </h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                <RoleIcon size={14} color={roleColor} />
                <span style={{ fontSize: '0.85rem', color: roleColor, fontWeight: 600 }}>{roleName}</span>
                <span style={{ color: 'var(--outline-variant)' }}>·</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--on-surface-variant)' }}>
                  {new Date().toLocaleDateString('es-VE', { weekday: 'long', day: 'numeric', month: 'long' })}
                </span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Repositorios', value: stats.repos, icon: FolderGit2, color: 'var(--primary)', bg: 'rgba(109,221,255,0.08)' },
              { label: 'Archivos', value: stats.files, icon: FileCode, color: 'var(--tertiary)', bg: 'rgba(155,255,206,0.08)' },
              { label: 'Hilos Foro', value: stats.threads, icon: MessageSquare, color: 'var(--secondary)', bg: 'rgba(193,128,255,0.08)' },
              { label: 'Mensajes', value: stats.messages, icon: TrendingUp, color: '#ffb74d', bg: 'rgba(255,183,77,0.08)' },
              { label: 'Comentarios', value: stats.comments, icon: Activity, color: 'var(--primary)', bg: 'rgba(109,221,255,0.08)' },
            ].map((s) => (
              <div key={s.label} style={{
                background: 'var(--surface-container)',
                border: '1px solid rgba(72,72,73,0.12)',
                borderRadius: '0.75rem',
                padding: '1rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '0.65rem',
                  background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <s.icon size={18} color={s.color} />
                </div>
                <div>
                  <p style={{ fontSize: '1.35rem', fontWeight: 800, color: s.color, lineHeight: 1 }}>
                    {statsLoading ? '—' : s.value}
                  </p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', fontWeight: 500, marginTop: '0.15rem' }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Main Grid: Chart + Activity */}
          <div style={{ display: 'grid', gridTemplateColumns: grades.length > 0 ? '1fr 1fr' : '1fr', gap: '1rem', marginBottom: '1.5rem' }}>

            {/* Grades Chart (SVG) */}
            {grades.length > 0 && (
              <div style={{
                background: 'var(--surface-container)',
                border: '1px solid rgba(72,72,73,0.12)',
                borderRadius: '0.75rem',
                padding: '1.25rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Award size={16} color="var(--secondary)" />
                    {isTeacher ? 'Calificaciones Asignadas' : 'Mis Calificaciones'}
                  </h3>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>
                      Promedio: <strong style={{ color: avgGrade >= 60 ? 'var(--tertiary)' : 'var(--error)' }}>{avgGrade}</strong>
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>
                      Mejor: <strong style={{ color: 'var(--primary)' }}>{bestGrade}</strong>
                    </span>
                  </div>
                </div>

                {/* SVG Bar Chart */}
                <div style={{ overflowX: 'auto' }}>
                  <svg width={Math.max(grades.length * 52, 300)} height="180" viewBox={`0 0 ${Math.max(grades.length * 52, 300)} 180`} style={{ display: 'block' }}>
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map(v => {
                      const y = 160 - (v / 100) * 140;
                      return (
                        <g key={v}>
                          <line x1="30" y1={y} x2={Math.max(grades.length * 52, 300)} y2={y} stroke="rgba(72,72,73,0.15)" strokeDasharray="4,4" />
                          <text x="2" y={y + 4} fontSize="9" fill="var(--outline-variant)" fontFamily="Inter">{v}</text>
                        </g>
                      );
                    })}
                    {/* Pass line at 60 */}
                    <line x1="30" y1={160 - (60 / 100) * 140} x2={Math.max(grades.length * 52, 300)} y2={160 - (60 / 100) * 140} stroke="rgba(155,255,206,0.3)" strokeWidth="2" strokeDasharray="6,3" />

                    {/* Bars */}
                    {grades.map((g, i) => {
                      const barHeight = (g.score / 100) * 140;
                      const x = 40 + i * 48;
                      const y = 160 - barHeight;
                      const barColor = g.score >= 80 ? 'var(--tertiary)' : g.score >= 60 ? 'var(--primary)' : g.score >= 40 ? '#ffb74d' : 'var(--error)';
                      return (
                        <g key={i}>
                          <rect
                            x={x} y={y}
                            width="28" height={barHeight}
                            rx="4" ry="4"
                            fill={barColor}
                            opacity="0.85"
                          >
                            <title>{g.repo_name}: {g.score}/100</title>
                          </rect>
                          <text x={x + 14} y={y - 5} fontSize="9" fill={barColor} textAnchor="middle" fontWeight="700" fontFamily="Inter">
                            {g.score}
                          </text>
                          <text x={x + 14} y="175" fontSize="7" fill="var(--outline-variant)" textAnchor="middle" fontFamily="Inter">
                            {g.repo_name.length > 6 ? g.repo_name.substring(0, 6) + '…' : g.repo_name}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', justifyContent: 'center' }}>
                  {[
                    { label: 'Excelente (80+)', color: 'var(--tertiary)' },
                    { label: 'Aprobado (60+)', color: 'var(--primary)' },
                    { label: 'En riesgo (40+)', color: '#ffb74d' },
                    { label: 'Reprobado', color: 'var(--error)' },
                  ].map(l => (
                    <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '2px', background: l.color }} />
                      <span style={{ fontSize: '0.65rem', color: 'var(--on-surface-variant)' }}>{l.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Panel */}
            <div style={{
              background: 'var(--surface-container)',
              border: '1px solid rgba(72,72,73,0.12)',
              borderRadius: '0.75rem',
              padding: '1.25rem',
              display: 'flex', flexDirection: 'column',
            }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={16} color="var(--primary)" />
                Actividad Reciente
              </h3>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentRepos.length === 0 && recentThreads.length === 0 ? (
                  <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem', textAlign: 'center', padding: '2rem 0' }}>
                    No hay actividad reciente.
                  </p>
                ) : (
                  <>
                    {recentRepos.map(r => (
                      <div
                        key={`repo-${r.id}`}
                        onClick={() => router.push(`/repos/${r.id}`)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
                          cursor: 'pointer', transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(109,221,255,0.05)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: '0.5rem',
                          background: 'rgba(109,221,255,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <FolderGit2 size={14} color="var(--primary)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</p>
                          <p style={{ fontSize: '0.68rem', color: 'var(--on-surface-variant)' }}>
                            Repositorio{r.primary_language ? ` · ${r.primary_language}` : ''}
                          </p>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--outline)', flexShrink: 0 }}>
                          {timeAgo(r.created_at)}
                        </span>
                      </div>
                    ))}

                    {recentThreads.map(t => (
                      <div
                        key={`thread-${t.id}`}
                        onClick={() => router.push('/forum')}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
                          cursor: 'pointer', transition: 'background 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(193,128,255,0.05)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: '0.5rem',
                          background: 'rgba(193,128,255,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}>
                          <MessageSquare size={14} color="var(--secondary)" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '0.82rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                          <p style={{ fontSize: '0.68rem', color: 'var(--on-surface-variant)' }}>
                            Foro{t.category ? ` · ${t.category}` : ''}
                          </p>
                        </div>
                        <span style={{ fontSize: '0.65rem', color: 'var(--outline)', flexShrink: 0 }}>
                          {timeAgo(t.created_at)}
                        </span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Grade Summary Cards (if grades exist) */}
          {grades.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <div style={{
                background: 'var(--surface-container)', border: '1px solid rgba(72,72,73,0.12)',
                borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 0.75rem',
                  border: `3px solid ${avgGrade >= 60 ? 'var(--tertiary)' : 'var(--error)'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: `${avgGrade >= 60 ? 'rgba(155,255,206,0.08)' : 'rgba(255,113,108,0.08)'}`,
                }}>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: avgGrade >= 60 ? 'var(--tertiary)' : 'var(--error)', lineHeight: 1 }}>{avgGrade}</span>
                </div>
                <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>Promedio General</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)' }}>de {grades.length} evaluaciones</p>
              </div>
              <div style={{
                background: 'var(--surface-container)', border: '1px solid rgba(72,72,73,0.12)',
                borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 0.75rem',
                  background: 'rgba(155,255,206,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <CheckCircle size={24} color="var(--tertiary)" />
                </div>
                <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>Aprobadas</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--tertiary)' }}>{passedGrades}/{grades.length}</p>
              </div>
              <div style={{
                background: 'var(--surface-container)', border: '1px solid rgba(72,72,73,0.12)',
                borderRadius: '0.75rem', padding: '1.25rem', textAlign: 'center',
              }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', margin: '0 auto 0.75rem',
                  background: 'rgba(109,221,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Award size={24} color="var(--primary)" />
                </div>
                <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>Mejor Nota</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)' }}>{bestGrade}/100</p>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--on-surface-variant)' }}>
            Acceso Rápido
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
            {quickActions.map((action) => (
              <div
                key={action.href}
                className="card glass-hover"
                style={{ cursor: 'pointer' }}
                onClick={() => router.push(action.href)}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '0.75rem',
                    background: action.bg, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', marginBottom: '1rem',
                  }}>
                    <action.icon size={22} color={action.color} />
                  </div>
                  <ArrowRight size={16} color="var(--on-surface-variant)" />
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.4rem' }}>{action.title}</h3>
                <p style={{ color: 'var(--on-surface-variant)', fontSize: '0.85rem', lineHeight: 1.5 }}>{action.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString('es-VE', { day: 'numeric', month: 'short' });
}
