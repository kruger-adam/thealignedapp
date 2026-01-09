import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aligned.app',
  appName: 'Aligned',
  webDir: 'out',
  server: {
    // TODO: Update this to your production URL so API routes work
    // The native app will load from this URL instead of bundled files
    url: process.env.CAPACITOR_SERVER_URL || 'https://thealignedapp.com',
    cleartext: false,
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'Aligned',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#18181b',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
