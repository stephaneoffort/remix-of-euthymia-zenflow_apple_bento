import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { SPACE_ICON_PRESETS, SpaceIcon, getSpaceIconPreset } from "@/components/SpaceIcon";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  spaceName: string;
  currentIcon?: string | null;
  onSelect: (iconId: string) => void;
};

export default function SpaceIconPickerDialog({ open, onOpenChange, spaceName, currentIcon, onSelect }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SPACE_ICON_PRESETS;
    return SPACE_ICON_PRESETS.filter(
      (p) => p.label.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    );
  }, [query]);

  const isLegacyEmoji = currentIcon && !getSpaceIconPreset(currentIcon);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SpaceIcon value={currentIcon} size="md" />
            <span>Icône de « {spaceName} »</span>
          </DialogTitle>
          <DialogDescription>
            Choisissez une icône premium pour cet espace.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (idées, vision, premium…)"
            className="pl-9"
          />
        </div>

        {isLegacyEmoji && (
          <p className="text-xs text-muted-foreground -mt-1">
            Icône actuelle : ancien emoji {currentIcon} — sélectionnez-en une nouvelle pour la remplacer.
          </p>
        )}

        <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 max-h-[360px] overflow-y-auto pt-1 pb-1">
          {filtered.map((preset) => {
            const isCurrent = currentIcon === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => {
                  onSelect(preset.id);
                  onOpenChange(false);
                }}
                className={`group flex flex-col items-center gap-1.5 p-2 rounded-lg transition-all hover:bg-muted ${
                  isCurrent ? "bg-muted ring-2 ring-primary" : ""
                }`}
              >
                <SpaceIcon value={preset.id} size="lg" className="group-hover:scale-110 transition-transform" />
                <span className="text-[11px] text-muted-foreground truncate w-full text-center">
                  {preset.label}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-full text-center text-sm text-muted-foreground py-8">
              Aucune icône ne correspond à « {query} »
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
