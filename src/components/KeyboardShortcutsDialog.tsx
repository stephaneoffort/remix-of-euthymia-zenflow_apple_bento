import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SHORTCUTS } from '@/hooks/useKeyboardShortcuts';
import { Keyboard } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function KeyboardShortcutsDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Keyboard className="w-4 h-4 text-muted-foreground" />
            Raccourcis clavier
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 pt-2">
          {SHORTCUTS.map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-1">
              <span className="text-sm text-foreground">{s.label}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((key, j) => (
                  <React.Fragment key={j}>
                    {j > 0 && <span className="text-muted-foreground text-xs">+</span>}
                    <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-medium text-muted-foreground bg-muted rounded border border-border">
                      {key}
                    </kbd>
                  </React.Fragment>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
