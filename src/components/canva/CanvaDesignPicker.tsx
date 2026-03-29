import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useCanva } from '@/hooks/useCanva';
import { toast } from 'sonner';
import { Search, Plus, ExternalLink } from 'lucide-react';

const DESIGN_TYPES = [
  { value: 'presentation', label: 'Présentation', emoji: '📊', color: 'bg-blue-500/10 text-blue-600' },
  { value: 'poster', label: 'Poster / Affiche', emoji: '🖼️', color: 'bg-orange-500/10 text-orange-600' },
  { value: 'social_media', label: 'Post réseaux sociaux', emoji: '📱', color: 'bg-pink-500/10 text-pink-600' },
  { value: 'flyer', label: 'Flyer / Brochure', emoji: '📄', color: 'bg-violet-500/10 text-violet-600' },
  { value: 'doc', label: 'Document', emoji: '📝', color: 'bg-green-500/10 text-green-600' },
];

function getTypeBadge(type: string | null) {
  const found = DESIGN_TYPES.find(t => t.value === type);
  if (!found) return null;
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${found.color}`}>
      {found.label}
    </span>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: string;
  entityId: string;
  defaultTitle?: string;
  onAttached?: () => void;
}

export default function CanvaDesignPicker({ open, onOpenChange, entityType, entityId, defaultTitle, onAttached }: Props) {
  const canva = useCanva();
  const [designs, setDesigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [newType, setNewType] = useState('presentation');
  const [newTitle, setNewTitle] = useState(defaultTitle || '');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (open && canva.isConnected) {
      loadDesigns();
    }
  }, [open, canva.isConnected]);

  useEffect(() => {
    setNewTitle(defaultTitle || '');
  }, [defaultTitle]);

  const loadDesigns = async () => {
    setLoading(true);
    try {
      const data = await canva.listDesigns();
      setDesigns(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setLoading(false);
  };

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const data = await canva.searchDesigns(q);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setSearching(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => handleSearch(searchQuery), 400);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleAttach = async (designId: string) => {
    try {
      await canva.attachDesign(designId, entityType, entityId);
      toast.success('Design Canva joint ✅');
      onAttached?.();
      onOpenChange(false);
    } catch {
      toast.error("Erreur lors de l'attachement");
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await canva.createDesign(newType, newTitle || 'Nouveau design');
      if (result?.urls?.edit_url) {
        window.open(result.urls.edit_url, '_blank');
      }
      if (result?.id) {
        await canva.attachDesign(result.id, entityType, entityId);
        toast.success('Design créé et joint ✅');
        onAttached?.();
        onOpenChange(false);
      }
    } catch {
      toast.error('Erreur lors de la création');
    }
    setCreating(false);
  };

  if (!canva.isConnected) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-xl">🎨</span> Canva
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">
              Connectez votre compte Canva pour joindre des designs.
            </p>
            <Button onClick={canva.connect} className="gap-2">
              <span>🎨</span> Connecter Canva
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const renderGrid = (items: any[], isLoading: boolean) => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="aspect-[4/3] rounded-lg" />
          ))}
        </div>
      );
    }
    if (!items.length) {
      return <p className="text-sm text-muted-foreground text-center py-8">Aucun design trouvé</p>;
    }
    return (
      <div className="grid grid-cols-3 gap-3 max-h-[400px] overflow-y-auto">
        {items.map((d: any) => (
          <button
            key={d.id}
            onClick={() => handleAttach(d.id)}
            className="group relative rounded-lg border border-border overflow-hidden hover:ring-2 hover:ring-primary transition-all bg-card text-left"
          >
            {d.thumbnail?.url ? (
              <img src={d.thumbnail.url} alt={d.title} className="w-full aspect-[4/3] object-cover" />
            ) : (
              <div className="w-full aspect-[4/3] bg-[#00C4CC]/10 flex items-center justify-center">
                <span className="text-3xl">🎨</span>
              </div>
            )}
            <div className="p-2">
              <p className="text-xs font-medium text-foreground truncate">{d.title || 'Sans titre'}</p>
              {getTypeBadge(d.design_type?.type)}
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
            <span className="text-xl">🎨</span> Canva
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="recent" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recent">Récents</TabsTrigger>
            <TabsTrigger value="search">Rechercher</TabsTrigger>
            <TabsTrigger value="create">Créer nouveau</TabsTrigger>
          </TabsList>

          <TabsContent value="recent" className="mt-4">
            {renderGrid(designs, loading)}
          </TabsContent>

          <TabsContent value="search" className="mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un design..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {renderGrid(searchResults, searching)}
          </TabsContent>

          <TabsContent value="create" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {DESIGN_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => setNewType(t.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border transition-all text-left ${
                    newType === t.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span>{t.emoji}</span>
                  <span className="text-sm font-medium text-foreground">{t.label}</span>
                </button>
              ))}
            </div>
            <Input
              placeholder="Nom du design"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
            />
            <Button onClick={handleCreate} disabled={creating} className="w-full gap-2">
              <ExternalLink className="w-4 h-4" />
              {creating ? 'Création...' : 'Créer dans Canva'}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
