import React, { useEffect, useCallback, useRef, useState, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import { Table } from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  List, ListOrdered, Quote, Code, Heading1, Heading2,
  Link as LinkIcon, Image as ImageIcon, Table as TableIcon,
  Highlighter, Palette, Undo, Redo, Minus, Mic, MicOff
} from 'lucide-react';
import { toast } from 'sonner';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  onBlur?: (html: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  minimal?: boolean;
  onSubmit?: () => void;
  autofocus?: boolean;
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280',
];

const ToolbarButton = forwardRef<HTMLButtonElement, {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}>(({ active, onClick, title, children, disabled }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
        if (!disabled) onClick();
      }}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors shrink-0 ${
        active
          ? 'bg-primary/15 text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      } disabled:opacity-40 disabled:pointer-events-none`}
    >
      {children}
    </button>
  );
});

ToolbarButton.displayName = 'ToolbarButton';

export default function RichTextEditor({
  content,
  onChange,
  onBlur,
  placeholder = 'Commencez à écrire...',
  className = '',
  editorClassName = '',
  minimal = false,
  onSubmit,
  autofocus = false,
}: RichTextEditorProps) {
  const lastSyncedContentRef = useRef(content);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: !minimal ? {} : false,
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-primary underline cursor-pointer' } }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      ...(minimal
        ? []
        : [
            Table.configure({ resizable: true }),
            TableRow,
            TableCell,
            TableHeader,
            Image.configure({ inline: true }),
          ]),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editorProps: {
      attributes: {
        class: `tiptap prose prose-sm dark:prose-invert max-w-none focus:outline-none ${editorClassName}`,
      },
      handleKeyDown: (_view, event) => {
        if (onSubmit && event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
          if (!(event as KeyboardEvent & { isComposing?: boolean }).isComposing) {
            event.preventDefault();
            onSubmit();
            return true;
          }
        }
        return false;
      },
    },
    onCreate: ({ editor }) => {
      lastSyncedContentRef.current = editor.getHTML();
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      lastSyncedContentRef.current = html;
      onChange(html);
    },
    onBlur: ({ editor }) => {
      onBlur?.(editor.getHTML());
    },
    autofocus,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
  });

  useEffect(() => {
    if (!editor) return;

    const currentHtml = editor.getHTML();
    if (content === currentHtml || content === lastSyncedContentRef.current) return;

    if (editor.isFocused) return;

    editor.commands.setContent(content || '<p></p>', { emitUpdate: false });
    lastSyncedContentRef.current = editor.getHTML();
  }, [content, editor]);

  const addLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL du lien :', previousUrl || '');

    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  }, [editor]);

  const addImage = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("URL de l'image :");
    if (url?.trim()) {
      editor.chain().focus().setImage({ src: url.trim() }).run();
    }
  }, [editor]);

  const addTable = useCallback(() => {
    if (!editor) return;
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  // Voice dictation (Web Speech API) — optimisée mobile/iOS
  const recognitionRef = useRef<any>(null);
  const shouldRestartRef = useRef(false);
  const manualStopRef = useRef(false);
  const interimTextRef = useRef('');
  const [isDictating, setIsDictating] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  // Audio level meter (Web Audio API)
  const audioStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const [audioLevel, setAudioLevel] = useState(0); // 0..1

  // Détection iOS (Safari iOS gère mal `continuous: true`)
  const isIOS =
    typeof navigator !== 'undefined' &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1));

  const stopDictation = useCallback(() => {
    manualStopRef.current = true;
    shouldRestartRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
  }, []);

  const startRecognition = useCallback(() => {
    if (!editor) return;
    const SpeechRecognition: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'fr-FR';
    // iOS Safari : sessions courtes, pas de continuous
    recognition.continuous = !isIOS;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let finalText = '';
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      if (finalText.trim()) {
        const needsSpace = !editor.isEmpty;
        editor.chain().focus().insertContent((needsSpace ? ' ' : '') + finalText.trim()).run();
        interimTextRef.current = '';
        setInterimTranscript('');
      } else {
        interimTextRef.current = interim;
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        toast.error("Accès au microphone refusé. Autorisez le micro dans les paramètres du navigateur (iOS : Réglages › Safari › Microphone).");
        shouldRestartRef.current = false;
      } else if (event.error === 'no-speech') {
        // sur iOS, normal en fin de session — on relance silencieusement
      } else if (event.error === 'audio-capture') {
        toast.error("Aucun microphone détecté.");
        shouldRestartRef.current = false;
      } else if (event.error !== 'aborted') {
        toast.error(`Erreur de dictée : ${event.error}`);
      }
    };

    recognition.onend = () => {
      // Auto-restart sur iOS pour simuler le mode continu, sauf si arrêt manuel
      if (shouldRestartRef.current && !manualStopRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          // ignore — on retombe sur l'arrêt
        }
      }
      recognitionRef.current = null;
      setIsDictating(false);
      setInterimTranscript('');
      interimTextRef.current = '';
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.error('Failed to start recognition:', e);
      toast.error("Impossible de démarrer la dictée.");
      setIsDictating(false);
      shouldRestartRef.current = false;
    }
  }, [editor, isIOS]);

  const toggleDictation = useCallback(async () => {
    if (!editor) return;
    const SpeechRecognition: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("La dictée vocale n'est pas supportée par ce navigateur (essayez Chrome, Edge ou Safari récent).");
      return;
    }

    if (isDictating) {
      stopDictation();
      return;
    }

    // Pré-demande de permission micro (améliore l'UX iOS et Android)
    if (navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Libère immédiatement — la reconnaissance vocale gère son propre flux
        stream.getTracks().forEach((t) => t.stop());
      } catch (e: any) {
        toast.error("Accès au microphone refusé. Vérifiez les permissions du navigateur.");
        return;
      }
    }

    manualStopRef.current = false;
    shouldRestartRef.current = true;
    setIsDictating(true);
    setInterimTranscript('');
    toast.success('🎤 Dictée en cours… Parlez maintenant.');
    startRecognition();
  }, [editor, isDictating, startRecognition, stopDictation]);

  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      manualStopRef.current = true;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  if (!editor) return null;

  const iconSize = 'w-3.5 h-3.5';

  return (
    <div className={`border border-border rounded-lg overflow-hidden bg-background ${className}`}>
      <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-border bg-muted/30">
        <ToolbarButton active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras">
          <Bold className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique">
          <Italic className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()} title="Souligné">
          <UnderlineIcon className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Barré">
          <Strikethrough className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolbarButton active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste à puces">
          <List className={iconSize} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numérotée">
          <ListOrdered className={iconSize} />
        </ToolbarButton>

        {!minimal && (
          <>
            <div className="w-px h-4 bg-border mx-1" />
            <ToolbarButton active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} title="Titre 1">
              <Heading1 className={iconSize} />
            </ToolbarButton>
            <ToolbarButton active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titre 2">
              <Heading2 className={iconSize} />
            </ToolbarButton>
            <ToolbarButton active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citation">
              <Quote className={iconSize} />
            </ToolbarButton>
            <ToolbarButton active={editor.isActive('codeBlock')} onClick={() => editor.chain().focus().toggleCodeBlock().run()} title="Bloc de code">
              <Code className={iconSize} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Séparateur">
              <Minus className={iconSize} />
            </ToolbarButton>
          </>
        )}

        <div className="w-px h-4 bg-border mx-1" />

        <ToolbarButton active={editor.isActive('link')} onClick={addLink} title="Lien">
          <LinkIcon className={iconSize} />
        </ToolbarButton>

        {!minimal && (
          <>
            <ToolbarButton onClick={addImage} title="Image">
              <ImageIcon className={iconSize} />
            </ToolbarButton>
            <ToolbarButton onClick={addTable} title="Tableau">
              <TableIcon className={iconSize} />
            </ToolbarButton>
          </>
        )}

        <div className="w-px h-4 bg-border mx-1" />

        <div className="relative group">
          <ToolbarButton onClick={() => editor.chain().focus().run()} title="Couleur du texte">
            <Palette className={iconSize} />
          </ToolbarButton>
          <div className="absolute top-full left-0 mt-1 hidden group-hover:flex gap-1 p-1.5 bg-card border border-border rounded-lg shadow-lg z-30">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => editor.chain().focus().setColor(color).run()}
                className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => editor.chain().focus().unsetColor().run()}
              className="w-5 h-5 rounded-full border border-border bg-background text-[8px] flex items-center justify-center hover:scale-110 transition-transform"
              title="Par défaut"
            >
              ✕
            </button>
          </div>
        </div>

        <ToolbarButton
          active={editor.isActive('highlight')}
          onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
          title="Surligner"
        >
          <Highlighter className={iconSize} />
        </ToolbarButton>

        <div className="w-px h-4 bg-border mx-1" />

        <ToolbarButton
          active={isDictating}
          onClick={toggleDictation}
          title={isDictating ? 'Arrêter la dictée' : 'Dicter (microphone)'}
        >
          {isDictating ? (
            <MicOff className={`${iconSize} text-priority-urgent animate-pulse`} />
          ) : (
            <Mic className={iconSize} />
          )}
        </ToolbarButton>

        {!minimal && (
          <>
            <div className="flex-1" />
            <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Annuler">
              <Undo className={iconSize} />
            </ToolbarButton>
            <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Refaire">
              <Redo className={iconSize} />
            </ToolbarButton>
          </>
        )}
      </div>

      {isDictating && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 px-3 py-1.5 bg-priority-urgent/10 border-b border-priority-urgent/20 text-priority-urgent text-xs"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-priority-urgent opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-priority-urgent" />
          </span>
          <span className="font-medium shrink-0">Dictée en cours…</span>
          {interimTranscript && (
            <span className="italic text-muted-foreground truncate">« {interimTranscript} »</span>
          )}
          <button
            type="button"
            onClick={stopDictation}
            className="ml-auto px-2 py-0.5 rounded bg-priority-urgent text-white text-[10px] font-semibold hover:opacity-90 shrink-0"
          >
            Arrêter
          </button>
        </div>
      )}

      <EditorContent editor={editor} className="px-3 py-2 min-h-[60px] max-h-64 overflow-y-auto scrollbar-thin" />
    </div>
  );
}

export function RichTextDisplay({ content, className = '' }: { content: string; className?: string }) {
  if (!content || content === '<p></p>') return null;

  return (
    <div
      className={`prose prose-sm dark:prose-invert max-w-none [&>p]:my-1 [&>ul]:my-1 [&>ol]:my-1 [&_a]:text-primary [&_a]:underline ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
