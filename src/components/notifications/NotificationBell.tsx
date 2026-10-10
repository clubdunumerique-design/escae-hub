"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { markNotificationAsReadAction, markAllNotificationsAsReadAction } from "@/lib/notifications/actions";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link_url: string | null;
  read_at: string | null;
  created_at: string;
}

interface NotificationBellProps {
  initialNotifications: Notification[];
}

export function NotificationBell({ initialNotifications }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const menuRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => n.read_at === null).length;

  // Fermer au clic extérieur
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleMarkAsRead(id: string) {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
    await markNotificationAsReadAction(id);
  }

  async function handleMarkAllAsRead() {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
    );
    await markAllNotificationsAsReadAction();
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 text-white/70 transition-all hover:bg-white/10 hover:text-white"
      >
        <span className="text-xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-lg shadow-red-500/50">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-xl border border-white/10 bg-[#0d0d0d]/95 p-0 shadow-2xl backdrop-blur-xl z-50">
          <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
            <h3 className="font-semibold text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-[#05F228] hover:underline"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-white/40">
                Aucune notification.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifications.map((notif) => {
                  const isUnread = notif.read_at === null;
                  return (
                    <div
                      key={notif.id}
                      className={`block p-4 transition-all ${
                        isUnread ? "bg-[#03A61C]/5" : "hover:bg-white/5"
                      }`}
                      onClick={() => {
                        if (isUnread) handleMarkAsRead(notif.id);
                        if (!notif.link_url) setIsOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {isUnread && (
                          <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#05F228] shadow-[0_0_8px_rgba(5,242,40,0.8)]" />
                        )}
                        <div className="flex-1">
                          {notif.link_url ? (
                            <Link href={notif.link_url} onClick={() => setIsOpen(false)} className="block">
                              <p className="font-semibold text-white/90 group-hover:text-white">
                                {notif.title}
                              </p>
                            </Link>
                          ) : (
                            <p className="font-semibold text-white/90">{notif.title}</p>
                          )}
                          <p className="mt-1 text-xs text-white/60">{notif.message}</p>
                          <p className="mt-2 text-[10px] text-white/30">
                            {new Date(notif.created_at).toLocaleString("fr-FR")}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
