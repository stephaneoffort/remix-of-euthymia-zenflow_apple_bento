import { useState } from "react";

/* ═══════════════════════════════════
   TOKENS NEUMORPHIQUES IVOIRE CHAUD
═══════════════════════════════════ */
const BG = "#EDE6DA";
const SH_D = "rgba(160,140,108,0.45)";
const SH_L = "rgba(255,252,246,0.85)";
const RAISED = `6px 6px 14px ${SH_D}, -6px -6px 14px ${SH_L}`;
const RAISED_SM = `3px 3px 8px ${SH_D}, -3px -3px 8px ${SH_L}`;
const RAISED_XS = `2px 2px 5px ${SH_D}, -2px -2px 5px ${SH_L}`;
const INSET = `inset 4px 4px 10px ${SH_D}, inset -4px -4px 10px ${SH_L}`;
const INSET_SM = `inset 2px 2px 6px ${SH_D}, inset -2px -2px 6px ${SH_L}`;
const INSET_XS = `inset 1px 1px 4px ${SH_D}, inset -1px -1px 4px ${SH_L}`;

const C = {
  accent: "#B87440",
  success: "#6B8F6A",
  danger: "#B85040",
  text: "#2D2820",
  muted: "#8A7E6E",
  faint: "#B0A494",
  serif: "'Cormorant Garamond', Georgia, serif",
  sans: "'DM Sans', system-ui, sans-serif",
};

/* ═══════════════════════════════════
   DONNÉES (remplacer par vos hooks)
═══════════════════════════════════ */
const STATS = {
  total: 50,
  urgent: 4,
  retard: 11,
  terminees: 41,
  espaces: 9,
};

const TEAM = [
  { init: "SO", name: "Stéphane", pct: 35, tasks: 17, color: C.accent },
  { init: "ST", name: "Stéphanie", pct: 32, tasks: 19, color: C.danger },
  { init: "JU", name: "Julien", pct: 8, tasks: 14, color: C.muted },
];

const URGENT = [
  { name: "Événement IMIC", delay: "4j", hot: true },
  { name: "1er contact", delay: "3j", hot: true },
  { name: "Retrouver email philosophe", delay: "2j", hot: false },
  { name: "Écriture", delay: "1j", hot: false },
];

const ECHEANCES = [
  { name: "Contacter les intervenants", delay: "4j retard", ok: false },
  { name: "Stories · Retraite silencieuse", delay: "4j retard", ok: false },
  { name: "Tester paiement formulaire", delay: "5j retard", ok: false },
  { name: "Contact Rinpoche 25/03", delay: "terminée", ok: true },
];

/* ═══════════════════════════════════
   COMPOSANTS INTERNES
═══════════════════════════════════ */
function Tile({
  children,
  inset = false,
  style = {},
  onClick,
}: {
  children: React.ReactNode;
  inset?: boolean;
  style?: React.CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: BG,
        borderRadius: 16,
        boxShadow: inset ? INSET : RAISED,
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        color: C.muted,
        fontSize: 9,
        fontWeight: 500,
        letterSpacing: "1.5px",
        textTransform: "uppercase" as const,
      }}
    >
      {children}
    </div>
  );
}

function Tag({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "danger" | "accent" | "success";
}) {
  const colors = { default: C.muted, danger: C.danger, accent: C.accent, success: C.success };
  return (
    <span
      style={{
        background: BG,
        borderRadius: 4,
        boxShadow: RAISED_XS,
        color: colors[variant],
        display: "inline-block",
        fontSize: 9,
        fontWeight: 500,
        padding: "2px 6px",
      }}
    >
      {children}
    </span>
  );
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <div
      style={{
        alignItems: "center",
        background: BG,
        borderRadius: "50%",
        boxShadow: RAISED_SM,
        color,
        display: "flex",
        flexShrink: 0,
        fontSize: 9,
        fontWeight: 500,
        height: 26,
        justifyContent: "center",
        width: 26,
      }}
    >
      {initials}
    </div>
  );
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div style={{ background: BG, borderRadius: 4, boxShadow: INSET_XS, height: 6, overflow: "hidden" }}>
        <div
          style={{
            background: C.success,
            borderRadius: 4,
            height: "100%",
            width: `${pct}%`,
            transition: "width 0.6s ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.faint, marginTop: 4 }}>
        <span>0</span>
        <span>
          {pct}% · {value}/{max}
        </span>
        <span>{max}</span>
      </div>
    </div>
  );
}

function Ring({ value, max, size = 52 }: { value: number; max: number; size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / max) * circ;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ margin: "8px auto 0", display: "block" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(160,140,108,0.2)" strokeWidth="5" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={C.success}
        strokeWidth="5"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

function Donut({ size = 76 }: { size?: number }) {
  const r = size / 2 - 5;
  const circ = 2 * Math.PI * r;
  const total = 120;
  const segs = [
    { v: STATS.retard, c: C.danger },
    { v: 13, c: C.accent },
    { v: STATS.terminees, c: C.success },
  ];
  let off = 0;
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(160,140,108,0.12)" strokeWidth="8" />
        {segs.map(({ v, c }, i) => {
          const dash = (v / total) * circ;
          const el = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={c}
              strokeWidth="8"
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-off}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
          off += dash;
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
        <div style={{ fontFamily: C.serif, fontSize: 18, fontWeight: 300, color: C.text, lineHeight: 1 }}>{total}</div>
        <div style={{ fontSize: 8, color: C.faint }}>total</div>
      </div>
    </div>
  );
}

function Sparkline() {
  const pts = "0,44 16,38 32,22 48,29 64,11 80,29 96,21 110,34";
  return (
    <svg width="100%" height="52" viewBox="0 0 110 52" preserveAspectRatio="none">
      <path d={`M${pts.replace(/ /g, " L")} L110,52 L0,52 Z`} fill={C.success} fillOpacity="0.1" />
      <polyline
        points={pts}
        fill="none"
        stroke={C.success}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="64" cy="11" r="3" fill={C.success} />
    </svg>
  );
}

/* ═══════════════════════════════════
   DASHBOARD PRINCIPAL
═══════════════════════════════════ */
export default function DashboardView() {
  const total = STATS.total + STATS.terminees;
  const date = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div style={{ fontFamily: C.sans, background: BG, minHeight: "100vh", padding: 20 }}>
      {/* ── GRILLE BENTO ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,7fr) minmax(0,3fr) minmax(0,2fr)", gap: 14 }}>
        {/* HERO */}
        <Tile style={{ padding: "20px 22px" }}>
          <Label>{date}</Label>
          <div
            style={{
              fontFamily: C.serif,
              fontSize: 38,
              fontWeight: 300,
              color: C.text,
              lineHeight: 1.05,
              letterSpacing: "-0.5px",
              marginTop: 6,
            }}
          >
            Bonjour,
            <br />
            Ste<em style={{ fontStyle: "italic", color: C.accent }}>phane</em>
          </div>
          <div style={{ color: C.accent, fontSize: 11, marginTop: 5 }}>
            {STATS.total} tâches · {STATS.espaces} espaces actifs
          </div>
          <div style={{ marginTop: 14 }}>
            <ProgressBar value={STATS.terminees} max={total} />
          </div>
        </Tile>

        {/* TOTAL — inset */}
        <Tile inset style={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div
            style={{
              fontFamily: C.serif,
              fontSize: 46,
              fontWeight: 300,
              color: C.text,
              letterSpacing: "-2px",
              lineHeight: 1,
            }}
          >
            {STATS.total}
          </div>
          <div style={{ fontSize: 9, color: C.faint, marginTop: 3, letterSpacing: "0.5px" }}>tâches en attente</div>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
            {[
              { dot: C.accent, label: "Urgentes", val: STATS.urgent },
              { dot: C.danger, label: "En retard", val: STATS.retard },
              { dot: C.success, label: "Terminées", val: STATS.terminees },
            ].map(({ dot, label, val }) => (
              <div
                key={label}
                style={{
                  background: BG,
                  borderRadius: 10,
                  boxShadow: RAISED_SM,
                  padding: "6px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                }}
              >
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: C.muted, flex: 1 }}>{label}</span>
                <span style={{ fontFamily: C.serif, fontSize: 16, color: C.text }}>{val}</span>
              </div>
            ))}
          </div>
        </Tile>

        {/* PROGRESSION */}
        <Tile
          style={{
            padding: "16px 12px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <Label>Progression</Label>
          <div style={{ fontFamily: C.serif, fontSize: 32, fontWeight: 300, color: C.text, marginTop: 4 }}>
            {Math.round((STATS.terminees / total) * 100)}%
          </div>
          <Ring value={STATS.terminees} max={total} size={52} />
          <div style={{ fontSize: 9, color: C.faint, marginTop: 4 }}>
            {STATS.terminees} / {total}
          </div>
        </Tile>

        {/* URGENTES */}
        <Tile style={{ gridColumn: "1", gridRow: "2" }}>
          <div
            style={{
              padding: "11px 16px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(160,140,108,0.1)",
            }}
          >
            <Label>À traiter</Label>
            <span
              style={{
                background: BG,
                borderRadius: 100,
                boxShadow: RAISED_XS,
                color: C.accent,
                fontSize: 10,
                fontWeight: 500,
                padding: "3px 9px",
              }}
            >
              {STATS.urgent} urgentes
            </span>
          </div>
          {URGENT.map((t, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 16px",
                borderLeft: `2px solid ${t.hot ? C.danger : C.accent}`,
              }}
            >
              <span style={{ fontSize: 11, color: C.text, flex: 1 }}>{t.name}</span>
              <Tag variant="danger">Urgent</Tag>
              <span style={{ fontSize: 10, color: C.danger, fontWeight: 500, whiteSpace: "nowrap" }}>{t.delay}</span>
            </div>
          ))}
        </Tile>

        {/* DONUT */}
        <Tile
          style={{
            gridColumn: "2",
            gridRow: "2",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Label style={{ marginBottom: 8 }}>Répartition</Label>
          <Donut size={76} />
          <div style={{ marginTop: 10, width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { label: "Terminées", val: STATS.terminees, color: C.success },
              { label: "En revue", val: 13, color: C.accent },
              { label: "En retard", val: STATS.retard, color: C.danger },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: C.muted, flex: 1 }}>{label}</span>
                <span style={{ fontSize: 9, color: C.text, fontWeight: 500 }}>{val}</span>
              </div>
            ))}
          </div>
        </Tile>

        {/* ÉQUIPE — inset */}
        <Tile inset style={{ gridColumn: "3", gridRow: "2", padding: "12px 14px" }}>
          <Label style={{ marginBottom: 10 }}>Équipe</Label>
          {TEAM.map((m) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <Avatar initials={m.init} color={m.color} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: C.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.name}
                </div>
                <div style={{ height: 3, background: BG, borderRadius: 2, boxShadow: INSET_XS, marginTop: 4 }}>
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
              <span style={{ fontSize: 9, color: C.faint }}>{m.pct}%</span>
            </div>
          ))}
        </Tile>

        {/* ÉCHÉANCES */}
        <Tile style={{ gridColumn: "1 / 3", gridRow: "3" }}>
          <div
            style={{
              padding: "11px 16px 8px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid rgba(160,140,108,0.1)",
            }}
          >
            <Label>Prochaines échéances</Label>
            <span style={{ fontSize: 10, color: C.accent, cursor: "pointer", fontWeight: 500 }}>Voir tout →</span>
          </div>
          {ECHEANCES.map((e, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                padding: "7px 16px",
                borderBottom: i < ECHEANCES.length - 1 ? "1px solid rgba(160,140,108,0.07)" : "none",
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: e.ok ? C.success : C.danger,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 11, color: C.text, flex: 1 }}>{e.name}</span>
              <span style={{ fontSize: 10, fontWeight: 500, color: e.ok ? C.success : C.danger, whiteSpace: "nowrap" }}>
                {e.delay}
              </span>
            </div>
          ))}
        </Tile>

        {/* ACTIVITÉ — inset */}
        <Tile inset style={{ gridColumn: "3", gridRow: "3", padding: "12px 14px" }}>
          <Label style={{ marginBottom: 8 }}>Activité · 7j</Label>
          <Sparkline />
          <div style={{ fontSize: 9, color: C.muted, marginTop: 5 }}>
            Pic <span style={{ color: C.accent }}>mer 26</span> · <span style={{ color: C.text }}>8 tâches</span>
          </div>
        </Tile>

        {/* INTÉGRATIONS */}
        <div
          style={{
            gridColumn: "1 / 4",
            gridRow: "4",
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0,1fr))",
            gap: 14,
          }}
        >
          {[
            { name: "Zoom", sub: "0 réunions · Connecter" },
            { name: "Drive", sub: "0 fichiers · Connecter" },
            { name: "Canva", sub: "0 designs · Connecter" },
          ].map(({ name, sub }) => (
            <Tile
              key={name}
              style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: BG,
                  boxShadow: RAISED_SM,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 13 }}>{name[0]}</span>
              </div>
              <div>
                <div style={{ fontSize: 11, color: C.text, fontWeight: 500 }}>{name}</div>
                <div style={{ fontSize: 9, color: C.faint, marginTop: 1 }}>{sub}</div>
              </div>
              <span style={{ fontSize: 13, color: C.accent, marginLeft: "auto" }}>→</span>
            </Tile>
          ))}
        </div>
      </div>
    </div>
  );
}
