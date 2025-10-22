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
  plugins: {
    StatusBar: {
      style: 'dark', // 'light' or 'dark'
      backgroundColor: '#000000', // Match your app's theme
    },
    SplashScreen: {
      launchAutoHide: false,
      androidScaleType: 'CENTER_CROP',
    }
  }
};

export default config;
