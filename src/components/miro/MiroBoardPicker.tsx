import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useMiro, type MiroBoard } from '@/hooks/useMiro';
import { toast } from 'sonner';
import { Search, Plus, ExternalLink, Layout } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  defaultName?: string;
  onAttached?: () => void;
}

export default function MiroBoardPicker({ open, onOpenChange, entityType, entityId, defaultName, onAttached }: Props) {
  const miro = useMiro();
  const [boards, setBoards] = useState<MiroBoard[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<MiroBoard[]>([]);
  const [searching, setSearching] = useState(false);
  const [newName, setNewName] = useState(defaultName || '');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open && miro.isConnected) loadBoards();
  }, [open, miro.isConnected]);

  useEffect(() => {
    setNewName(defaultName || '');
  }, [defaultName]);

  const loadBoards = async () => {
    setLoading(true);
    try {
      const data = await miro.listBoards();
      setBoards(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data = await miro.searchBoards(q);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleAttach = async (board: MiroBoard) => {
    try {
      await miro.attachBoard(board.id, board.name, board.viewLink, entityType, entityId);
      toast.success('Tableau Miro joint ✅');
      onAttached?.();
      onOpenChange(false);
    } catch {
      toast.error("Erreur lors de l'attachement");
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await miro.createBoard(newName || 'Nouveau tableau', newDescription || undefined);
      if (result?.viewLink) {
        await miro.attachBoard(result.id, result.name, result.viewLink, entityType, entityId);
        window.open(result.viewLink, '_blank');
        toast.success('Tableau créé et joint ✅');
        onAttached?.();
        onOpenChange(false);
      }
    } catch {
      toast.error('Erreur lors de la création');
    }
    setCreating(false);
  };

  if (!miro.isConnected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">🟡</span> Miro
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">
              Connectez votre compte Miro pour joindre des tableaux.
            </p>
            <Button onClick={miro.connect} className="gap-2" style={{ backgroundColor: '#FFD02F', color: '#050038' }}>
              <Layout className="w-4 h-4" /> Connecter Miro
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const renderGrid = (items: MiroBoard[], isLoading: boolean) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="aspect-video rounded-lg" />
          ))}
        </div>
      );
    }
    if (!items.length) {
      return <p className="text-sm text-muted-foreground text-center py-8">Aucun tableau trouvé</p>;
    }
    return (
      <div className="grid grid-cols-2 gap-3 max-h-[400px] overflow-y-auto">
        {items.map(board => (
          <button
            key={board.id}
            onClick={() => handleAttach(board)}
            className="group relative rounded-lg border border-border overflow-hidden hover:ring-2 hover:ring-primary transition-all bg-card text-left"
          >
            {board.picture?.imageURL ? (
              <img src={board.picture.imageURL} alt={board.name} className="w-full aspect-video object-cover" />
            ) : (
              <div className="w-full aspect-video bg-[#FFD02F]/10 flex items-center justify-center">
                <Layout className="w-8 h-8 text-[#FFD02F]" />
              </div>
            )}
            <div className="p-2">
              <p className="text-xs font-medium text-foreground truncate">{board.name || 'Sans titre'}</p>
              {board.description && (
                <p className="text-[10px] text-muted-foreground truncate">{board.description}</p>
              )}
            </div>
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-xl">🟡</span> Miro — Tableaux
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="recent" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recent">Récents</TabsTrigger>
            <TabsTrigger value="search">Rechercher</TabsTrigger>
            <TabsTrigger value="create">Créer nouveau</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="mt-4">
            {renderGrid(boards, loading)}
          </TabsContent>

          <TabsContent value="search" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un tableau..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {renderGrid(searchResults, searching)}
          </TabsContent>

          <TabsContent value="create" className="mt-4 space-y-4">
            <div className="space-y-3">
              <Input
                placeholder="Nom du tableau"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
              <Textarea
                placeholder="Description (optionnel)"
                value={newDescription}
                onChange={e => setNewDescription(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              onClick={handleCreate}
              disabled={creating}
              className="w-full gap-2"
              style={{ backgroundColor: '#FFD02F', color: '#050038' }}
            >
              <ExternalLink className="w-4 h-4" />
              {creating ? 'Création...' : 'Créer dans Miro'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
