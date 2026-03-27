import {Loader2} from 'lucide-react';

export function SuspenseFallback() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
        <p className="text-[var(--text-dim)]">Loading...</p>
      </div>
    </div>
  );
}
