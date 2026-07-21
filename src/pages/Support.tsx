import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useApp } from "@/context/AppContext";
import { useThemeMode } from "@/context/ThemeContext";
import AppSidebar from "@/components/AppSidebar";
import SidebarNM from "@/components/SidebarNM";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft,
  LifeBuoy,
  MessageSquarePlus,
  Send,
  ShieldAlert,
  Sparkles,
  Loader2,
  PanelLeft,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

type Conversation = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  escalated: boolean;
  last_message_at: string;
  user_id: string;
};

type Message = {
  id: string;
  role: "user" | "assistant" | "admin" | "system";
  content: string;
  created_at: string;
  metadata: Record<string, any>;
};

const db = supabase as any;

const priorityColor: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-primary/15 text-primary",
  high: "bg-orange-500/15 text-orange-500",
  urgent: "bg-red-500/15 text-red-500",
};

export default function Support() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    if (!user) return;
    supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [user?.id]);
  const { sidebarCollapsed, setSidebarCollapsed } = useApp();
  const { designMode } = useThemeMode();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showList, setShowList] = useState(!isMobile);
  const [viewMode, setViewMode] = useState<"mine" | "admin">("mine");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAdminView = isAdmin && viewMode === "admin";

  // Load conversations
  const loadConversations = async () => {
    if (!user) return;
    const query = db
      .from("support_conversations")
      .select("*")
      .order("last_message_at", { ascending: false });

    const filter = isAdminView ? query.eq("escalated", true) : query.eq("user_id", user.id);
    const { data, error } = await filter;
    if (error) {
      console.error(error);
      return;
    }
    setConversations(data || []);
    if (!activeId && data && data.length > 0) setActiveId(data[0].id);
  };

  useEffect(() => {
    loadConversations();
    const ch = supabase
      .channel("support-conversations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "support_conversations" },
        () => loadConversations(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, viewMode]);

  // Load messages for active conversation
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    const load = async () => {
      const { data } = await db
        .from("support_messages")
        .select("*")
        .eq("conversation_id", activeId)
        .order("created_at", { ascending: true });
      setMessages(data || []);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }), 50);
    };
    load();
    const ch = supabase
      .channel(`support-messages-${activeId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "support_messages", filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === (payload.new as any).id)) return prev;
            return [...prev, payload.new as Message];
          });
          setTimeout(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }), 50);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [activeId]);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId],
  );

  const createConversation = async () => {
    if (!user) return;
    const { data, error } = await db
      .from("support_conversations")
      .insert({ user_id: user.id, subject: "Nouvelle demande" })
      .select()
      .single();
    if (error) {
      toast.error("Impossible de créer la conversation");
      return;
    }
    // seed with system greeting
    await db.from("support_messages").insert({
      conversation_id: data.id,
      role: "assistant",
      content:
        "Bonjour 👋 Je suis l'assistant support d'Euthymia ZenFlow. Décris-moi le problème que tu rencontres (page concernée, message d'erreur, appareil…). Si nécessaire je préviendrai Stéphane, le concepteur.",
    });
    await loadConversations();
    setActiveId(data.id);
    if (isMobile) setShowList(false);
  };

  const deleteConversation = async (id: string) => {
    if (!confirm("Supprimer cette conversation ?")) return;
    await db.from("support_conversations").delete().eq("id", id);
    setActiveId(null);
    loadConversations();
  };

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !activeId || sending) return;
    setSending(true);
    setInput("");

    // Admin mode: post admin reply directly
    if (isAdminView && activeConversation && activeConversation.user_id !== user!.id) {
      const { error } = await db.from("support_messages").insert({
        conversation_id: activeId,
        role: "admin",
        content,
        author_id: user!.id,
      });
      if (error) toast.error("Envoi impossible");
      setSending(false);
      return;
    }

    // User mode: optimistic + call AI edge function
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content,
        created_at: new Date().toISOString(),
        metadata: {},
      },
    ]);
    try {
      const { data, error } = await supabase.functions.invoke("support-chat", {
        body: { conversationId: activeId, message: content },
      });
      if (error) throw error;
      if (data?.escalated) {
        toast.success("Ta demande a été transmise à Stéphane.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "L'assistant est momentanément indisponible.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={`flex h-[100dvh] relative overflow-hidden ${designMode === "neumorphic" ? "nm-chat" : ""}`}>
      {!isMobile && !sidebarCollapsed && (designMode === "neumorphic" ? <SidebarNM /> : <AppSidebar />)}
      {!isMobile && sidebarCollapsed && (
        <button
          onClick={() => setSidebarCollapsed(false)}
          className="absolute top-3 left-3 z-50 p-1.5 rounded-md bg-card/80 backdrop-blur-md border border-border hover:bg-muted"
        >
          <PanelLeft className="w-5 h-5" />
        </button>
      )}

      <div className="flex-1 flex h-full min-w-0">
        {/* Conversations list */}
        <AnimatePresence>
          {(!isMobile || showList) && (
            <motion.aside
              initial={isMobile ? { x: "-100%" } : { opacity: 0 }}
              animate={isMobile ? { x: 0 } : { opacity: 1 }}
              exit={isMobile ? { x: "-100%" } : { opacity: 0 }}
              className={`${isMobile ? "fixed inset-y-0 left-0 z-40 w-[85vw] max-w-[320px] bg-background" : "w-72 shrink-0"} border-r border-border/40 flex flex-col`}
            >
              <div className="h-14 px-3 flex items-center gap-2 border-b border-border/40">
                <LifeBuoy className="w-5 h-5 text-primary" />
                <h2 className="font-semibold text-sm flex-1">Support</h2>
                {isAdmin && (
                  <Button
                    variant={viewMode === "admin" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setViewMode(viewMode === "admin" ? "mine" : "admin")}
                  >
                    {viewMode === "admin" ? "Vue admin" : "Admin"}
                  </Button>
                )}
              </div>
              <div className="p-2">
                <Button size="sm" variant="outline" className="w-full gap-2" onClick={createConversation}>
                  <MessageSquarePlus className="w-4 h-4" /> Nouveau signalement
                </Button>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {conversations.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-8 px-4">
                      {isAdminView
                        ? "Aucune conversation escaladée pour l'instant."
                        : "Aucune conversation. Clique sur « Nouveau signalement » pour démarrer."}
                    </p>
                  )}
                  {conversations.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        setActiveId(c.id);
                        if (isMobile) setShowList(false);
                      }}
                      className={`w-full group flex items-start gap-2 p-2 rounded-lg text-left transition-colors ${
                        activeId === c.id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium truncate">{c.subject}</p>
                          {c.escalated && <ShieldAlert className="w-3.5 h-3.5 text-orange-500 shrink-0" />}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {formatDistanceToNow(new Date(c.last_message_at), { locale: fr, addSuffix: true })}
                          </span>
                          {c.escalated && (
                            <Badge variant="secondary" className={`text-[9px] h-4 px-1.5 ${priorityColor[c.priority] ?? ""}`}>
                              {c.priority}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {(c.user_id === user?.id || isAdmin) && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(c.id);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-destructive transition-opacity cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Chat main */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="h-14 px-3 flex items-center gap-2 border-b border-border/40 shrink-0">
            {isMobile ? (
              <button
                onClick={() => setShowList(true)}
                className="p-1.5 rounded-md hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => navigate("/")} className="p-1.5 rounded-md hover:bg-muted" title="Retour">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-semibold truncate">
                {activeConversation?.subject || "Support & bugs"}
              </h1>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Assistant IA — escalade automatique à Stéphane
              </p>
            </div>
            {activeConversation?.escalated && (
              <Badge variant="outline" className="gap-1">
                <ShieldAlert className="w-3 h-3" /> Escaladé
              </Badge>
            )}
          </div>

          {!activeConversation ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center">
              <div className="max-w-sm space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <LifeBuoy className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-lg font-semibold">Signaler un bug ou poser une question</h2>
                <p className="text-sm text-muted-foreground">
                  Discute avec l'assistant IA. Si nécessaire, il transmettra le problème à Stéphane, le concepteur de l'application.
                </p>
                <Button onClick={createConversation} className="gap-2">
                  <MessageSquarePlus className="w-4 h-4" /> Démarrer une conversation
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <MessageBubble key={m.id} message={m} isMine={m.role === "user" && !isAdminView} />
                ))}
                {sending && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> L'assistant réfléchit…
                  </div>
                )}
              </div>

              <div className="border-t border-border/40 p-3 shrink-0">
                <div className="flex gap-2 items-end">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={
                      isAdminView
                        ? "Réponse admin à l'utilisateur…"
                        : "Décris ton problème (page, message d'erreur…)"
                    }
                    rows={2}
                    className="resize-none"
                    disabled={sending}
                  />
                  <Button onClick={sendMessage} disabled={!input.trim() || sending} size="icon">
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, isMine }: { message: Message; isMine: boolean }) {
  const isAdmin = message.role === "admin";
  const isAssistant = message.role === "assistant";
  const escalated = !!message.metadata?.escalated;

  return (
    <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isMine
            ? "bg-primary text-primary-foreground"
            : isAdmin
            ? "bg-orange-500/10 border border-orange-500/30 text-foreground"
            : "bg-muted/60 text-foreground"
        }`}
      >
        <div className="flex items-center gap-1.5 mb-1 text-[10px] uppercase tracking-wide opacity-70">
          {isMine ? "Toi" : isAdmin ? "Stéphane (admin)" : isAssistant ? "Assistant IA" : "Système"}
          {escalated && <ShieldAlert className="w-3 h-3 text-orange-500" />}
        </div>
        <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1 prose-headings:my-1">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
