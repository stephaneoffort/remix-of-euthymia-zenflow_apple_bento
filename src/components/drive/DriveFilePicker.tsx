import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Search, FileText, Image, Table, Presentation, File, FolderOpen } from 'lucide-react';
import { useGoogleDrive, type DriveFile } from '@/hooks/useGoogleDrive';
import { toast } from 'sonner';

function getDriveFileIcon(mimeType: string) {
  if (mimeType?.includes('document') || mimeType?.includes('word')) return <FileText className="w-4 h-4 text-blue-500" />;
  if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return <Table className="w-4 h-4 text-green-500" />;
  if (mimeType?.includes('presentation') || mimeType?.includes('powerpoint')) return <Presentation className="w-4 h-4 text-yellow-500" />;
  if (mimeType?.includes('pdf')) return <FileText className="w-4 h-4 text-red-500" />;
  if (mimeType?.includes('image')) return <Image className="w-4 h-4 text-purple-500" />;
  if (mimeType?.includes('folder')) return <FolderOpen className="w-4 h-4 text-yellow-600" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

export function getDriveIcon(mimeType: string | null) {
  return getDriveFileIcon(mimeType || '');
}

interface DriveFilePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityType: 'task' | 'event' | 'project';
  entityId: string;
  onAttached?: () => void;
}

export default function DriveFilePicker({ open, onOpenChange, entityType, entityId, onAttached }: DriveFilePickerProps) {
  const drive = useGoogleDrive();
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [attaching, setAttaching] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open || !drive.isConnected) return;
    setLoading(true);
    drive.getRecentFiles().then(setFiles).finally(() => setLoading(false));
  }, [open, drive.isConnected]);

  useEffect(() => {
    if (!open || !drive.isConnected) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      drive.getRecentFiles().then(setFiles);
      return;
    }
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      const results = await drive.searchFiles(query);
      setFiles(results);
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open, drive.isConnected]);

  const handleAttach = async (file: DriveFile) => {
    setAttaching(file.id);
    try {
      await drive.attachFile(file.id, entityType, entityId);
      toast.success(`"${file.name}" joint ✅`);
      onAttached?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error('Erreur : ' + (err.message || 'Impossible de joindre'));
    } finally {
      setAttaching(null);
    }
  };

  const formatDate = (d?: string) => {
    if (!d) return '';
    return new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="text-lg">📁</span> Google Drive
          </DialogTitle>
        </DialogHeader>

        {!drive.isConnected ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <p className="text-sm text-muted-foreground text-center">
              Connecte ton compte Google Drive pour joindre des fichiers.
            </p>
            <Button onClick={drive.connect} className="gap-2">
              <span>📁</span> Connecter Google Drive
            </Button>
          </div>
        ) : (
          <div className="space-y-3 mt-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans Drive..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="max-h-[350px] overflow-y-auto space-y-1">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : files.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {query ? 'Aucun résultat' : 'Aucun fichier récent'}
                </p>
              ) : (
                files.map(file => (
                  <button
                    key={file.id}
                    onClick={() => handleAttach(file)}
                    disabled={!!attaching}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left disabled:opacity-50"
                  >
                    {attaching === file.id ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      getDriveFileIcon(file.mimeType)
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDate(file.modifiedTime)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {!query && (
              <p className="text-[11px] text-muted-foreground text-center">
                {files.length > 0 ? 'Fichiers récents · Tape pour rechercher' : ''}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
