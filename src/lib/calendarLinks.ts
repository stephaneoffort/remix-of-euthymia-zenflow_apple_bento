import type { Task } from '@/types';

function formatDateForGoogle(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function getNextDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + 1);
  return d.toISOString().split('T')[0].replace(/-/g, '');
}

export function generateGoogleCalendarUrl(task: Task): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: task.title,
    details: task.description || '',
  });

  if (task.dueDate) {
    const start = formatDateForGoogle(task.dueDate);
    const end = getNextDay(task.dueDate);
    params.set('dates', `${start}/${end}`);
  }

  return `https://calendar.google.com/calendar/event?${params.toString()}`;
}

export function generateOutlookCalendarUrl(task: Task): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: task.title,
    body: task.description || '',
    allday: 'true',
  });

  if (task.dueDate) {
    params.set('startdt', task.dueDate);
    const next = new Date(task.dueDate);
    next.setDate(next.getDate() + 1);
    params.set('enddt', next.toISOString().split('T')[0]);
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function generateYahooCalendarUrl(task: Task): string {
  const params = new URLSearchParams({
    v: '60',
    title: task.title,
    desc: task.description || '',
    dur: 'allday',
  });

  if (task.dueDate) {
    params.set('st', formatDateForGoogle(task.dueDate));
  }

  return `https://calendar.yahoo.com/?${params.toString()}`;
}
