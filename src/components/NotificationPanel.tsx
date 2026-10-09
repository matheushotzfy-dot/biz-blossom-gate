import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/integrations/supabase/client";
import { uniqueChannelName } from "@/lib/realtime";
import { useAuth } from "@/hooks/useAuth";
import {
  Bell, ArrowDownToLine, CheckCircle2, XCircle, Info,
  Megaphone, Clock, X, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  user_id: string | null;
};

const typeConfig: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  withdrawal: { icon: ArrowDownToLine, color: "text-primary", bg: "bg-primary/10" },
  info: { icon: Info, color: "text-info", bg: "bg-info/10" },
  success: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  sale: { icon: CheckCircle2, color: "text-success", bg: "bg-success/10" },
  warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10" },
  alert: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  announcement: { icon: Megaphone, color: "text-primary", bg: "bg-primary/10" },
};

const IMPORTANT_TYPES = new Set(["announcement", "alert", "warning"]);

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: Props) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    const [userRes, globalRes] = await Promise.all([
      supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
      supabase.from("notifications").select("*").is("user_id", null).order("created_at", { ascending: false }).limit(10),
    ]);
    const all = [...(userRes.data || []), ...(globalRes.data || [])]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 30);
    setNotifications(all as Notification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      loadNotifications();
    }
  }, [open, user, loadNotifications]);

  // Realtime — INSERT + UPDATE + DELETE
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(uniqueChannelName(`notifications-realtime-${user.id}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload) => {
        const row = (payload.new || payload.old) as Notification | undefined;
        if (!row) return;
        if (row.user_id === user.id || row.user_id === null) {
          loadNotifications();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadNotifications]);

  const markAsRead = async (notif: Notification) => {
    if (!user) return;
    // Global notifications (user_id null) are shared across all users — they must
    // never be mutated in the DB by a single reader, only flipped locally.
    if (notif.user_id === null) {
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      return;
    }
    await supabase.from("notifications").update({ is_read: true }).eq("id", notif.id).eq("user_id", user.id);
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unreadUserIds = notifications.filter(n => !n.is_read && n.user_id === user.id).map(n => n.id);
    if (unreadUserIds.length > 0) {
      await supabase.from("notifications").update({ is_read: true }).in("id", unreadUserIds).eq("user_id", user.id);
    }
    // Global notifications are only flipped locally; user-owned ones are now persisted above.
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const importantUnread = notifications.filter(n => !n.is_read && IMPORTANT_TYPES.has(n.type));
  const regular = notifications.filter(n => !importantUnread.some(i => i.id === n.id));

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const renderItem = (notif: Notification, opts: { important?: boolean; isLast?: boolean } = {}) => {
    const config = typeConfig[notif.type] || typeConfig.info;
    const Icon = config.icon;
    const timeAgo = formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR });
    const fullDate = format(new Date(notif.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const isGlobal = notif.user_id === null;
    return (
      <button
        key={notif.id}
        onClick={() => !notif.is_read && markAsRead(notif)}
        className={cn(
          "w-full text-left px-5 py-3.5 transition-all hover:bg-muted/8 active:scale-[0.995] group relative",
          !notif.is_read && !opts.important && "bg-primary/[0.02]",
          opts.important && "bg-primary/[0.06] border-l-2 border-primary",
          !opts.isLast && "border-b border-border/10",
        )}
      >
        {!notif.is_read && !opts.important && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
        <div className="flex gap-3">
          <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5", config.bg)}>
            <Icon className={cn("h-4 w-4", config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className={cn(
                "text-[12px] leading-tight",
                notif.is_read ? "font-medium text-foreground/60" : "font-bold text-foreground",
              )}>
                {notif.title}
              </h4>
              <div className="flex items-center gap-1 shrink-0">
                {opts.important && (
                  <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground">
                    Importante
                  </span>
                )}
                {isGlobal && !opts.important && (
                  <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/8 text-primary border border-primary/10">
                    Geral
                  </span>
                )}
              </div>
            </div>
            <p className={cn("text-[11px] leading-relaxed mt-1 line-clamp-2", notif.is_read ? "text-muted-foreground/40" : "text-muted-foreground/70")}>
              {notif.message}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              <Clock className="h-2.5 w-2.5 text-muted-foreground/25" />
              <span className="text-[9px] text-muted-foreground/40" title={fullDate}>
                {timeAgo}
              </span>
            </div>
          </div>
        </div>
      </button>
    );
  };

  const panel = (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-[2px] animate-in fade-in duration-150" onClick={onClose} />

      {/* Panel — bottom sheet on mobile, floating on desktop */}
      <div className={cn(
        "fixed z-[110]",
        "inset-x-0 bottom-0 sm:inset-x-auto sm:bottom-auto sm:top-16 sm:right-4",
        "sm:max-w-[400px] sm:w-[400px]",
        "animate-in slide-in-from-bottom-4 sm:slide-in-from-top-2 fade-in duration-200",
      )}>
        <div className="rounded-t-3xl sm:rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden max-h-[85vh] sm:max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/20 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Bell className="h-4 w-4 text-primary" strokeWidth={2.25} />
              </div>
              <div>
                <h3 className="text-[13px] font-bold text-foreground">Notificações</h3>
                {unreadCount > 0 && (
                  <p className="text-[10px] text-muted-foreground/60">{unreadCount} não lida{unreadCount > 1 ? "s" : ""}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-primary/5"
                >
                  Marcar todas
                </button>
              )}
              <button onClick={onClose} className="h-8 w-8 rounded-xl hover:bg-muted/40 flex items-center justify-center transition-colors">
                <X className="h-3.5 w-3.5 text-muted-foreground/60" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="py-14 text-center">
                <div className="h-6 w-6 mx-auto border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-16 text-center px-6">
                <div className="h-14 w-14 mx-auto rounded-2xl border border-border/20 bg-muted/5 flex items-center justify-center mb-4">
                  <Bell className="h-6 w-6 text-muted-foreground/30" />
                </div>
                <p className="text-[12px] font-bold text-muted-foreground/60">Nenhuma notificação</p>
                <p className="text-[10px] text-muted-foreground/40 mt-1">Você será notificado sobre vendas e atualizações</p>
              </div>
            ) : (
              <div>
                {importantUnread.length > 0 && (
                  <div>
                    <div className="px-5 pt-3 pb-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-primary/70">
                      Avisos importantes
                    </div>
                    {importantUnread.map((n, i) => renderItem(n, { important: true, isLast: i === importantUnread.length - 1 }))}
                    <div className="h-2 bg-muted/20" />
                  </div>
                )}
                {regular.map((n, i) => renderItem(n, { isLast: i === regular.length - 1 }))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );

  return createPortal(panel, document.body);
}

// Export a hook for unread count
export function useNotificationCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    // Debounced: bursts of inserts trigger one count, not one per event.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      Promise.all([
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
        supabase.from("notifications").select("id", { count: "exact", head: true }).is("user_id", null).eq("is_read", false),
      ]).then(([a, b]) => setCount((a.count || 0) + (b.count || 0)));
    };
    const load = () => { clearTimeout(timer); timer = setTimeout(run, 800); };
    run();
    const channel = supabase
      .channel(uniqueChannelName(`notif-count-${user.id}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [user]);

  return count;
}
