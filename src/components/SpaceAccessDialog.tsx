import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Shield, Users, Crown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface SpaceAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceId: string;
  spaceName: string;
  isPrivate: boolean;
  onUpdate: () => void;
}

export default function SpaceAccessDialog({
  open, onOpenChange, spaceId, spaceName, isPrivate, onUpdate,
}: SpaceAccessDialogProps) {
  const { teamMembers } = useApp();
  const [priv, setPriv] = useState(isPrivate);
  const [memberIds, setMemberIds] = useState<Set<string>>(new Set());
  const [managerIds, setManagerIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPriv(isPrivate);
    // Load current members and managers
    Promise.all([
      supabase.from('space_members').select('member_id').eq('space_id', spaceId),
      supabase.from('space_managers').select('member_id').eq('space_id', spaceId),
    ]).then(([membersRes, managersRes]) => {
      setMemberIds(new Set((membersRes.data || []).map(r => r.member_id)));
      setManagerIds(new Set((managersRes.data || []).map(r => r.member_id)));
    });
  }, [open, spaceId, isPrivate]);

  const toggleMember = (id: string) => {
    setMemberIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // Also remove from managers if removed from members
        setManagerIds(p => { const n = new Set(p); n.delete(id); return n; });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleManager = (id: string) => {
    setManagerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        // Auto-add to members
        setMemberIds(p => new Set(p).add(id));
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update is_private
      await supabase.from('spaces').update({ is_private: priv } as any).eq('id', spaceId);

      // Sync members
      await supabase.from('space_members').delete().eq('space_id', spaceId);
      if (memberIds.size > 0) {
        await supabase.from('space_members').insert(
          Array.from(memberIds).map(mid => ({ space_id: spaceId, member_id: mid }))
        );
      }

      // Sync managers
      await supabase.from('space_managers').delete().eq('space_id', spaceId);
      if (managerIds.size > 0) {
        await supabase.from('space_managers').insert(
          Array.from(managerIds).map(mid => ({ space_id: spaceId, member_id: mid }))
        );
      }

      toast.success('Accès mis à jour');
      onUpdate();
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
            <Shield className="w-5 h-5 text-primary" />
            Accès — {spaceName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Private toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label className="text-sm font-medium">Espace privé</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Seuls les membres sélectionnés y auront accès
              </p>
            </div>
            <Switch checked={priv} onCheckedChange={setPriv} />
          </div>

          {priv && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>Membres autorisés et responsables</span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1">
                {teamMembers.map(m => {
                  const isMember = memberIds.has(m.id);
                  const isManager = managerIds.has(m.id);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={isMember}
                        onCheckedChange={() => toggleMember(m.id)}
                      />
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
                      <button
                        onClick={() => toggleManager(m.id)}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
                          isManager
                            ? 'bg-primary/15 text-primary font-medium'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                        title={isManager ? 'Retirer comme responsable' : 'Nommer responsable'}
                      >
                        <Crown className="w-3 h-3" />
                        {isManager ? 'Responsable' : 'Nommer'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {!priv && managerIds.size === 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Crown className="w-4 h-4" />
                <span>Responsables de l'espace (optionnel)</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {teamMembers.map(m => {
                  const isManager = managerIds.has(m.id);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={isManager}
                        onCheckedChange={() => toggleManager(m.id)}
                      />
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
                  );
                })}
              </div>
            </div>
          )}

          {!priv && managerIds.size > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Crown className="w-4 h-4" />
                <span>Responsables de l'espace</span>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {teamMembers.map(m => {
                  const isManager = managerIds.has(m.id);
                  return (
                    <div
                      key={m.id}
                      className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        checked={isManager}
                        onCheckedChange={() => toggleManager(m.id)}
                      />
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
                  );
                })}
              </div>
            </div>
          )}

          {/* Managers summary */}
          {managerIds.size > 0 && (
            <div className="flex flex-wrap gap-1">
              {Array.from(managerIds).map(id => {
                const m = teamMembers.find(t => t.id === id);
                if (!m) return null;
                return (
                  <Badge key={id} variant="secondary" className="gap-1 text-xs">
                    <Crown className="w-3 h-3" />
                    {m.name}
                  </Badge>
                );
              })}
            </div>
          )}

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
