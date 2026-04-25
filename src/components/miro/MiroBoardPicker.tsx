import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, Loader2 } from 'lucide-react';
import { useMiro, type MiroBoard } from '@/hooks/useMiro';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'task' | 'event' | 'project';
  entityId: string;
  defaultTitle?: string;
  onAttached?: () => void;
}

export default function MiroBoardPicker({ open, onOpenChange, entityType, entityId, defaultTitle, onAttached }: Props) {
  const miro = useMiro();
  const [tab, setTab] = useState<'existing' | 'new'>('existing');
  const [boards, setBoards] = useState<MiroBoard[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [attaching, setAttaching] = useState<string | null>(null);

  // create form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchBoards = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const data = await miro.listBoards(q);
      setBoards(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e?.message ?? 'Impossible de récupérer les boards');
      setBoards([]);
    }
    setLoading(false);
  }, [miro]);

  useEffect(() => {
    if (open && tab === 'existing' && miro.isConnected) {
      fetchBoards();
    }
    if (open && tab === 'new') {
      setNewName(defaultTitle ?? '');
    }
  }, [open, tab, miro.isConnected, defaultTitle, fetchBoards]);

  const handleAttach = async (board: MiroBoard) => {
    setAttaching(board.id);
    try {
      await miro.attachBoard(board.id, entityType, entityId);
      toast.success(`Board « ${board.name} » attaché`);
      onAttached?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors de l\'attachement');
    }
    setAttaching(null);
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error('Donne un nom au board'); return; }
    setCreating(true);
    try {
      const board = await miro.createBoard(newName.trim(), newDesc.trim());
      await miro.attachBoard(board.id, entityType, entityId);
      toast.success(`Board « ${board.name} » créé et attaché`);
      onAttached?.();
      onOpenChange(false);
      setNewName(''); setNewDesc('');
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors de la création');
    }
    setCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Attacher un board Miro</DialogTitle>
          <DialogDescription>Choisis un board existant ou crées-en un nouveau</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setTab('existing')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === 'existing' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Boards existants
          </button>
          <button
            onClick={() => setTab('new')}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
              tab === 'new' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Nouveau board
          </button>
        </div>

        {tab === 'existing' && (
          <div className="flex-1 overflow-hidden flex flex-col gap-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchBoards(query)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={() => fetchBoards(query)}>Rechercher</Button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
              ) : boards.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Aucun board trouvé</p>
              ) : (
                boards.map(board => (
                  <button
                    key={board.id}
                    onClick={() => handleAttach(board)}
                    disabled={attaching === board.id}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition-all text-left disabled:opacity-50"
                  >
                    {board.picture?.imageURL ? (
                      <img src={board.picture.imageURL} alt={board.name} className="w-12 h-12 rounded object-cover shrink-0" loading="lazy" />
                    ) : (
                      <div className="w-12 h-12 rounded bg-[#FFD02F]/20 flex items-center justify-center shrink-0">
                        <span className="text-lg font-bold text-[#FFD02F]">M</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{board.name}</p>
                      {board.description && (
                        <p className="text-xs text-muted-foreground truncate">{board.description}</p>
                      )}
                    </div>
                    {attaching === board.id ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'new' && (
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nom du board</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex : Brainstorming Q2" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Description (optionnel)</label>
              <Input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="Description courte" />
            </div>
            <Button onClick={handleCreate} disabled={creating || !newName.trim()} className="w-full gap-2">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer et attacher
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
