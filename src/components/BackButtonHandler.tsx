'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { runBackHandlers } from '@/lib/back-handler';

export default function BackButtonHandler() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let handle: { remove: () => Promise<void> } | undefined;

    const onBack = async ({ canGoBack }: { canGoBack: boolean }) => {
      if (runBackHandlers()) return;

      if (canGoBack) {
        window.history.back();
        return;
      }

      await App.minimizeApp();
    };

    App.addListener('backButton', onBack).then((l) => {
      handle = l;
    });

    return () => {
      handle?.remove();
    };
  }, []);

  return null;
}
