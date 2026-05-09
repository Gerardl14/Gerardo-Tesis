'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Bell, MessageSquare, Award, UserPlus, MessageCircle, Info, Check, Trash2, CheckCheck } from 'lucide-react';

interface Notification {
  id: string;
  user_id: string;
  type: 'comment' | 'grade' | 'invite' | 'forum_reply' | 'system';
  title: string;
  content: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  comment: { icon: MessageSquare, color: 'var(--primary)', bg: 'rgba(109,221,255,0.12)' },
  grade: { icon: Award, color: 'var(--secondary)', bg: 'rgba(193,128,255,0.12)' },
  invite: { icon: UserPlus, color: 'var(--tertiary)', bg: 'rgba(155,255,206,0.12)' },
  forum_reply: { icon: MessageCircle, color: '#ffb74d', bg: 'rgba(255,183,77,0.12)' },
  system: { icon: Info, color: 'var(--on-surface-variant)', bg: 'rgba(173,170,171,0.12)' },
};

interface Props {
  userId: string;
}

export default function NotificationBell({ userId }: Props) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);

    const notifs = data || [];
    setNotifications(notifs);
    setUnreadCount(notifs.filter(n => !n.read).length);
  }, [userId]);

  // Initial load
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev].slice(0, 30));
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isOpen && panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string, wasUnread: boolean) => {
    await supabase.from('notifications').delete().eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (wasUnread) setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleClick = (notif: Notification) => {
    if (!notif.read) markAsRead(notif.id);
    if (notif.link) {
      router.push(notif.link);
      setIsOpen(false);
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  return (
    <div ref={panelRef} style={{ position: 'relative' }}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--on-surface-variant)', padding: '0.5rem',
          borderRadius: '0.5rem', display: 'flex', alignItems: 'center',
          justifyContent: 'center', position: 'relative',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(109,221,255,0.1)'; e.currentTarget.style.color = 'var(--primary)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--on-surface-variant)'; }}
        aria-label="Notificaciones"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '2px', right: '2px',
            width: unreadCount > 9 ? '20px' : '16px', height: '16px',
            borderRadius: '9999px',
            background: 'var(--error)',
            color: '#fff',
            fontSize: '0.6rem',
            fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid var(--surface-container-low)',
            animation: 'fadeIn 0.3s ease',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '0.5rem',
          width: '380px',
          maxHeight: '480px',
          background: 'var(--surface-container-high)',
          border: '1px solid rgba(72,72,73,0.2)',
          borderRadius: '0.75rem',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          zIndex: 200,
          animation: 'fadeIn 0.2s ease',
        }}>
          {/* Header */}
          <div style={{
            padding: '1rem 1.25rem',
            borderBottom: '1px solid rgba(72,72,73,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Notificaciones</h3>
              {unreadCount > 0 && (
                <span className="badge badge-cyan">{unreadCount} nuevas</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--primary)', fontSize: '0.75rem', fontWeight: 600,
                  fontFamily: 'Inter', display: 'flex', alignItems: 'center', gap: '0.3rem',
                }}
              >
                <CheckCheck size={14} /> Leer todas
              </button>
            )}
          </div>

          {/* Notification list */}
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--on-surface-variant)' }}>
                <Bell size={32} strokeWidth={1} style={{ opacity: 0.4, marginBottom: '0.75rem' }} />
                <p style={{ fontSize: '0.85rem' }}>Sin notificaciones</p>
              </div>
            ) : (
              notifications.map(notif => {
                const config = typeConfig[notif.type] || typeConfig.system;
                const Icon = config.icon;
                return (
                  <div
                    key={notif.id}
                    onClick={() => handleClick(notif)}
                    style={{
                      padding: '0.875rem 1.25rem',
                      borderBottom: '1px solid rgba(72,72,73,0.1)',
                      display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                      cursor: notif.link ? 'pointer' : 'default',
                      background: notif.read ? 'transparent' : 'rgba(109,221,255,0.03)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(109,221,255,0.03)'; }}
                  >
                    {/* Icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: config.bg,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={16} color={config.color} />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: '0.85rem', fontWeight: notif.read ? 400 : 600,
                        marginBottom: '0.15rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {notif.title}
                      </p>
                      {notif.content && (
                        <p style={{
                          fontSize: '0.75rem', color: 'var(--on-surface-variant)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {notif.content}
                        </p>
                      )}
                      <span style={{ fontSize: '0.65rem', color: 'var(--outline)', marginTop: '0.25rem', display: 'block' }}>
                        {timeAgo(notif.created_at)}
                      </span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                      {!notif.read && (
                        <button
                          onClick={(e) => { e.stopPropagation(); markAsRead(notif.id); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: '0.2rem' }}
                          title="Marcar como leída"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteNotification(notif.id, !notif.read); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-variant)', padding: '0.2rem' }}
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>

                    {/* Unread dot */}
                    {!notif.read && (
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--primary)',
                        flexShrink: 0, alignSelf: 'center',
                      }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
