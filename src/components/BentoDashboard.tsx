import React from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2, Clock, AlertTriangle, TrendingUp,
  Users, CalendarDays, ListTodo, Flame,
} from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, isToday, isPast, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function BentoDashboard() {
  const { tasks, projects, spaces, teamMembers } = useApp();
  const isMobile = useIsMobile();

  // Stats
  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const todo = tasks.filter(t => t.status === 'todo').length;
  const blocked = tasks.filter(t => t.status === 'blocked').length;
  const urgent = tasks.filter(t => t.priority === 'urgent' && t.status !== 'done').length;
  const overdue = tasks.filter(t => t.dueDate && isPast(parseISO(t.dueDate)) && t.status !== 'done').length;
  const todayTasks = tasks.filter(t => t.dueDate && isToday(parseISO(t.dueDate)));
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  // Recent tasks
  const recentTasks = [...tasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Project progress
  const projectStats = projects.map(p => {
    const projectTasks = tasks.filter(t => {
      // tasks belong to lists, lists belong to projects
      return true; // simplified — show all
    });
    const pDone = projectTasks.filter(t => t.status === 'done').length;
    const pTotal = projectTasks.length;
    return { ...p, done: pDone, total: pTotal, rate: pTotal > 0 ? Math.round((pDone / pTotal) * 100) : 0 };
  });

  // Workload per member
  const memberWorkload = teamMembers.slice(0, 6).map(m => {
    const assigned = tasks.filter(t => t.assigneeIds.includes(m.id) && t.status !== 'done').length;
    return { ...m, assigned };
  });

  const statCards = [
    { label: 'Total', value: total, icon: ListTodo, color: 'text-primary' },
    { label: 'Terminées', value: done, icon: CheckCircle2, color: 'text-emerald-400' },
    { label: 'En cours', value: inProgress, icon: Clock, color: 'text-sky-400' },
    { label: 'Urgentes', value: urgent, icon: Flame, color: 'text-red-400' },
  ];

  return (
    <div className="h-full overflow-y-auto p-3 sm:p-6">
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Tableau de bord</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vue d'ensemble de vos projets et tâches
          </p>
        </div>

        {/* Stat cards — responsive grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {statCards.map(s => (
            <Card key={s.label} className="relative overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{s.label}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-foreground mt-1">{s.value}</p>
                  </div>
                  <s.icon className={`w-8 h-8 sm:w-10 sm:h-10 ${s.color} opacity-60`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bento grid */}
        <div className={`grid gap-3 sm:gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-3 grid-rows-2'}`}>
          {/* Progression globale — large card */}
          <Card className={isMobile ? '' : 'col-span-2 row-span-1'}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Progression globale
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-end gap-3">
                <span className="text-4xl sm:text-5xl font-bold text-foreground">{completionRate}%</span>
                <span className="text-sm text-muted-foreground pb-1">complété</span>
              </div>
              <Progress value={completionRate} className="h-2.5" />
              <div className="flex flex-wrap gap-3 text-xs sm:text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  {done} terminées
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                  {inProgress} en cours
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground" />
                  {todo} à faire
                </span>
                {blocked > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    {blocked} bloquées
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Alertes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                Alertes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-2.5 rounded-md bg-destructive/10 border border-destructive/20">
                <span className="text-xs sm:text-sm text-foreground">En retard</span>
                <Badge variant="destructive" className="text-xs">{overdue}</Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                <span className="text-xs sm:text-sm text-foreground">Urgentes</span>
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">{urgent}</Badge>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-md bg-primary/10 border border-primary/20">
                <span className="text-xs sm:text-sm text-foreground">Aujourd'hui</span>
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">{todayTasks.length}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Tâches récentes */}
          <Card className={isMobile ? '' : 'col-span-2'}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-primary" />
                Tâches récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Aucune tâche</p>
                ) : (
                  recentTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        t.status === 'done' ? 'bg-emerald-400'
                        : t.status === 'in_progress' ? 'bg-sky-400'
                        : t.priority === 'urgent' ? 'bg-red-400'
                        : 'bg-muted-foreground'
                      }`} />
                      <span className="text-xs sm:text-sm text-foreground truncate flex-1">{t.title}</span>
                      {t.dueDate && (
                        <span className="text-label text-muted-foreground shrink-0">
                          {format(parseISO(t.dueDate), 'd MMM', { locale: fr })}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Charge de travail */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Charge par membre
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {memberWorkload.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Aucun membre</p>
                ) : (
                  memberWorkload.map(m => (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0"
                        style={{ backgroundColor: m.avatarColor }}
                      >
                        {m.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs sm:text-sm text-foreground truncate flex-1">{m.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{m.assigned}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
