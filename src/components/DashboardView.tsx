/**
 * EuthymiaDashboard.jsx
 * Dashboard complet — Thème Ivoire Chaud Neumorphique
 * Copier dans : src/pages/Dashboard.jsx  (ou là où se trouve votre page dashboard)
 *
 * Prérequis :
 *   1. src/styles/1_theme-ivoire-chaud.css importé dans index.css ou main.jsx
 *   2. src/components/EuthymiaTheme.jsx présent
 */

import {
  NmApp,
  NmTile,
  NmTileInset,
  NmBtn,
  NmBadge,
  NmTag,
  NmProgress,
  NmAvatar,
  NmDisplay,
  NmStat,
  NmLabel,
  NmDivider,
  nm,
} from "@/components/EuthymiaTheme";

// ─── DONNÉES (à remplacer par vos vraies données) ────────
const STATS = { total: 50, urgent: 4, retard: 11, terminees: 41, espaces: 9, projets: 26, membres: 3 };
const TEAM = [
  { init: "SO", name: "Stéphane", pct: 35, tasks: 17, color: nm.accent },
  { init: "ST", name: "Stéphanie", pct: 32, tasks: 19, color: nm.danger },
  { init: "JU", name: "Julien", pct: 8, tasks: 14, color: nm.textSec },
];
const URGENT_TASKS = [
  { name: "Événement IMIC", tags: ["Urgent", "En cours"], delay: "4j", level: "high" },
  { name: "1er contact", tags: ["Urgent", "En revue"], delay: "3j", level: "high" },
  { name: "Retrouver email philos.", tags: ["Urgent"], delay: "2j", level: "med" },
  { name: "Écriture", tags: ["Urgent"], delay: "1j", level: "med" },
];
const ECHEANCES = [
  { name: "Contacter les intervenants", tags: ["Haute", "En revue"], delay: "4j retard", ok: false },
  { name: "Stories · Retraite silencieuse", tags: ["Haute"], delay: "4j retard", ok: false },
  { name: "Tester paiement formulaire", tags: ["En revue"], delay: "5j retard", ok: false },
  { name: "Contact Rinpoche 25/03", tags: ["Normale"], delay: "terminée", ok: true },
];
const INTEGRATIONS = [
  { name: "Zoom", sub: "0 réunions · Connecter", icon: <ZoomIcon /> },
  { name: "Drive", sub: "0 fichiers · Connecter", icon: <DriveIcon /> },
  { name: "Canva", sub: "0 designs · Connecter", icon: <CanvaIcon /> },
];

// ─── DASHBOARD ───────────────────────────────────────────
export default function EuthymiaDashboard() {
  const progress = Math.round((STATS.terminees / (STATS.total + STATS.terminees)) * 100);

  return (
    <NmApp>
      <div style={{ padding: 20 }}>
        <div className="nm-bento">
          {/* ── HERO ── */}
          <NmTile className="nm-bento__hero nm-p-lg">
            <NmLabel style={{ marginBottom: 6 }}>
              {new Date().toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </NmLabel>
            <NmDisplay size="lg">
              Bonjour,
              <br />
              Ste<em style={{ color: nm.accent }}>phane</em>
            </NmDisplay>
            <div style={{ color: nm.accent, fontSize: 11, marginTop: 5 }}>
              {STATS.total} tâches · {STATS.espaces} espaces actifs
            </div>
            <div style={{ marginTop: 14 }}>
              <NmProgress value={STATS.terminees} max={STATS.total + STATS.terminees} />
            </div>
          </NmTile>

          {/* ── TOTAL — inset ── */}
          <NmTileInset
            className="nm-bento__total nm-p-md"
            style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}
          >
            <NmStat value={STATS.total} label="tâches en attente" />
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
              {[
                { dot: nm.accent, label: "Urgentes", val: STATS.urgent },
                { dot: nm.danger, label: "En retard", val: STATS.retard },
                { dot: nm.success, label: "Terminées", val: STATS.terminees },
              ].map(({ dot, label, val }) => (
                <div
                  key={label}
                  style={{
                    background: nm.bg,
                    borderRadius: 10,
                    boxShadow: nm.raisedSm,
                    padding: "6px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: nm.textSec, flex: 1 }}>{label}</span>
                  <span style={{ fontFamily: nm.fontDisplay, fontSize: 16, color: nm.textPri }}>{val}</span>
                </div>
              ))}
            </div>
          </NmTileInset>

          {/* ── PROGRESSION ── */}
          <NmTile
            className="nm-bento__pct nm-p-md"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
            }}
          >
            <NmLabel style={{ marginBottom: 6 }}>Progression</NmLabel>
            <div style={{ fontFamily: nm.fontDisplay, fontSize: 32, fontWeight: 300, color: nm.textPri }}>
              {progress}%
            </div>
            <ProgressRing value={progress} color={nm.success} size={52} />
            <div style={{ fontSize: 9, color: nm.textMuted, marginTop: 4 }}>
              {STATS.terminees} / {STATS.total + STATS.terminees}
            </div>
          </NmTile>

          {/* ── URGENTES ── */}
          <NmTile className="nm-bento__urgent">
            <div
              style={{
                padding: "11px 16px 8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <NmLabel>À traiter</NmLabel>
              <NmBadge variant="accent">{STATS.urgent} urgentes</NmBadge>
            </div>
            <NmDivider />
            {URGENT_TASKS.map((t, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 16px",
                  borderLeft: `2px solid ${t.level === "high" ? nm.danger : nm.accent}`,
                }}
              >
                <span style={{ fontSize: 11, color: nm.textPri, flex: 1 }}>{t.name}</span>
                <div style={{ display: "flex", gap: 3 }}>
                  {t.tags.map((tag) => (
                    <NmTag key={tag} variant={tag === "Urgent" ? "danger" : tag === "En revue" ? "accent" : "default"}>
                      {tag}
                    </NmTag>
                  ))}
                </div>
                <span style={{ fontSize: 10, color: nm.danger, fontWeight: 500, whiteSpace: "nowrap" }}>{t.delay}</span>
              </div>
            ))}
          </NmTile>

          {/* ── DONUT ── */}
          <NmTile
            className="nm-bento__donut nm-p-md"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}
          >
            <NmLabel style={{ marginBottom: 8 }}>Répartition</NmLabel>
            <DonutChart
              segments={[
                { value: STATS.retard, color: nm.danger },
                { value: 13, color: nm.accent },
                { value: STATS.terminees, color: nm.success },
              ]}
              total={120}
              size={76}
            />
            <div style={{ marginTop: 10, width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
              {[
                { label: "Terminées", val: STATS.terminees, color: nm.success },
                { label: "En revue", val: 13, color: nm.accent },
                { label: "En retard", val: STATS.retard, color: nm.danger },
              ].map(({ label, val, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 9, color: nm.textSec, flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 9, color: nm.textPri, fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>
          </NmTile>

          {/* ── ÉQUIPE — inset ── */}
          <NmTileInset className="nm-bento__equipe nm-p-sm">
            <NmLabel style={{ marginBottom: 10 }}>Équipe</NmLabel>
            {TEAM.map((m) => (
              <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                <NmAvatar initials={m.init} color={m.color} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 10,
                      color: nm.textPri,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {m.name}
                  </div>
                  <div style={{ height: 3, background: nm.bg, borderRadius: 2, boxShadow: nm.insetXs, marginTop: 4 }}>
                    <div
                      style={{
                        height: 3,
                        borderRadius: 2,
                        background: m.color,
                        width: `${m.pct}%`,
                        transition: "width 0.5s ease",
                      }}
                    />
                  </div>
                </div>
                <span style={{ fontSize: 9, color: nm.textMuted, marginLeft: 4 }}>{m.pct}%</span>
              </div>
            ))}
          </NmTileInset>

          {/* ── ÉCHÉANCES ── */}
          <NmTile className="nm-bento__ech">
            <div
              style={{
                padding: "11px 16px 8px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <NmLabel>Prochaines échéances</NmLabel>
              <span style={{ fontSize: 10, color: nm.accent, cursor: "pointer", fontWeight: 500 }}>Voir tout →</span>
            </div>
            <NmDivider />
            {ECHEANCES.map((e, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "7px 16px",
                  borderBottom: i < ECHEANCES.length - 1 ? "1px solid rgba(160,140,108,0.08)" : "none",
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: e.ok ? nm.success : nm.danger,
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 11, color: nm.textPri, flex: 1 }}>{e.name}</span>
                <div style={{ display: "flex", gap: 3 }}>
                  {e.tags.map((tag) => (
                    <NmTag key={tag} variant={tag === "Haute" ? "danger" : "default"}>
                      {tag}
                    </NmTag>
                  ))}
                </div>
                <span
                  style={{ fontSize: 10, fontWeight: 500, color: e.ok ? nm.success : nm.danger, whiteSpace: "nowrap" }}
                >
                  {e.delay}
                </span>
              </div>
            ))}
          </NmTile>

          {/* ── ACTIVITÉ — inset ── */}
          <NmTileInset className="nm-bento__act nm-p-sm">
            <NmLabel style={{ marginBottom: 8 }}>Activité · 7j</NmLabel>
            <ActivitySparkline color={nm.success} />
            <div style={{ fontSize: 9, color: nm.textSec, marginTop: 5 }}>
              Pic <span style={{ color: nm.accent }}>mer 26</span> · <span style={{ color: nm.textPri }}>8 tâches</span>
            </div>
          </NmTileInset>

          {/* ── INTÉGRATIONS ── */}
          <div className="nm-bento__integr">
            {INTEGRATIONS.map(({ name, sub, icon }) => (
              <NmTile
                key={name}
                style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: nm.bg,
                    boxShadow: nm.raisedSm,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {icon}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: nm.textPri, fontWeight: 500 }}>{name}</div>
                  <div style={{ fontSize: 9, color: nm.textMuted, marginTop: 1 }}>{sub}</div>
                </div>
                <span style={{ fontSize: 13, color: nm.accent, marginLeft: "auto" }}>→</span>
              </NmTile>
            ))}
          </div>
        </div>
      </div>
    </NmApp>
  );
}

// ─── SOUS-COMPOSANTS ─────────────────────────────────────

function ProgressRing({ value = 0, color = nm.success, size = 52 }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ margin: "10px auto 0" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(160,140,108,0.2)" strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

function DonutChart({ segments = [], total = 100, size = 76 }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(160,140,108,0.12)" strokeWidth="8" />
        {segments.map(({ value, color }, i) => {
          const dash = (value / total) * circ;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          offset += dash;
          return el;
        })}
      </svg>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: nm.fontDisplay, fontSize: 18, fontWeight: 300, color: nm.textPri, lineHeight: 1 }}>
          {total}
        </div>
        <div style={{ fontSize: 8, color: nm.textMuted }}>total</div>
      </div>
    </div>
  );
}

function ActivitySparkline({ color = nm.success }) {
  const points = "0,44 16,38 32,22 48,29 64,11 80,29 96,21 110,34";
  const area = `${points} 110,54 0,54`;
  return (
    <svg width="100%" height="54" viewBox="0 0 110 54" preserveAspectRatio="none">
      <polygon points={area} fill={color} fillOpacity="0.1" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="64" cy="11" r="3" fill={color} />
    </svg>
  );
}

// ─── ICÔNES SVG ──────────────────────────────────────────
function ZoomIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <rect x="1" y="3" width="8" height="8" rx="2" fill="#2D8CFF" />
      <path d="M9 6l4-2v6l-4-2V6Z" fill="#2D8CFF" />
    </svg>
  );
}
function DriveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M1 11l3-5.5 3 5.5H1Z" fill="#4285F4" />
      <path d="M7 11l3-5.5L13 11H7Z" fill="#0F9D58" />
      <path d="M4.5 5.5l2.5-4 2.5 4H4.5Z" fill="#FBBC05" />
    </svg>
  );
}
function CanvaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <circle cx="7" cy="7" r="5" fill="#7D2AE7" opacity="0.2" />
      <circle cx="7" cy="7" r="3.5" fill="#7D2AE7" />
      <circle cx="7" cy="3.5" r="1.8" fill="#00C4CC" />
    </svg>
  );
}
