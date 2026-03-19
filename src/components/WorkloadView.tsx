import React, { useMemo } from 'react';
import { useApp } from '@/context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { STATUS_LABELS, PRIORITY_LABELS, Priority } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

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

export default function WorkloadView() {
  const { getFilteredTasks, teamMembers } = useApp();
  const tasks = getFilteredTasks();

  const memberData = useMemo(() => {
    return teamMembers.map(member => {
      const memberTasks = tasks.filter(t => t.assigneeIds.includes(member.id));
      const byStatus: Record<string, number> = {};
      const byPriority: Record<string, number> = {};

      memberTasks.forEach(t => {
        byStatus[t.status] = (byStatus[t.status] || 0) + 1;
        byPriority[t.priority] = (byPriority[t.priority] || 0) + 1;
      });

      const done = memberTasks.filter(t => t.status === 'done').length;
      const total = memberTasks.length;
      const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

      const timeEstimated = memberTasks.reduce((s, t) => s + (t.timeEstimate || 0), 0);
      const timeLogged = memberTasks.reduce((s, t) => s + (t.timeLogged || 0), 0);

      return {
        member,
        total,
        done,
        completionRate,
        timeEstimated,
        timeLogged,
        byStatus,
        byPriority,
      };
    }).sort((a, b) => b.total - a.total);
  }, [tasks, teamMembers]);

  const barData = useMemo(() =>
    memberData.map(d => ({
      name: d.member.name.split(' ')[0],
      'À faire': d.byStatus['todo'] || 0,
      'En cours': d.byStatus['in_progress'] || 0,
      'En revue': d.byStatus['in_review'] || 0,
      'Terminé': d.byStatus['done'] || 0,
      'Bloqué': d.byStatus['blocked'] || 0,
    })),
    [memberData]
  );

  const overallByPriority = useMemo(() => {
    const counts: Record<string, number> = {};
    tasks.forEach(t => { counts[t.priority] = (counts[t.priority] || 0) + 1; });
    return Object.entries(counts).map(([key, value]) => ({
      name: PRIORITY_LABELS[key as Priority] || key,
      value,
      color: PRIORITY_COLORS[key] || 'hsl(var(--muted-foreground))',
    }));
  }, [tasks]);

  const unassigned = tasks.filter(t => t.assigneeIds.length === 0).length;

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard label="Total tâches" value={tasks.length} />
        <SummaryCard label="Non assignées" value={unassigned} />
        <SummaryCard label="Terminées" value={tasks.filter(t => t.status === 'done').length} />
        <SummaryCard label="Bloquées" value={tasks.filter(t => t.status === 'blocked').length} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Charge par membre</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} className="text-xs fill-muted-foreground" tick={{ fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="À faire" stackId="a" fill={STATUS_COLORS.todo} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="En cours" stackId="a" fill={STATUS_COLORS.in_progress} />
                  <Bar dataKey="En revue" stackId="a" fill={STATUS_COLORS.in_review} />
                  <Bar dataKey="Terminé" stackId="a" fill={STATUS_COLORS.done} />
                  <Bar dataKey="Bloqué" stackId="a" fill={STATUS_COLORS.blocked} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Répartition par priorité</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={overallByPriority} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                    {overallByPriority.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend
                    formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-member detail cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {memberData.map(({ member, total, done, completionRate, byPriority, timeEstimated, timeLogged }) => (
          <Card key={member.id}>
            <CardContent className="pt-4 pb-4 space-y-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: member.avatarColor }}
                >
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{total} tâche{total !== 1 ? 's' : ''} · {done} terminée{done !== 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progression</span>
                  <span>{completionRate}%</span>
                </div>
                <Progress value={completionRate} className="h-2" />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {(['urgent', 'high', 'normal', 'low'] as const).map(p => {
                  const count = byPriority[p] || 0;
                  if (!count) return null;
                  return (
                    <span
                      key={p}
                      className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: `${PRIORITY_COLORS[p]}20`, color: PRIORITY_COLORS[p] }}
                    >
                      {PRIORITY_LABELS[p]}: {count}
                    </span>
                  );
                })}
              </div>

              {timeEstimated > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  ⏱ {formatMinutes(timeLogged)} / {formatMinutes(timeEstimated)} estimé
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 text-center">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}

function formatMinutes(m: number): string {
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r > 0 ? `${h}h${r}m` : `${h}h`;
}
