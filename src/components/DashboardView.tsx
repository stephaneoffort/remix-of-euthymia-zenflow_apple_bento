import React, { useMemo, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { STATUS_LABELS, PRIORITY_LABELS, Priority } from '@/types';
import { PriorityBadge, StatusBadge } from '@/components/TaskBadges';
import {
  CheckCircle2, Clock, AlertTriangle, TrendingUp, ListTodo, Users,
  CalendarDays, BarChart3, Flame, ChevronDown, ChevronUp,
} from 'lucide-react';
import { format, isToday, isPast, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { motion } from 'framer-motion';

/* ─── Couleurs des graphiques (utilise les tokens CSS pour s'adapter aux thèmes) ─── */
function getChartColors() {
  const root = getComputedStyle(document.documentElement);
  const hsl = (v: string, fallback: string) => {
    const val = root.getPropertyValue(v).trim();
    return val ? `hsl(${val})` : fallback;
  };
  return {
    status: {
      todo: hsl('--status-todo', 'hsl(var(--muted-foreground))'),
      in_progress: hsl('--status-progress', 'hsl(var(--primary))'),
      in_review: hsl('--status-review', 'hsl(38, 92%, 50%)'),
      done: hsl('--status-done', 'hsl(142, 71%, 45%)'),
      blocked: hsl('--status-blocked', 'hsl(0, 84%, 60%)'),
    } as Record<string, string>,
    priority: {
      urgent: hsl('--priority-urgent', 'hsl(0, 84%, 60%)'),
      high: hsl('--priority-high', 'hsl(25, 95%, 53%)'),
      normal: hsl('--priority-normal', 'hsl(var(--primary))'),
      low: hsl('--priority-low', 'hsl(var(--muted-foreground))'),
    } as Record<string, string>,
  };
}

/* ─── Animation ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } }),
};

/* ─── My Tasks foldable card ─── */
function MyTasksCard({ tasks, onTaskClick }: { tasks: ReturnType<typeof Array<any>>; onTaskClick: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const COLLAPSED_COUNT = 4;
  const visibleTasks = expanded ? tasks : tasks.slice(0, COLLAPSED_COUNT);
  const hasMore = tasks.length > COLLAPSED_COUNT;

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50 shadow-lg overflow-hidden">
      <CardHeader className="pb-3 pt-4 px-5">
        <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2.5 tracking-wide uppercase">
          <div className="p-1.5 rounded-md bg-destructive/10">
            <Flame className="w-3.5 h-3.5 text-destructive" />
          </div>
          À traiter
          <span className="ml-auto text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <div className="space-y-px">
          {visibleTasks.map((task: any, index: number) => {
            const daysLeft = task.dueDate ? differenceInDays(parseISO(task.dueDate), new Date()) : null;
            const isOverdue = daysLeft !== null && daysLeft < 0;
            return (
              <motion.button
                key={task.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04, duration: 0.25 }}
                onClick={() => onTaskClick(task.id)}
                className="w-full text-left py-2.5 px-3 hover:bg-primary/5 transition-all duration-200 flex items-center gap-2.5 rounded-lg group"
              >
                <div className="w-1 h-6 rounded-full shrink-0 opacity-60 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: isOverdue ? 'hsl(0 84% 60%)' : 'hsl(var(--primary))' }}
                />
                <p className="text-sm text-foreground truncate min-w-0 flex-1 font-medium">{task.title}</p>
                <PriorityBadge priority={task.priority} />
                <StatusBadge status={task.status} />
                {daysLeft !== null ? (
                  <span className={`text-[11px] font-semibold shrink-0 tabular-nums ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {isOverdue ? `−${Math.abs(daysLeft)}j` : daysLeft === 0 ? "Auj." : `${daysLeft}j`}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground/40 shrink-0">—</span>
                )}
              </motion.button>
            );
          })}
        </div>
        {hasMore && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-1.5 py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-primary/70 hover:text-primary transition-colors rounded-lg hover:bg-primary/5"
          >
            {expanded ? (
              <>Réduire <ChevronUp className="w-3.5 h-3.5" /></>
            ) : (
              <>+{tasks.length - COLLAPSED_COUNT} autres <ChevronDown className="w-3.5 h-3.5" /></>
            )}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardView() {
  const { tasks, teamMembers, spaces, projects, setSelectedTaskId } = useApp();
  const { teamMemberId } = useAuth();

  // ─── Current member name ───
  const currentMember = useMemo(
    () => teamMembers.find(m => m.id === teamMemberId),
    [teamMembers, teamMemberId]
  );
  const firstName = currentMember?.name?.split(' ')[0] || 'là';

  // ─── Greeting ───
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }, []);

  // ─── My pending tasks (sorted by urgency then due date) ───
  const myPendingTasks = useMemo(() => {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    return tasks
      .filter(t => t.assigneeIds.includes(teamMemberId || '') && t.status !== 'done')
      .sort((a, b) => {
        const aOverdue = a.dueDate && isPast(parseISO(a.dueDate)) ? 0 : 1;
        const bOverdue = b.dueDate && isPast(parseISO(b.dueDate)) ? 0 : 1;
        if (aOverdue !== bOverdue) return aOverdue - bOverdue;
        const aPrio = priorityOrder[a.priority] ?? 2;
        const bPrio = priorityOrder[b.priority] ?? 2;
        if (aPrio !== bPrio) return aPrio - bPrio;
        if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      });
  }, [tasks, teamMemberId]);


  const totalTasks = tasks.length;
  const globalDone = tasks.filter(t => t.status === 'done').length;
  const globalOverdue = tasks.filter(t => t.dueDate && isPast(parseISO(t.dueDate)) && t.status !== 'done').length;
  const globalCompletion = totalTasks > 0 ? Math.round((globalDone / totalTasks) * 100) : 0;

  // Status distribution (PieChart)
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({
      name: STATUS_LABELS[key] || key,
      value,
      color: STATUS_COLORS[key] || 'hsl(var(--muted-foreground))',
    }));
  }, [tasks]);

  // Priority distribution (PieChart)
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => { counts[t.priority] = (counts[t.priority] || 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({
      name: PRIORITY_LABELS[key as Priority] || key,
      value,
      color: PRIORITY_COLORS[key] || 'hsl(var(--muted-foreground))',
    }));
  }, [tasks]);

  // Team workload
  const teamWorkload = useMemo(() =>
    teamMembers.map(m => {
      const memberTasks = tasks.filter(t => t.assigneeIds.includes(m.id));
      const done = memberTasks.filter(t => t.status === 'done').length;
      return {
        name: m.name.split(' ')[0],
        total: memberTasks.length,
        done,
        inProgress: memberTasks.filter(t => t.status === 'in_progress').length,
        completion: memberTasks.length > 0 ? Math.round((done / memberTasks.length) * 100) : 0,
        color: m.avatarColor,
      };
    }).sort((a, b) => b.total - a.total),
    [tasks, teamMembers]
  );

  // Activity trend (7 derniers jours)
  const activityTrend = useMemo(() => {
    const days: { date: string; created: number; completed: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = format(d, 'yyyy-MM-dd');
      const label = format(d, 'EEE', { locale: fr });
      days.push({
        date: label,
        created: tasks.filter(t => t.createdAt?.startsWith(dateStr)).length,
        completed: tasks.filter(t => t.status === 'done' && t.createdAt?.startsWith(dateStr)).length,
      });
    }
    return days;
  }, [tasks]);

  // Upcoming deadlines (5 prochaines)
  const upcomingTasks = useMemo(() =>
    tasks
      .filter(t => t.dueDate && t.status !== 'done')
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5),
    [tasks]
  );

  // Recently completed
  const recentlyDone = useMemo(() =>
    tasks
      .filter(t => t.status === 'done')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5),
    [tasks]
  );

  // ═══ RENDU ═══
  return (
    <div className="p-4 sm:p-6 space-y-8 max-w-7xl mx-auto">

      {/* ═══ GREETING + MY TASKS ═══ */}
      <section>
        <div className="mb-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {greeting}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 font-medium">
            {myPendingTasks.length === 0
              ? 'Aucune tâche en attente — profite de ta journée !'
              : `${myPendingTasks.length} tâche${myPendingTasks.length > 1 ? 's' : ''} en attente`
            }
          </p>
        </div>

        {myPendingTasks.length > 0 && <MyTasksCard tasks={myPendingTasks} onTaskClick={setSelectedTaskId} />}
      </section>

      {/* ═══ SECTION 1 : VUE D'ENSEMBLE ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Vue d'ensemble</h2>
        </div>

        {/* 4 KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total tâches', value: totalTasks, icon: <ListTodo className="w-4 h-4 text-primary" /> },
            { label: 'Espaces', value: spaces.length, icon: <BarChart3 className="w-4 h-4 text-primary" /> },
            { label: 'Projets', value: projects.length, icon: <TrendingUp className="w-4 h-4 text-primary" /> },
            { label: 'Membres', value: teamMembers.length, icon: <Users className="w-4 h-4 text-primary" /> },
          ].map((stat, i) => (
            <motion.div key={stat.label} custom={i} variants={fadeUp} initial="hidden" animate="show">
              <Card className="bg-card border-border">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">{stat.icon}</div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* PieCharts : Statut + Priorité */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Status pie */}
          <motion.div custom={4} variants={fadeUp} initial="hidden" animate="show">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Répartition par statut</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                        {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {statusData.map(s => (
                    <span key={s.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      {s.name}: {s.value}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Priority pie */}
          <motion.div custom={5} variants={fadeUp} initial="hidden" animate="show">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Répartition par priorité</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={priorityData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}>
                        {priorityData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {priorityData.map(p => (
                    <span key={p.name} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                      {p.name}: {p.value}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Global progress bar */}
        <motion.div custom={6} variants={fadeUp} initial="hidden" animate="show">
          <Card className="bg-card border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Progression globale</span>
                <span className="text-sm text-muted-foreground">{globalCompletion}% · {globalDone}/{totalTasks}</span>
              </div>
              <Progress value={globalCompletion} className="h-2" />
              {globalOverdue > 0 && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-destructive">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {globalOverdue} tâche{globalOverdue > 1 ? 's' : ''} en retard
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </section>

      {/* ═══ SECTION 2 : ANALYTIQUES ═══ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Analytiques</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Activity trend area chart */}
          <motion.div custom={7} variants={fadeUp} initial="hidden" animate="show">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Activité (7 derniers jours)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={activityTrend}>
                      <defs>
                        <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="created" stroke="hsl(var(--primary))" fill="url(#gradCreated)" name="Créées" />
                      <Area type="monotone" dataKey="completed" stroke="hsl(142, 71%, 45%)" fill="hsl(142, 71%, 45%)" fillOpacity={0.15} name="Terminées" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Team workload bar chart */}
          <motion.div custom={8} variants={fadeUp} initial="hidden" animate="show">
            <Card className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-foreground">Charge de l'équipe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={teamWorkload}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip />
                      <Bar dataKey="done" stackId="a" fill="hsl(142, 71%, 45%)" name="Terminées" radius={[0, 0, 0, 0]} />
                      <Bar dataKey="inProgress" stackId="a" fill="hsl(var(--primary))" name="En cours" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Team member cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {teamWorkload.map((m, i) => (
            <motion.div key={m.name} custom={9 + i} variants={fadeUp} initial="hidden" animate="show">
              <Card className="bg-card border-border">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.total} tâche{m.total !== 1 ? 's' : ''}</p>
                    </div>
                    <span className="text-xs font-semibold text-primary ml-auto">{m.completion}%</span>
                  </div>
                  <Progress value={m.completion} className="h-1.5" />
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ═══ SECTION 3 : PROCHAINES ÉCHÉANCES ═══ */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Upcoming deadlines */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              Prochaines échéances
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {upcomingTasks.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucune échéance à venir</p>
              )}
              {upcomingTasks.map(task => {
                const daysLeft = differenceInDays(parseISO(task.dueDate!), new Date());
                const isOverdue = daysLeft < 0;
                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTaskId(task.id)}
                    className="w-full text-left py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3 px-1 rounded-md"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <PriorityBadge priority={task.priority} />
                        <StatusBadge status={task.status} />
                      </div>
                    </div>
                    <span className={`text-xs font-medium shrink-0 ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {isOverdue ? `${Math.abs(daysLeft)}j retard` : daysLeft === 0 ? "Aujourd'hui" : `${daysLeft}j`}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recently completed */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Récemment terminées
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentlyDone.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Aucune tâche terminée</p>
              )}
              {recentlyDone.map(task => (
                <button
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className="w-full text-left py-2.5 hover:bg-muted/50 transition-colors flex items-center gap-3 px-1 rounded-md"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground truncate">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <PriorityBadge priority={task.priority} />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(parseISO(task.createdAt), 'd MMM', { locale: fr })}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
