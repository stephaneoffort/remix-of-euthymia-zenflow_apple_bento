import { useEffect, useCallback } from 'react';

interface ShortcutHandlers {
  onNewTask?: () => void;
  onClosePanel?: () => void;
  onOpenSearch?: () => void;
  onToggleHelp?: () => void;
}

export function useKeyboardShortcuts({ onNewTask, onClosePanel, onOpenSearch, onToggleHelp }: ShortcutHandlers) {
  const handler = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;

    // Escape always works — close panels
    if (e.key === 'Escape') {
      onClosePanel?.();
      return;
    }

    // Don't trigger shortcuts while typing in inputs
    if (isInput) return;

    // ? → help dialog
    if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      onToggleHelp?.();
      return;
    }

    // n → new task
    if (e.key === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      onNewTask?.();
      return;
    }

    // / → open search (alternative to Cmd+K)
    if (e.key === '/' && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      onOpenSearch?.();
      return;
    }
  }, [onNewTask, onClosePanel, onOpenSearch, onToggleHelp]);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}

export const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Rechercher' },
  { keys: ['/'], label: 'Rechercher (alt)' },
  { keys: ['N'], label: 'Nouvelle tâche' },
  { keys: ['Esc'], label: 'Fermer le panneau' },
  { keys: ['?'], label: 'Aide raccourcis' },
];
