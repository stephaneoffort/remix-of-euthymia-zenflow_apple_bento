import { useState, useRef, KeyboardEvent, useCallback, useEffect } from 'react';
import { Plus, Smile, Send, Bold, Italic, Code } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { MemberProfile } from '@/types/chat';

const EMOJI_LIST = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '🤔', '👀', '✅', '💯', '🙏', '😍', '🚀', '💪', '👏', '😭'];

interface Props {
  onSend: (content: string, mentionedUsers?: string[]) => void;
  channelName: string;
  onTyping?: () => void;
  memberProfiles?: Record<string, MemberProfile>;
}

export function ChatInput({ onSend, channelName, onTyping, memberProfiles = {} }: Props) {
  const [content, setContent] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;

    // Extract mentioned user IDs
    const mentionRegex = /@(\w+)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(trimmed)) !== null) {
      const name = match[1];
      const member = Object.entries(memberProfiles).find(
        ([, p]) => p.name.toLowerCase().startsWith(name.toLowerCase())
      );
      if (member) mentions.push(member[0]);
    }

    onSend(trimmed, mentions.length > 0 ? mentions : undefined);
    setContent('');

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    inputRef.current?.focus();
  }, [content, onSend, memberProfiles]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
      return;
    }
  };

  const handleChange = (value: string) => {
    setContent(value);

    // Check for @mention trigger
    const lastAt = value.lastIndexOf('@');
    if (lastAt !== -1) {
      const afterAt = value.slice(lastAt + 1);
      if (!afterAt.includes(' ') && afterAt.length < 20) {
        setShowMentions(true);
        setMentionFilter(afterAt.toLowerCase());
        return;
      }
    }
    setShowMentions(false);

    // Typing indicator
    if (onTyping) {
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      onTyping();
      typingTimeout.current = setTimeout(() => {}, 2000);
    }
  };

  const insertMention = (name: string) => {
    const lastAt = content.lastIndexOf('@');
    if (lastAt !== -1) {
      setContent(content.slice(0, lastAt) + `@${name} `);
    }
    setShowMentions(false);
    inputRef.current?.focus();
  };

  const insertEmoji = (emoji: string) => {
    setContent(prev => prev + emoji);
    inputRef.current?.focus();
  };

  const insertFormat = (prefix: string, suffix: string) => {
    const textarea = inputRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.slice(start, end);
    const newContent = content.slice(0, start) + prefix + selected + suffix + content.slice(end);
    setContent(newContent);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, end + prefix.length);
    }, 0);
  };

  const filteredMembers = Object.entries(memberProfiles).filter(
    ([, p]) => p.name.toLowerCase().includes(mentionFilter)
  );

  return (
    <div className="px-4 pb-4 pt-1 shrink-0 relative">
      {/* @mention dropdown */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-1 bg-card border rounded-lg shadow-lg p-1 z-30 max-h-48 overflow-y-auto">
          {filteredMembers.map(([userId, profile]) => (
            <button
              key={userId}
              onClick={() => insertMention(profile.name.split(' ')[0])}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md hover:bg-muted text-sm transition-colors"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ backgroundColor: profile.avatar_color || '#6366f1' }}
              >
                {profile.name[0]?.toUpperCase()}
              </div>
              <span className="font-medium text-foreground">{profile.name}</span>
              <span className="text-muted-foreground text-xs ml-auto">{profile.role}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col bg-muted/30 border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
        {/* Format toolbar */}
        <div className="flex items-center gap-0.5 px-2 pt-1.5 pb-0">
          <button
            onClick={() => insertFormat('**', '**')}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Gras"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormat('*', '*')}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Italique"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormat('`', '`')}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Code"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-end gap-2 px-3 py-2">
          <button className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0 mb-0.5 transition-colors" title="Joindre un fichier">
            <Plus className="w-5 h-5" />
          </button>

          <textarea
            ref={inputRef}
            value={content}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Envoyer un message dans #${channelName}`}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/60 min-h-[24px] max-h-[120px] leading-relaxed"
            rows={1}
            onInput={e => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />

          <Popover>
            <PopoverTrigger asChild>
              <button className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0 mb-0.5 transition-colors" title="Émojis">
                <Smile className="w-5 h-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="end">
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_LIST.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => insertEmoji(emoji)}
                    className="p-1.5 rounded hover:bg-muted text-lg transition-transform hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {content.trim() && (
            <button
              onClick={handleSend}
              className="p-2 rounded-lg bg-primary text-primary-foreground shrink-0 mb-0.5 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-sm"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
