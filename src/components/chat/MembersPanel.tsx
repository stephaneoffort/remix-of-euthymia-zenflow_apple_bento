import type { MemberProfile } from '@/types/chat';

interface Props {
  memberProfiles: Record<string, MemberProfile>;
}

export function MembersPanel({ memberProfiles }: Props) {
  const members = Object.entries(memberProfiles);

  return (
    <div className="w-60 border-l border-border/50 bg-card/30 backdrop-blur-sm shrink-0 overflow-y-auto hidden lg:block">
      <div className="p-3">
        <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
          Membres — {members.length}
        </h4>
        <div className="space-y-0.5">
          {members.map(([userId, profile]) => (
            <div
              key={userId}
              className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-muted/40 transition-colors group cursor-default"
            >
              <div className="relative">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: profile.avatar_color || '#6366f1' }}
                >
                  {(profile.name || '?')[0].toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-card" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate font-medium">{profile.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{profile.role}</p>
              </div>
            </div>
          ))}
        </div>

        {members.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground">Aucun membre en ligne</p>
          </div>
        )}
      </div>
    </div>
  );
}
