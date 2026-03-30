import type { MemberProfile } from '@/types/chat';

interface Props {
  memberProfiles: Record<string, MemberProfile>;
}

export function MembersPanel({ memberProfiles }: Props) {
  const members = Object.entries(memberProfiles);
  // For now, treat all loaded profiles as "online"
  const onlineMembers = members;

  return (
    <div className="w-60 border-l bg-muted/10 shrink-0 overflow-y-auto hidden lg:block">
      <div className="p-3">
        {/* Online */}
        <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-3 px-1">
          En ligne — {onlineMembers.length}
        </h4>
        <div className="space-y-0.5">
          {onlineMembers.map(([userId, profile]) => (
            <button
              key={userId}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors group cursor-pointer"
            >
              <div className="relative">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                  style={{ backgroundColor: profile.avatar_color || '#6366f1' }}
                >
                  {(profile.name || '?')[0].toUpperCase()}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-foreground truncate group-hover:text-foreground">{profile.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{profile.role}</p>
              </div>
            </button>
          ))}
        </div>

        {members.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">Aucun membre</p>
        )}
      </div>
    </div>
  );
}
