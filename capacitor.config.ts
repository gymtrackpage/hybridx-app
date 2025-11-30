import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'club.hybridx.app',
  appName: 'HYBRIDX.CLUB',
  webDir: 'out',
  server: {
    url: 'https://app.hybridx.club',
    cleartext: false, // Use HTTPS only
  },
  android: {
    allowMixedContent: false, // All traffic over HTTPS
  },
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    StatusBar: {
      style: 'light', // 'light' for dark icons, 'dark' for light icons
      backgroundColor: '#FFFFFF', // Match your app's light theme header
      overlay: false, // CRITICAL: Don't overlay content, push it down
    },
    SplashScreen: {
      launchAutoHide: false,
      androidScaleType: 'CENTER_CROP',
    }
  }
};

export default config;
