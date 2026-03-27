import {Link} from 'react-router-dom';
import {Home} from 'lucide-react';
import type {ReactNode} from 'react';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export function Layout({children, title}: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-white/10 bg-[var(--bg-color)]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-[var(--primary-color)] hover:text-white transition-colors"
            >
              <Home className="w-5 h-5" />
              <span className="font-medium">Hub</span>
            </Link>
            {title && (
              <span className="text-[var(--text-dim)]">/</span>
            )}
            {title && (
              <span className="text-[var(--text-main)] font-medium">{title}</span>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
