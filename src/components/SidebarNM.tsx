import { useState, useRef, useCallback, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useThemeMode } from "@/context/ThemeContext";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import logoEuthymia from "@/assets/logo-euthymia.png";

/* ─── Tokens ─── */
const BG = "#EDE6DA";
const raised = "4px 4px 10px rgba(140,118,88,0.5),-4px -4px 10px rgba(255,250,242,0.9)";
const raisedSm = "2px 2px 5px rgba(140,118,88,0.5),-2px -2px 5px rgba(255,250,242,0.9)";
const inset = "inset 2px 2px 5px rgba(140,118,88,0.4),inset -2px -2px 5px rgba(255,250,242,0.85)";
const insetSm = "inset 1px 1px 4px rgba(140,118,88,0.4),inset -1px -1px 4px rgba(255,250,242,0.85)";
const C = {
  text: "#1A1208",
  muted: "#5A5040",
  light: "#8A7060",
  orange: "#7A4518",
  green: "#2A5828",
  border: "rgba(140,118,88,0.12)",
};
const SPACE_DOT_PALETTE = [C.orange, C.green, "#4A6FA5", "#8B5E3C", "#6B4C8A", "#2A7A6E"];
function spaceDotColor(icon: string): string {
  let h = 0;
  for (let i = 0; i < icon.length; i++) h = (h * 31 + icon.charCodeAt(i)) | 0;
  return SPACE_DOT_PALETTE[Math.abs(h) % SPACE_DOT_PALETTE.length];
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 400;
const COLLAPSED_WIDTH = 52;
const DEFAULT_WIDTH = 260;
const LS_KEY = "nm-sidebar-width";

/* ─── Helpers ─── */
function Lbl({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 9,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: 2,
        color: C.light,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  );
}

function NavBtn({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        padding: "7px 10px",
        borderRadius: 10,
        border: "none",
        cursor: "pointer",
        background: BG,
        boxShadow: active ? inset : "none",
        color: active ? C.orange : C.text,
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13,
        fontWeight: active ? 700 : 500,
        transition: "all 0.15s ease",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(122,69,24,0.06)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = BG;
      }}
    >
      {children}
    </button>
  );
}

/* ─── Arrow SVG ─── */
function Arrow() {
  return (
    <svg width="8" height="10" viewBox="0 0 8 10" fill="none" style={{ margin: "0 2px" }}>
      <path d="M1 1L6 5L1 9" stroke={C.light} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* ─── View labels ─── */
const viewLabel: Record<string, string> = {
  dashboard: "☰ Dashboard",
  kanban: "⊞ Kanban",
  list: "☰ Liste",
  calendar: "◫ Calendrier",
  workload: "◈ Charge",
  gantt: "▦ Gantt",
  timeline: "⟶ Timeline",
};

/* ─── Mini sidebar icons ─── */
function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export default function SidebarNM() {
  const {
    spaces,
    projects,
    teamMembers,
    selectedSpaceId,
    selectedProjectId,
    selectedView,
    setSelectedSpaceId,
    setSelectedProjectId,
    setSelectedView,
    setQuickFilter,
    archivedSpaces,
    archivedProjects,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useApp();
  const { teamMemberId } = useAuth();
  const { theme, setTheme, designMode, setDesignMode } = useThemeMode();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [openSpaces, setOpenSpaces] = useState<Set<string>>(new Set());
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(LS_KEY);
    return saved ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Number(saved))) : DEFAULT_WIDTH;
  });
  const isResizing = useRef(false);

  /* ─── Resize handlers ─── */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isResizing.current) return;
      const newW = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startW + (ev.clientX - startX)));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setSidebarWidth((w) => {
        localStorage.setItem(LS_KEY, String(w));
        return w;
      });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [sidebarWidth]);

  /* ─── Current member ─── */
  const member = teamMembers.find((m) => m.id === teamMemberId);
  const initials =
    member?.name
      ?.split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ?? "?";

  /* ─── Breadcrumb ─── */
  const selProject = projects.find((p) => p.id === selectedProjectId);
  const selSpace = selProject
    ? spaces.find((s) => s.id === selProject.spaceId)
    : spaces.find((s) => s.id === selectedSpaceId);

  /* ─── Handlers ─── */
  const closeMobile = () => { if (isMobile) setSidebarCollapsed(true); };

  const goSpace = (spaceId: string) => {
    setSelectedSpaceId(spaceId);
    setSelectedProjectId(null);
    setQuickFilter("all");
    closeMobile();
  };

  const goProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSelectedSpaceId(null);
    setQuickFilter("all");
    closeMobile();
  };

  const goDashboard = () => {
    setSelectedSpaceId(null);
    setSelectedProjectId(null);
    setSelectedView("dashboard");
    setQuickFilter("all");
    closeMobile();
  };

  const toggleSpace = (id: string) => {
    setOpenSpaces((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const archiveCount = (archivedSpaces?.length ?? 0) + (archivedProjects?.length ?? 0);

  // On mobile: hidden when collapsed, overlay when open
  if (isMobile && sidebarCollapsed) return null;

  /* ─── COLLAPSED mini sidebar (desktop only) ─── */
  if (!isMobile && sidebarCollapsed) {
    return (
      <aside
        style={{
          width: COLLAPSED_WIDTH,
          height: "100vh",
          background: BG,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 12,
          gap: 6,
          boxShadow: "4px 0 16px rgba(140,118,88,0.3)",
          flexShrink: 0,
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        {/* Expand button */}
        <button
          onClick={() => setSidebarCollapsed(false)}
          title="Ouvrir la sidebar"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "none",
            background: BG,
            boxShadow: raisedSm,
            cursor: "pointer",
            color: C.muted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Logo */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: BG,
            boxShadow: raisedSm,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            marginBottom: 8,
          }}
        >
          <img src={logoEuthymia} alt="E" style={{ width: 20, height: 20, objectFit: "contain" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>

        {/* Dashboard */}
        <button
          onClick={goDashboard}
          title="Dashboard"
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: "none",
            background: BG,
            boxShadow: selectedView === "dashboard" && !selectedSpaceId && !selectedProjectId ? insetSm : raisedSm,
            color: selectedView === "dashboard" && !selectedSpaceId && !selectedProjectId ? C.orange : C.muted,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <DashboardIcon />
        </button>

        {/* Space dots */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, paddingTop: 8, overflowY: "auto" }}>
          {spaces.map((space) => (
            <button
              key={space.id}
              onClick={() => goSpace(space.id)}
              title={space.name}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "none",
                background: BG,
                boxShadow: selectedSpaceId === space.id ? insetSm : raisedSm,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: (space as any).color ?? C.orange }} />
            </button>
          ))}
        </div>

        {/* Settings */}
        <button
          onClick={() => { navigate("/settings"); }}
          title="Réglages"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "none",
            background: BG,
            boxShadow: raisedSm,
            cursor: "pointer",
            color: C.muted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.2" />
            <path d="M7 1V3M7 11V13M1 7H3M11 7H13M2.5 2.5L4 4M10 10L11.5 11.5M11.5 2.5L10 4M4 10L2.5 11.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </button>
      </aside>
    );
  }

  /* ─── FULL SIDEBAR ─── */
  return (
    <>
      {/* Backdrop overlay on mobile */}
      {isMobile && (
        <div
          onClick={() => setSidebarCollapsed(true)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 49,
            background: "rgba(0,0,0,0.3)",
            backdropFilter: "blur(2px)",
          }}
        />
      )}
      <aside
        style={{
          width: isMobile ? "85vw" : sidebarWidth,
          maxWidth: isMobile ? 320 : undefined,
          height: "100vh",
          background: BG,
          display: "flex",
          flexDirection: "column",
          fontFamily: "'DM Sans', sans-serif",
          color: C.text,
          borderRight: "1px solid rgba(140,118,88,0.2)",
          boxShadow: "4px 0 16px rgba(140,118,88,0.3)",
          overflow: "hidden",
          flexShrink: 0,
          position: "relative",
          ...(isMobile
            ? {
                position: "fixed",
                top: 0,
                left: 0,
                zIndex: 50,
                animation: "slideInLeft 0.25s ease-out",
              }
            : {}),
        }}
      >
        {/* ── LOGO ── */}
        <div style={{ padding: "20px 16px 12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 14,
              background: BG,
              boxShadow: raised,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: BG,
                boxShadow: raisedSm,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
              }}
            >
              <img
                src={logoEuthymia}
                alt="Euthymia"
                style={{ width: 24, height: 24, objectFit: "contain" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, letterSpacing: 0.5 }}>Euthymia</div>
              <div style={{ fontSize: 9, color: C.muted, letterSpacing: 0.5 }}>Gestion de projets</div>
            </div>
            {/* Collapse button on desktop / Close on mobile */}
            <button
              onClick={() => setSidebarCollapsed(true)}
              title={isMobile ? "Fermer" : "Réduire la sidebar"}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "none",
                background: BG,
                boxShadow: raisedSm,
                cursor: "pointer",
                fontSize: 16,
                color: C.muted,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isMobile ? "✕" : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M11 3L6 8L11 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── BREADCRUMB ── */}
        {!isMobile && (selSpace || selProject) && (
          <div style={{ padding: "0 16px 10px" }}>
            <Lbl>Vous êtes ici</Lbl>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 11,
                flexWrap: "wrap",
              }}
            >
              {selSpace && (
                <>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 3,
                      padding: "2px 8px",
                      borderRadius: 6,
                      background: BG,
                      boxShadow: raisedSm,
                      fontWeight: 600,
                      color: C.text,
                      cursor: "pointer",
                    }}
                    onClick={() => goSpace(selSpace.id)}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: (selSpace as any).color ?? C.orange, flexShrink: 0 }} />
                    <span style={{ fontSize: 8, color: C.light }}>Espace</span>
                    {selSpace.name}
                  </span>
                  {selProject && (
                    <>
                      <Arrow />
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: BG,
                          boxShadow: raisedSm,
                          fontWeight: 600,
                          color: C.orange,
                          cursor: "pointer",
                        }}
                        onClick={() => goProject(selProject.id)}
                      >
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 3,
                            background: selProject.color,
                            display: "inline-block",
                          }}
                        />
                        <span style={{ fontSize: 8, color: C.light }}>Projet</span>
                        {selProject.name}
                      </span>
                      <Arrow />
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: BG,
                          boxShadow: insetSm,
                          fontWeight: 500,
                          color: C.muted,
                        }}
                      >
                        <span style={{ fontSize: 8, color: C.light }}>Vue</span>
                        <span style={{ fontWeight: 600 }}>
                          {viewLabel[selectedView] ?? selectedView}
                        </span>
                      </span>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── NAVIGATION ── */}
        <div style={{ padding: "0 16px 10px" }}>
          <Lbl>Navigation</Lbl>

          <NavBtn active={selectedView === "dashboard" && !selectedSpaceId && !selectedProjectId} onClick={goDashboard}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            Dashboard
          </NavBtn>

          {[
            { label: "Toutes les tâches", filter: "all" as const },
            { label: "Urgentes", filter: "urgent" as const },
            { label: "Aujourd'hui", filter: "today" as const },
            { label: "En retard", filter: "overdue" as const },
          ].map(({ label, filter }) => (
            <NavBtn
              key={filter}
              onClick={() => {
                setQuickFilter(filter);
                setSelectedSpaceId(null);
                setSelectedProjectId(null);
                closeMobile();
              }}
            >
              {label}
            </NavBtn>
          ))}
        </div>

        {/* ── ESPACES ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Lbl>Espaces</Lbl>
            <button
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                border: "none",
                background: BG,
                boxShadow: raisedSm,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                color: C.orange,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              +
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {spaces.map((space) => {
              const isOpen = openSpaces.has(space.id);
              const isActive = selectedSpaceId === space.id;
              const spaceProjects = projects.filter((p) => p.spaceId === space.id);

              return (
                <div key={space.id}>
                  <button
                    onClick={() => {
                      goSpace(space.id);
                      toggleSpace(space.id);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      width: "100%",
                      padding: "5px 10px",
                      borderRadius: 7,
                      border: "none",
                      cursor: "pointer",
                      background: BG,
                      boxShadow: isActive ? insetSm : "none",
                      color: isActive ? C.green : C.text,
                      fontFamily: "'DM Sans', sans-serif",
                      fontSize: 10,
                      fontWeight: isActive ? 700 : 500,
                      transition: "all 0.2s ease",
                    }}
                  >
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: (space as any).color ?? C.orange, flexShrink: 0 }} />
                    <span style={{ fontSize: 10, color: isActive ? C.green : C.text, fontWeight: isActive ? 700 : 500, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {space.name}
                    </span>
                    {spaceProjects.length > 0 && (
                      <span style={{ fontSize: 8, color: C.muted }}>{isOpen ? "▴" : "▾"}</span>
                    )}
                  </button>

                  {isOpen && spaceProjects.length > 0 && (
                    <div style={{ marginLeft: 18, marginTop: 3, display: "flex", flexDirection: "column", gap: 2 }}>
                      {spaceProjects.map((proj) => {
                        const isProjActive = selectedProjectId === proj.id;
                        return (
                          <button
                            key={proj.id}
                            onClick={() => goProject(proj.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              width: "100%",
                              padding: "5px 8px",
                              borderRadius: 8,
                              border: "none",
                              cursor: "pointer",
                              background: BG,
                              boxShadow: isProjActive ? insetSm : "none",
                              color: isProjActive ? C.orange : C.muted,
                              fontFamily: "'DM Sans', sans-serif",
                              fontSize: 12,
                              fontWeight: isProjActive ? 600 : 400,
                              transition: "all 0.15s ease",
                            }}
                          >
                            <span
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: 3,
                                background: proj.color,
                                display: "inline-block",
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {proj.name}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Archives */}
          {archiveCount > 0 && (
            <div style={{ marginTop: 10 }}>
              <NavBtn>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="3" width="12" height="9" rx="1.5" stroke={C.light} strokeWidth="1.2" />
                  <path d="M1 3L3 1H11L13 3" stroke={C.light} strokeWidth="1.2" />
                  <line x1="5.5" y1="7" x2="8.5" y2="7" stroke={C.light} strokeWidth="1.2" strokeLinecap="round" />
                </svg>
                Archives
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    color: C.light,
                    background: BG,
                    boxShadow: insetSm,
                    borderRadius: 6,
                    padding: "1px 6px",
                  }}
                >
                  {archiveCount}
                </span>
              </NavBtn>
            </div>
          )}
        </div>

        {/* ── BAS ── */}
        <div
          style={{
            padding: "12px 16px 16px",
            borderTop: `1px solid ${C.border}`,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* Thème clair/sombre */}
          <div>
            <div
              style={{
                display: "flex",
                gap: 4,
                padding: 3,
                borderRadius: 8,
                background: BG,
                boxShadow: inset,
              }}
            >
              {[
                { value: "light", label: "☀ Clair" },
                { value: "dark", label: "☽ Sombre" },
                { value: "mixed", label: "⊙ Mixte" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value as "light" | "dark" | "mixed")}
                  style={{
                    flex: 1,
                    background: theme === value ? BG : "transparent",
                    border: "none",
                    borderRadius: 6,
                    boxShadow: theme === value ? raised : "none",
                    color: theme === value ? C.orange : C.text,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 9,
                    fontWeight: theme === value ? 700 : 500,
                    padding: "4px 0",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Switch Classic / Ivoire */}
          <div>
            <div
              style={{
                display: "flex",
                gap: 4,
                padding: 3,
                borderRadius: 8,
                background: BG,
                boxShadow: inset,
              }}
            >
              {[
                { value: "classic", label: "⊞ Classic" },
                { value: "neumorphic", label: "✦ Ivoire" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDesignMode(value as "classic" | "neumorphic")}
                  style={{
                    flex: 1,
                    background: designMode === value ? BG : "transparent",
                    border: "none",
                    borderRadius: 6,
                    boxShadow: designMode === value ? raised : "none",
                    color: designMode === value ? C.orange : C.text,
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 9,
                    fontWeight: designMode === value ? 700 : 500,
                    padding: "4px 0",
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Profil */}
          {member && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 12,
                background: BG,
                boxShadow: raised,
              }}
            >
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt={member.name}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    objectFit: "cover",
                    boxShadow: raisedSm,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: member.avatarColor,
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    boxShadow: raisedSm,
                  }}
                >
                  {initials}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: C.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {member.name}
                </div>
                <div style={{ fontSize: 10, color: C.muted }}>{member.role}</div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 6 }}>
            {[
              {
                label: "Réglages",
                color: C.text,
                icon: (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M7 1V3M7 11V13M1 7H3M11 7H13M2.5 2.5L4 4M10 10L11.5 11.5M11.5 2.5L10 4M4 10L2.5 11.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
                  </svg>
                ),
                onClick: () => { navigate("/settings"); closeMobile(); },
              },
              {
                label: "App",
                color: C.text,
                icon: (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
                    <path d="M5 6L7 8L9 6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
                onClick: () => {},
              },
              {
                label: "Quitter",
                color: "#7A1E0E",
                icon: (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M5 1H3C2 1 1 2 1 3V11C1 12 2 13 3 13H5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M9 4L13 7L9 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    <line x1="5" y1="7" x2="13" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                ),
                onClick: handleLogout,
              },
            ].map(({ label, color, icon, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  padding: "6px 4px",
                  borderRadius: 8,
                  border: "none",
                  background: BG,
                  boxShadow: raisedSm,
                  cursor: "pointer",
                  color,
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 9,
                  fontWeight: 500,
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── RESIZE HANDLE (desktop only) ── */}
        {!isMobile && (
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 5,
              height: "100%",
              cursor: "col-resize",
              zIndex: 10,
              background: "transparent",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(122,69,24,0.12)"; }}
            onMouseLeave={(e) => { if (!isResizing.current) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          />
        )}
      </aside>

      {/* Animation keyframes injected once */}
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
