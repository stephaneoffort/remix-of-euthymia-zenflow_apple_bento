import React, { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDropbox, type DropboxEntry } from '@/hooks/useDropbox';
import { Folder, FileText, ArrowLeft, Search, Check, Home } from 'lucide-react';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entityType: 'task' | 'event' | 'project';
  entityId: string;
  onAttached?: () => void;
}

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  const u = ['B', 'KB', 'MB', 'GB'];
  let i = 0; let v = bytes;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(1)} ${u[i]}`;
}

export default function DropboxFilePicker({ open, onOpenChange, entityType, entityId, onAttached }: Props) {
  const dropbox = useDropbox();
  const [path, setPath] = useState<string>('');
  const [entries, setEntries] = useState<DropboxEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [attachingId, setAttachingId] = useState<string | null>(null);

  const loadFolder = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const data = await dropbox.listFolder(p);
      setEntries(Array.isArray(data) ? data : []);
      setPath(p);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur Dropbox');
    }
    setLoading(false);
  }, [dropbox]);

  useEffect(() => {
    if (open && dropbox.isConnected) {
      loadFolder('');
      setQuery('');
    }
  }, [open, dropbox.isConnected]);

  const handleSearch = async () => {
    if (!query.trim()) { loadFolder(path); return; }
    setLoading(true);
    try {
      const data = await dropbox.search(query.trim());
      setEntries(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur recherche');
    }
    setLoading(false);
  };

  const handleAttach = async (entry: DropboxEntry) => {
    setAttachingId(entry.id);
    try {
      await dropbox.attachFile(entry, entityType, entityId);
      toast.success(`${entry['.tag'] === 'folder' ? 'Dossier' : 'Fichier'} attaché`);
      onAttached?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erreur lors de l\'attachement');
    }
    setAttachingId(null);
  };

  const goUp = () => {
    if (!path) return;
    const parts = path.split('/').filter(Boolean);
    parts.pop();
    loadFolder(parts.length ? '/' + parts.join('/') : '');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Sélectionner un fichier Dropbox</DialogTitle>
          <DialogDescription>
            Naviguez dans vos dossiers Dropbox ou recherchez un fichier à attacher.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => loadFolder('')} title="Racine">
            <Home className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goUp} disabled={!path}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground truncate flex-1" title={path || '/'}>
            {path || '/'}
          </span>
        </div>

        <div className="flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Rechercher dans Dropbox…"
            className="h-9"
          />
          <Button variant="outline" size="sm" onClick={handleSearch}>
            <Search className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 min-h-[300px]">
          {loading ? (
            <>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun fichier trouvé</p>
          ) : (
            entries.map((entry) => {
              const isFolder = entry['.tag'] === 'folder';
              return (
                <div
                  key={entry.id}
                  className="group flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <button
                    onClick={() => isFolder ? loadFolder(entry.path_display) : handleAttach(entry)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    {isFolder ? (
                      <Folder className="w-5 h-5 text-[#0061FF] shrink-0" />
                    ) : (
                      <FileText className="w-5 h-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{entry.name}</p>
                      {!isFolder && entry.size && (
                        <p className="text-xs text-muted-foreground">{formatSize(entry.size)}</p>
                      )}
                    </div>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleAttach(entry)}
                    disabled={attachingId === entry.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity gap-1"
                  >
                    <Check className="w-4 h-4" />
                    Attacher
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
