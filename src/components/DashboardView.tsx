import React, { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { STATUS_LABELS, PRIORITY_LABELS, Priority } from '@/types';
import { PriorityBadge, StatusBadge } from '@/components/TaskBadges';
import {
  CheckCircle2, Clock, AlertTriangle, TrendingUp, ListTodo, Users,
  CalendarDays, BarChart3,
} from 'lucide-react';
import { format, isToday, isPast, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';
import { motion } from 'framer-motion';

/* ─── Couleurs des graphiques ─── */
const STATUS_COLORS: Record<string, string> = {
  todo: 'hsl(var(--muted-foreground))',
  in_progress: 'hsl(var(--primary))',
  in_review: 'hsl(38, 92%, 50%)',
  done: 'hsl(142, 71%, 45%)',
  blocked: 'hsl(0, 84%, 60%)',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'hsl(0, 84%, 60%)',
  high: 'hsl(25, 95%, 53%)',
  normal: 'hsl(var(--primary))',
  low: 'hsl(var(--muted-foreground))',
};

/* ─── Animation ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06, duration: 0.35 } }),
};

export default function DashboardView() {
  const { tasks, teamMembers, spaces, projects, setSelectedTaskId } = useApp();
  const { teamMemberId } = useAuth();

  // ─── Personal stats ───
  const myTasks = useMemo(() => tasks.filter(t => t.assigneeIds.includes(teamMemberId || '')), [tasks, teamMemberId]);
  const myDone = myTasks.filter(t => t.status === 'done').length;
  const myInProgress = myTasks.filter(t => t.status === 'in_progress').length;
  const myOverdue = myTasks.filter(t => t.dueDate && isPast(parseISO(t.dueDate)) && t.status !== 'done').length;
  const myDueToday = myTasks.filter(t => t.dueDate && isToday(parseISO(t.dueDate)) && t.status !== 'done').length;
  const myCompletion = myTasks.length > 0 ? Math.round((myDone / myTasks.length) * 100) : 0;


  // ═══ DONNÉES CALCULÉES ═══
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
                    onClick={() => onTaskClick?.(task.id)}
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
                  onClick={() => onTaskClick?.(task.id)}
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
