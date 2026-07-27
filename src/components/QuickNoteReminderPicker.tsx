import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Bell, BellRing, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Sélecteur de rappel (date + heure) pour une note rapide.
 * Renvoie une date absolue (locale utilisateur → Date JS), ce qui garantit
 * que « 9h » signifie bien 9h dans le fuseau de l'utilisateur une fois
 * sérialisé en ISO/timestamptz.
 */
interface Props {
  value: Date | null;
  onChange: (value: Date | null) => void;
  /** Rendu compact (icône seule) pour les listes de notes. */
  compact?: boolean;
}

function combine(day: Date, time: string): Date {
  const [h, m] = time.split(':').map(n => parseInt(n, 10));
  const d = new Date(day);
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

export function formatReminder(date: Date): string {
  return format(date, "EEEE d MMMM 'à' HH:mm", { locale: fr });
}

export function QuickNoteReminderPicker({ value, onChange, compact }: Props) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<Date | undefined>(value ?? undefined);
  const [time, setTime] = useState(value ? format(value, 'HH:mm') : '09:00');

  // Resynchronise l'état interne quand la valeur externe change.
  useEffect(() => {
    setDay(value ?? undefined);
    setTime(value ? format(value, 'HH:mm') : '09:00');
  }, [value]);

  const confirm = () => {
    if (!day) {
      toast.error('Choisissez d’abord une date');
      return;
    }
    const next = combine(day, time);
    if (next.getTime() <= Date.now()) {
      // Message explicite plutôt qu'un bouton désactivé sans raison.
      toast.error('Ce moment est déjà passé', {
        description: 'Choisissez une date et une heure dans le futur pour recevoir le rappel.',
      });
      return;
    }
    onChange(next);
    setOpen(false);
  };

  const clear = () => {
    onChange(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={value ? `Rappel : ${formatReminder(value)}` : 'Programmer un rappel'}
          aria-label={value ? `Rappel programmé : ${formatReminder(value)}` : 'Programmer un rappel'}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg transition-colors',
            compact ? 'p-1.5 hover:bg-muted' : 'px-2.5 py-2 bg-muted hover:bg-muted/80',
            value ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {value ? <BellRing className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
          {!compact && <span className="hidden sm:inline text-xs">Rappel</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-popover text-popover-foreground" align="start">
        <Calendar
          mode="single"
          selected={day}
          onSelect={setDay}
          weekStartsOn={1}
          locale={fr}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
        <div className="border-t border-border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <label htmlFor="reminder-time" className="text-xs text-muted-foreground">Heure</label>
            <input
              id="reminder-time"
              type="time"
              value={time}
              onChange={e => setTime(e.target.value)}
              className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-sm text-foreground"
            />
          </div>
          <div className="flex items-center gap-2">
            {value && (
              <Button variant="ghost" size="sm" onClick={clear} className="text-destructive">
                <X className="w-3.5 h-3.5 mr-1" />
                Retirer
              </Button>
            )}
            <div className="flex-1" />
            <Button size="sm" onClick={confirm}>Programmer</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
