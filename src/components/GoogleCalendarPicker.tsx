import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGoogleCalendars } from '@/hooks/useGoogleCalendars';
import { CalendarDays } from 'lucide-react';

interface Props {
  value: string | null | undefined;
  onChange: (calendarId: string | null) => void;
  compact?: boolean;
}

export default function GoogleCalendarPicker({ value, onChange, compact }: Props) {
  const { calendars, defaultCalendarId, loading, hasGoogle } = useGoogleCalendars();

  if (!hasGoogle) return null;
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <CalendarDays className="w-3.5 h-3.5 animate-pulse" />
        <span>Chargement…</span>
      </div>
    );
  }

  const defaultLabel = defaultCalendarId
    ? calendars.find(c => c.id === defaultCalendarId)?.summary || 'Agenda par défaut'
    : 'ZENFLOW';

  const selectedValue = value || '__default__';

  return (
    <div className={compact ? '' : 'space-y-1'}>
      {!compact && (
        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />
          Synchroniser dans
        </label>
      )}
      <Select
        value={selectedValue}
        onValueChange={(v) => onChange(v === '__default__' ? null : v)}
      >
        <SelectTrigger className={compact ? 'h-7 text-xs' : 'h-8 text-sm'}>
          <SelectValue placeholder="Agenda par défaut" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__default__">
            📅 Par défaut ({defaultLabel})
          </SelectItem>
          <SelectItem value="__zenflow__">📅 ZENFLOW</SelectItem>
          <SelectItem value="primary">📅 Agenda principal</SelectItem>
          {calendars
            .filter(c => !c.primary && c.id !== 'primary')
            .map(c => (
              <SelectItem key={c.id} value={c.id}>
                📅 {c.summary}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
