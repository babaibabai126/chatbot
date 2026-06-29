'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function getIsIOS(): boolean {
  if (typeof window === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const isIOS = getIsIOS();

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as unknown as { standalone: boolean }).standalone;

    if (standalone) return;

    // Android/Chrome install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // For iOS, show after delay
    if (isIOS) {
      const timer = setTimeout(() => setShowPrompt(true), 5000);
      return () => clearTimeout(timer);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, [isIOS]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80 animate-in slide-in-from-bottom-4 duration-300">
      <Card className="p-4 shadow-xl border-emerald-200 bg-white">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
            <Smartphone className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">অ্যাপ ইনস্টল করুন</p>
              <button
                onClick={() => setShowPrompt(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {isIOS
                ? 'Safari তে Share → "Add to Home Screen" ক্লিক করুন'
                : 'ফোনে ইনস্টল করে অফলাইনেও ব্যবহার করুন'}
            </p>
            {!isIOS && (
              <Button
                onClick={handleInstall}
                size="sm"
                className="mt-2 w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 h-8 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                ইনস্টল / Install App
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
