import { useState, useRef, KeyboardEvent, useCallback, ChangeEvent } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Plus, Smile, Send, Bold, Italic, Code, Paperclip, Image, FileText } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { MemberProfile } from '@/types/chat';

const EMOJI_LIST = ['😊', '😂', '❤️', '👍', '🎉', '🔥', '🤔', '👀', '✅', '💯', '🙏', '😍', '🚀', '💪', '👏', '😭'];

interface MentionableMember {
  id: string;
  name: string;
  avatar_color: string;
  role: string;
}

interface Props {
  onSend: (content: string, mentionedUsers?: string[]) => void;
  channelName: string;
  onTyping?: () => void;
  memberProfiles?: Record<string, MemberProfile>;
  allMembers?: MentionableMember[];
  onFileUpload?: (file: File) => void;
}

export function ChatInput({ onSend, channelName, onTyping, memberProfiles = {}, allMembers = [], onFileUpload }: Props) {
  const [content, setContent] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useIsMobile();

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;

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

  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (onFileUpload) {
      onFileUpload(file);
    } else {
      // Default: insert file name as message
      onSend(`📎 ${file.name}`);
    }
    e.target.value = '';
  }, [onFileUpload, onSend]);

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

  // Use allMembers for mention dropdown, fallback to memberProfiles
  const mentionSource: { id: string; name: string; avatar_color: string; role: string }[] = allMembers.length > 0
    ? allMembers
    : Object.entries(memberProfiles).map(([id, p]) => ({ id, name: p.name, avatar_color: p.avatar_color, role: p.role }));

  const filteredMembers = mentionSource.filter(
    m => m.name.toLowerCase().includes(mentionFilter)
  );

  return (
    <div className="px-4 pb-4 pt-2 shrink-0 relative">
      {/* @mention dropdown */}
      {showMentions && filteredMembers.length > 0 && (
        <div className="absolute bottom-full left-4 right-4 mb-2 backdrop-blur-xl bg-card/70 border border-border/30 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)] p-1.5 z-30 max-h-48 overflow-y-auto">
          {filteredMembers.map((member) => (
            <button
              key={member.id}
              onClick={() => insertMention(member.name.split(' ')[0])}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted/40 text-sm transition-all"
            >
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                style={{ backgroundColor: member.avatar_color || '#6366f1' }}
              >
                {member.name[0]?.toUpperCase()}
              </div>
              <span className="font-medium text-foreground">{member.name}</span>
              <span className="text-muted-foreground/60 text-xs ml-auto">{member.role}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col backdrop-blur-xl bg-card/30 border border-border/30 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/15 focus-within:border-primary/30 transition-all shadow-[0_4px_20px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.05)]">
        {/* Format toolbar */}
        <div className="flex items-center gap-0.5 px-3 pt-2.5 pb-0">
          <button
            onClick={() => insertFormat('**', '**')}
            className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground transition-all"
            title="Gras"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormat('*', '*')}
            className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground transition-all"
            title="Italique"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => insertFormat('`', '`')}
            className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground/60 hover:text-foreground transition-all"
            title="Code"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-end gap-2 px-3 py-2.5">
          <Popover>
            <PopoverTrigger asChild>
              <button className="p-1.5 rounded-xl hover:bg-muted/40 text-muted-foreground/60 shrink-0 mb-0.5 transition-all" title="Joindre">
                <Plus className="w-5 h-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1.5 backdrop-blur-xl bg-card/80 border-border/30" side="top" align="start">
              <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted/40 text-sm cursor-pointer transition-all">
                <Image className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">Image</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
              </label>
              <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted/40 text-sm cursor-pointer transition-all">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">Document</span>
                <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip" className="hidden" onChange={handleFileSelect} />
              </label>
              <label className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-muted/40 text-sm cursor-pointer transition-all">
                <Paperclip className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">Fichier</span>
                <input type="file" className="hidden" onChange={handleFileSelect} />
              </label>
            </PopoverContent>
          </Popover>

          <textarea
            ref={inputRef}
            value={content}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={channelName ? `Écrire dans #${channelName}...` : 'Écrire un message...'}
            className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-foreground placeholder:text-muted-foreground/40 min-h-[24px] max-h-[120px] leading-relaxed"
            rows={1}
            onInput={e => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />

          <Popover>
            <PopoverTrigger asChild>
              <button className="p-1.5 rounded-xl hover:bg-muted/40 text-muted-foreground/60 shrink-0 mb-0.5 transition-all" title="Émojis">
                <Smile className="w-5 h-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2 backdrop-blur-xl bg-card/80 border-border/30" align="end">
              <div className="grid grid-cols-8 gap-1">
                {EMOJI_LIST.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => insertEmoji(emoji)}
                    className="p-1.5 rounded-lg hover:bg-muted/40 text-lg transition-transform hover:scale-125 active:scale-95"
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
              className="p-2.5 rounded-xl bg-primary text-primary-foreground shrink-0 mb-0.5 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 shadow-[0_4px_16px_hsl(var(--primary)/0.3)]"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
