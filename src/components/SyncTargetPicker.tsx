import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { CalendarAccount } from '@/hooks/useCalendarSync';
import { getProviderMeta } from '@/components/CalendarAccountsManager';

interface Props {
  open: boolean;
  onClose: () => void;
  accounts: CalendarAccount[];
  onSelect: (accountId: string) => void;
}

export default function SyncTargetPicker({ open, onClose, accounts, onSelect }: Props) {
  const writableAccounts = accounts.filter(a => a.provider !== 'ics');

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Synchroniser vers quel agenda ?</DialogTitle>
        </DialogHeader>
        {writableAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Aucun agenda connecté en écriture.</p>
        ) : (
          <div className="space-y-2 mt-2">
            {writableAccounts.map(acc => {
              const meta = getProviderMeta(acc.provider);
              return (
                <button key={acc.id} onClick={() => { onSelect(acc.id); onClose(); }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all text-left">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{acc.label || meta.label}</p>
                    <p className="text-[11px] text-muted-foreground">{meta.label}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex justify-end mt-2">
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
