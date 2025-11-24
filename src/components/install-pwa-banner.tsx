
'use client';
import { logger } from '@/lib/logger';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPwaBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setIsVisible(true); 
    };

    const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    
    if (!isRunningStandalone) {
      setIsIos(isIosDevice);
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      
      if(isIosDevice) {
          setIsVisible(true);
      }
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIos) {
      alert("To install, tap the Share button in your browser and then select 'Add to Home Screen'.");
      return;
    }
    if (!installPrompt) return;

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      logger.log('User accepted the A2HS prompt');
    } else {
      logger.log('User dismissed the A2HS prompt');
    }
    setInstallPrompt(null);
    setIsVisible(false);
  };

  const handleDismissClick = () => {
    setIsVisible(false);
  };
  
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 p-4 backdrop-blur-sm">
        <div className="container mx-auto flex items-center justify-between gap-4">
            <div className="flex-1">
                <p className="font-semibold">Get the Full Experience</p>
                <p className="text-sm text-muted-foreground">
                    Install the HYBRIDX.CLUB app on your device for quick access.
                </p>
            </div>
            <div className="flex items-center gap-2">
                 <Button onClick={handleInstallClick} size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    {isIos ? "Show Me How" : "Install"}
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismissClick}>
                    <X className="h-4 w-4" />
                    <span className="sr-only">Dismiss</span>
                </Button>
            </div>
        </div>
    </div>
  );
}
