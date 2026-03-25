import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { toast } from 'sonner';

interface ProjectMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
}

export default function ProjectMembersDialog({
  open, onOpenChange, projectId, projectName,
}: ProjectMembersDialogProps) {
  const { teamMembers } = useApp();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    supabase.from('project_members').select('member_id').eq('project_id', projectId)
      .then(({ data }) => {
        setSelectedIds(new Set((data || []).map(r => r.member_id)));
      });
  }, [open, projectId]);

  const toggle = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('project_members').delete().eq('project_id', projectId);
      if (selectedIds.size > 0) {
        await supabase.from('project_members').insert(
          Array.from(selectedIds).map(mid => ({ project_id: projectId, member_id: mid }))
        );
      }
      toast.success('Responsables mis à jour');
      onOpenChange(false);
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Responsables — {projectName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-60 overflow-y-auto space-y-1">
            {teamMembers.map(m => (
              <div
                key={m.id}
                className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => toggle(m.id)}
              >
                <Checkbox checked={selectedIds.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} alt={m.name} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                    style={{ backgroundColor: m.avatarColor }}
                  >
                    {m.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                )}
                <span className="text-sm flex-1 truncate">{m.name}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-primary text-primary-foreground rounded-md py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
