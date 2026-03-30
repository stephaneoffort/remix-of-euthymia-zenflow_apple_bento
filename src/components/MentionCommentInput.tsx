import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { TeamMember } from '@/types';
import RichTextEditor from '@/components/RichTextEditor';

interface MentionCommentInputProps {
  value: string;
  onChange: (val: string) => void;
  onSubmit: (content: string, mentionedIds: string[]) => void;
  placeholder?: string;
}

export default function MentionCommentInput({ value, onChange, onSubmit, placeholder }: MentionCommentInputProps) {
  const { teamMembers } = useApp();
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionedIds, setMentionedIds] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter members based on query
  const filteredMembers = teamMembers.filter(m =>
    m.name.toLowerCase().includes(mentionQuery.toLowerCase())
  ).slice(0, 6);

  // Detect @ typing in the content
  useEffect(() => {
    const text = value.replace(/<[^>]*>/g, '');
    const lastAt = text.lastIndexOf('@');
    if (lastAt >= 0) {
      const afterAt = text.slice(lastAt + 1);
      // If there's no space after @, show suggestions
      if (!afterAt.includes(' ') && afterAt.length < 20) {
        setShowMentions(true);
        setMentionQuery(afterAt);
        return;
      }
    }
    setShowMentions(false);
    setMentionQuery('');
  }, [value]);

  const handleSelectMember = (member: TeamMember) => {
    // Replace @query with @Name in content
    const text = value.replace(/<[^>]*>/g, '');
    const lastAt = text.lastIndexOf('@');
    if (lastAt >= 0) {
      const before = value.substring(0, value.lastIndexOf('@'));
      const mentionHtml = `<span class="mention" data-member-id="${member.id}" style="color: hsl(var(--primary)); font-weight: 600;">@${member.name}</span>&nbsp;`;
      onChange(before + mentionHtml);
    }
    if (!mentionedIds.includes(member.id)) {
      setMentionedIds(prev => [...prev, member.id]);
    }
    setShowMentions(false);
  };

  const handleSubmit = () => {
    if (!value.trim() || value === '<p></p>') return;
    // Extract all mentioned member IDs from HTML
    const mentionRegex = /data-member-id="([^"]+)"/g;
    const ids = new Set(mentionedIds);
    let match;
    while ((match = mentionRegex.exec(value)) !== null) {
      ids.add(match[1]);
    }
    onSubmit(value, Array.from(ids));
    setMentionedIds([]);
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="space-y-2">
        <RichTextEditor
          content={value}
          onChange={onChange}
          placeholder={placeholder || "Écrire un commentaire... Tapez @ pour mentionner"}
          className="text-sm"
          editorClassName="min-h-[38px]"
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Tapez <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">@</kbd> pour mentionner
          </span>
          <button
            onClick={handleSubmit}
            disabled={!value.trim() || value === '<p></p>'}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-50 shrink-0"
          >
            Envoyer
          </button>
        </div>
      </div>

      {/* Mention dropdown */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
          <p className="text-[10px] text-muted-foreground px-3 py-1 uppercase tracking-wider">Membres</p>
          {filteredMembers.map(member => (
            <button
              key={member.id}
              onClick={() => handleSelectMember(member)}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-accent transition-colors text-left"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: member.avatarColor }}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{member.role}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
