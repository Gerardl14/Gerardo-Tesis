'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import NotificationBell from '@/components/NotificationBell';
import SearchModal from '@/components/SearchModal';
import {
  LayoutDashboard,
  FolderGit2,
  MessageSquare,
  User,
  LogOut,
  Shield,
  Menu,
  X,
  ChevronLeft,
  Search,
  FileSpreadsheet,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, signOut } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  // Close on click outside
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (
      isOpen &&
      sidebarRef.current &&
      !sidebarRef.current.contains(e.target as Node)
    ) {
      setIsOpen(false);
    }
  }, [isOpen]);

  // Close on Escape key
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [handleClickOutside, handleEscape]);

  // Ctrl+K to open search
  useEffect(() => {
    const handleCtrlK = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    document.addEventListener('keydown', handleCtrlK);
    return () => document.removeEventListener('keydown', handleCtrlK);
  }, []);

  // Close sidebar when navigating to a new page
  useEffect(() => {
    // eslint-disable-next-line
    setIsOpen(false);
  }, [pathname]);

  const links = [
    { href: '/dashboard', label: 'Panel Principal', icon: LayoutDashboard },
    { href: '/repos', label: 'Repositorios', icon: FolderGit2 },
    { href: '/forum', label: 'Foro de Dudas', icon: MessageSquare },
    { href: '/profile', label: 'Mi Perfil', icon: User },
  ];

  // Docentes y superadmins pueden ver Reportes
  if (profile?.role === 'docente' || profile?.role === 'superadministrador') {
    links.push({ href: '/reports', label: 'Reportes', icon: FileSpreadsheet });
  }

  // Superadmins ven la sección de administración
  if (profile?.role === 'superadministrador') {
    links.push({ href: '/admin', label: 'Administración', icon: Shield });
  }

  const roleLabel =
    profile?.role === 'superadministrador'
      ? 'Super Administrador'
      : profile?.role === 'docente'
        ? 'Docente'
        : 'Estudiante';

  const roleBgColor =
    profile?.role === 'superadministrador'
      ? 'rgba(255,113,108,0.12)'
      : profile?.role === 'docente'
        ? 'rgba(193,128,255,0.12)'
        : 'rgba(109,221,255,0.12)';

  const roleTextColor =
    profile?.role === 'superadministrador'
      ? 'var(--error)'
      : profile?.role === 'docente'
        ? 'var(--secondary)'
        : 'var(--primary)';

  return (
    <>
      {/* Fixed Top Bar */}
      <div className="topbar glass">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="sidebar-toggle-btn"
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {isOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <h2 style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)', letterSpacing: '-0.02em', margin: 0 }}>
            AIS<span style={{ color: 'var(--on-surface-variant)', fontWeight: 400 }}> Lab</span>
          </h2>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Search button */}
          <button
            onClick={() => setShowSearch(true)}
            className="sidebar-toggle-btn"
            aria-label="Buscar"
            title="Buscar (Ctrl+K)"
          >
            <Search size={18} />
          </button>
          {/* Notifications */}
          {user && <NotificationBell userId={user.id} />}
          {/* Role badge */}
          {profile && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
              fontSize: '0.7rem', fontWeight: 600,
              padding: '0.15rem 0.6rem', borderRadius: '9999px',
              background: roleBgColor, color: roleTextColor,
              marginLeft: '0.25rem',
            }}>
              {roleLabel}
            </span>
          )}
        </div>
      </div>

      {/* Search Modal */}
      <SearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} />

      {/* Dark overlay when sidebar is open */}
      <div
        className={`sidebar-overlay ${isOpen ? 'visible' : ''}`}
        aria-hidden={!isOpen}
      />

      {/* Sidebar Panel */}
      <div
        ref={sidebarRef}
        className={`sidebar ${isOpen ? 'open' : ''}`}
        role="navigation"
        aria-label="Menú principal"
      >
        {/* Sidebar Header */}
        <div style={{ padding: '0 1.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontFamily: 'Manrope', fontWeight: 800, fontSize: '1.25rem', color: 'var(--primary)', letterSpacing: '-0.02em' }}>
              AIS<span style={{ color: 'var(--on-surface-variant)', fontWeight: 400 }}> Lab</span>
            </h2>
            <p style={{ fontSize: '0.7rem', color: 'var(--on-surface-variant)', marginTop: '0.25rem' }}>
              Plataforma de Aprendizaje
            </p>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="sidebar-toggle-btn"
            aria-label="Cerrar menú"
            style={{ marginRight: '-0.5rem' }}
          >
            <ChevronLeft size={20} />
          </button>
        </div>

        {/* Navigation Links */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`sidebar-link ${pathname === link.href ? 'active' : ''}`}
            >
              <link.icon size={18} />
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Footer: user info + logout */}
        <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid rgba(72,72,73,0.15)' }}>
          {profile && (
            <div style={{ marginBottom: '0.75rem' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                {profile.full_name || 'Usuario'}
              </p>
              <span style={{
                display: 'inline-block',
                fontSize: '0.7rem',
                fontWeight: 600,
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                background: roleBgColor,
                color: roleTextColor,
              }}>
                {roleLabel}
              </span>
            </div>
          )}
          <button
            onClick={handleSignOut}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              color: 'var(--on-surface-variant)', background: 'none',
              border: 'none', cursor: 'pointer', fontSize: '0.8rem',
              fontFamily: 'Inter', padding: '0.25rem 0',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--error)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--on-surface-variant)')}
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </>
  );
}
