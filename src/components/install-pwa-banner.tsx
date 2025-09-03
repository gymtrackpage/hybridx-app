'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

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
    };

    const isRunningStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

    if (!isRunningStandalone) {
        setIsIos(isIosDevice);
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        // Show banner for iOS or if the prompt event is available
        if (isIosDevice || installPrompt) {
            setIsVisible(true);
        }
    }
    
    // Show banner immediately if prompt is already available
    if(installPrompt && !isRunningStandalone) {
        setIsVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [installPrompt]);


  const handleInstallClick = async () => {
    if (!installPrompt) {
        // This case is for iOS where we just show instructions
        alert("To install, tap the Share button and then 'Add to Home Screen'.");
        return;
    };
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the A2HS prompt');
    } else {
      console.log('User dismissed the A2HS prompt');
    }
    setInstallPrompt(null);
    setIsVisible(false);
  };

  const handleDismissClick = () => {
    setIsVisible(false);
  };
  
  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
        <Alert>
            <AlertTitle className="flex items-center justify-between">
                <span>Install the App</span>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismissClick}>
                    <X className="h-4 w-4" />
                </Button>
            </AlertTitle>
            <AlertDescription className="pr-8">
                {isIos 
                    ? "Get the full experience. Add this app to your home screen."
                    : "Get the full experience. Install HYBRIDX.CLUB on your device."
                }
            </AlertDescription>
            <div className="mt-4 flex justify-end">
                <Button onClick={handleInstallClick} disabled={!installPrompt && !isIos}>
                    <Download className="mr-2 h-4 w-4" />
                    {isIos ? "Show me how" : "Install"}
                </Button>
            </div>
        </Alert>
    </div>
  );
}
