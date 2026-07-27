import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, ChevronsUpDown, Settings2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrg } from '@/context/OrgContext';

/**
 * Sélecteur d'équipe affiché en haut de la barre latérale.
 * Masqué pour les utilisateurs mono-équipe (comportement identique à avant).
 */
export default function OrgSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { currentOrg, myOrgs, memberOrgIds, isSuperAdmin, loading, switchOrg } = useOrg();
  const navigate = useNavigate();

  if (loading || !currentOrg) return null;
  if (myOrgs.length <= 1 && !isSuperAdmin) return null;

  const mine = myOrgs.filter((o) => memberOrgIds.includes(o.id));
  const others = myOrgs.filter((o) => !memberOrgIds.includes(o.id));

  const renderItem = (org: typeof myOrgs[number]) => (
    <DropdownMenuItem
      key={org.id}
      onClick={() => org.id !== currentOrg.id && switchOrg(org.id)}
      className="gap-2 cursor-pointer"
    >
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: org.color || 'hsl(var(--primary))' }}
      />
      <span className="flex-1 truncate">{org.name}</span>
      {org.is_active === false && (
        <span className="text-[10px] text-muted-foreground">archivée</span>
      )}
      {org.id === currentOrg.id && <Check className="w-3.5 h-3.5 text-primary" />}
    </DropdownMenuItem>
  );

  return (
    <div className="px-3 pt-3">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-sidebar-fg hover:bg-sidebar-hover transition-colors border border-sidebar-border-color"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: currentOrg.color || 'hsl(var(--primary))' }}
            />
            <span className="flex-1 truncate text-left font-medium text-sidebar-fg-bright">
              {currentOrg.name}
            </span>
            <ChevronsUpDown className="w-3.5 h-3.5 opacity-70" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-60 bg-popover text-popover-foreground z-50">
          <DropdownMenuLabel className="text-xs flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> Mes équipes
          </DropdownMenuLabel>
          {mine.length > 0 ? mine.map(renderItem) : (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Aucune appartenance</div>
          )}

          {isSuperAdmin && others.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Administration générale
              </DropdownMenuLabel>
              {others.map(renderItem)}
            </>
          )}

          {isSuperAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => {
                  onNavigate?.();
                  navigate('/settings/organizations');
                }}
              >
                <Settings2 className="w-3.5 h-3.5" />
                Gérer les équipes
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
