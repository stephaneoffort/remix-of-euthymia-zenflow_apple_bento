import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { WifiOff } from 'lucide-react';

export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-destructive-foreground text-sm font-medium animate-in slide-in-from-top duration-300">
      <WifiOff className="w-4 h-4" />
      Mode hors-ligne — Les modifications ne seront pas enregistrées
    </div>
  );
}
