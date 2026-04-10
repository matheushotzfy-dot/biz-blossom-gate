import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
 Bell, ArrowDownToLine, CheckCircle2, XCircle, Info,
 Megaphone, Clock, Check, ChevronRight, X,
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
 warning: { icon: Clock, color: "text-warning", bg: "bg-warning/10" },
 alert: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
 announcement: { icon: Megaphone, color: "text-primary", bg: "bg-primary/10" },
};

interface Props {
 open: boolean;
 onClose: () => void;
}

export function NotificationPanel({ open, onClose }: Props) {
 const { user } = useAuth();
 const [notifications, setNotifications] = useState<Notification[]>([]);
 const [loading, setLoading] = useState(true);

 const loadNotifications = async () => {
 if (!user) return;
 setLoading(true);
 const [userRes, globalRes] = await Promise.all([
 supabase.from("notifications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
 supabase.from("notifications").select("*").is("user_id", null).order("created_at", { ascending: false }).limit(10),
 ]);
 const all = [...(userRes.data || []), ...(globalRes.data || [])]
 .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
 .slice(0, 30);
 setNotifications(all);
 setLoading(false);
 };

 useEffect(() => {
 if (open && user) loadNotifications();
 }, [open, user]);

 // Realtime subscription
 useEffect(() => {
 if (!user) return;
 const channel = supabase
 .channel("notifications-realtime")
 .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
 const n = payload.new as Notification;
 if (n.user_id === user.id || n.user_id === null) {
 setNotifications(prev => [n, ...prev].slice(0, 30));
 }
 })
 .subscribe();
 return () => { supabase.removeChannel(channel); };
 }, [user]);

 const markAsRead = async (id: string) => {
 await supabase.from("notifications").update({ is_read: true }).eq("id", id);
 setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
 };

 const markAllAsRead = async () => {
 if (!user) return;
 // FIX: Only mark user-specific notifications as read (global notifs have null user_id and can't be updated by users via RLS)
 const unreadUserIds = notifications.filter(n => !n.is_read && n.user_id === user.id).map(n => n.id);
 if (unreadUserIds.length === 0) return;
 await supabase.from("notifications").update({ is_read: true }).in("id", unreadUserIds);
 // Visually mark all as read in the UI even if global ones can't be persisted
 setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
 };

 const unreadCount = notifications.filter(n => !n.is_read).length;

 if (!open) return null;

  return (
  <>
  {/* Backdrop */}
  <div className="fixed inset-0 z-[60] bg-black/10 backdrop-blur-[2px]" onClick={onClose} />

  {/* Panel */}
  <div className="fixed right-4 top-14 z-[70] w-full max-w-[400px] animate-in slide-in-from-top-2 fade-in duration-200">
  <div className="rounded-2xl border border-border/50 bg-card shadow-xl overflow-hidden">
  {/* Header */}
  <div className="flex items-center justify-between px-5 py-4 border-b border-border/20">
  <div className="flex items-center gap-2.5">
  <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center">
  <Bell className="h-4 w-4 text-primary" />
  </div>
  <div>
  <h3 className="text-[13px] font-bold text-foreground">Notificações</h3>
  {unreadCount > 0 && (
  <p className="text-[9px] text-muted-foreground/50">{unreadCount} não lida{unreadCount > 1 ? "s" : ""}</p>
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
  <X className="h-3.5 w-3.5 text-muted-foreground/50" />
  </button>
  </div>
  </div>

  {/* Notification List */}
  <div className="max-h-[70vh] overflow-y-auto">
  {loading ? (
  <div className="py-14 text-center">
  <div className="h-6 w-6 mx-auto border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
  </div>
  ) : notifications.length === 0 ? (
  <div className="py-16 text-center">
  <div className="h-14 w-14 mx-auto rounded-2xl border border-border/20 bg-muted/5 flex items-center justify-center mb-4">
  <Bell className="h-6 w-6 text-muted-foreground/20" />
  </div>
  <p className="text-[12px] font-bold text-muted-foreground/50">Nenhuma notificação</p>
  <p className="text-[10px] text-muted-foreground/30 mt-1">Você será notificado sobre vendas e atualizações</p>
  </div>
  ) : (
  <div>
  {notifications.map((notif, idx) => {
  const config = typeConfig[notif.type] || typeConfig.info;
  const Icon = config.icon;
  const timeAgo = formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: ptBR });
  const fullDate = format(new Date(notif.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const isGlobal = notif.user_id === null;
  const isLast = idx === notifications.length - 1;

  return (
  <button
  key={notif.id}
  onClick={() => !notif.is_read && markAsRead(notif.id)}
  className={cn(
  "w-full text-left px-5 py-3.5 transition-all hover:bg-muted/8 active:scale-[0.995] group relative",
  !notif.is_read && "bg-primary/[0.02]",
  !isLast && "border-b border-border/10"
  )}
  >
  {/* Unread indicator */}
  {!notif.is_read && (
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
  notif.is_read ? "font-medium text-foreground/60" : "font-bold text-foreground"
  )}>
  {notif.title}
  </h4>
  {isGlobal && (
  <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/8 text-primary border border-primary/10 shrink-0">
  Geral
  </span>
  )}
  </div>
  <p className={cn("text-[11px] leading-relaxed mt-1 line-clamp-2", notif.is_read ? "text-muted-foreground/40" : "text-muted-foreground/60")}>
  {notif.message}
  </p>
  <div className="flex items-center gap-1.5 mt-2">
  <Clock className="h-2.5 w-2.5 text-muted-foreground/25" />
  <span className="text-[9px] text-muted-foreground/30" title={fullDate}>
  {timeAgo}
  </span>
  </div>
  </div>
  </div>
  </button>
  );
  })}
  </div>
  )}
  </div>
  </div>
  </div>
  </>
  );
}

// Export a hook for unread count
export function useNotificationCount() {
 const { user } = useAuth();
 const [count, setCount] = useState(0);

 useEffect(() => {
 if (!user) return;
 const load = () => {
 Promise.all([
 supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("is_read", false),
 supabase.from("notifications").select("id", { count: "exact", head: true }).is("user_id", null).eq("is_read", false),
 ]).then(([a, b]) => setCount((a.count || 0) + (b.count || 0)));
 };
 load();
 const channel = supabase
 .channel("notif-count")
 .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, () => load())
 .subscribe();
 return () => { supabase.removeChannel(channel); };
 }, [user]);

 return count;
}
