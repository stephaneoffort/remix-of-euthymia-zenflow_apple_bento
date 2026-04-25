import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';

interface Props {
  boardId: string;
  boardName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MiroBoardEmbed({ boardId, boardName, open, onOpenChange }: Props) {
  const embedUrl = `https://miro.com/app/live-embed/${boardId}/?moveToViewport=-867,-365,1734,730&embedAutoplay=true`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl h-[80vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b flex-row items-center justify-between shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span>🟡</span> {boardName}
          </DialogTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`https://miro.com/app/board/${boardId}/`, '_blank')}
            className="gap-1.5 text-xs"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ouvrir dans Miro
          </Button>
        </DialogHeader>
        <div className="flex-1 overflow-hidden">
          <iframe
            src={embedUrl}
            title={boardName}
            allow="fullscreen; clipboard-read; clipboard-write"
            className="w-full h-full border-0"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
