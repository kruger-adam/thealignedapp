import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { AuthProvider } from '@/contexts/auth-context';
import { Header } from '@/components/header';
import { InstallPrompt } from '@/components/install-prompt';
import { ToastProvider } from '@/components/ui/toast';
import { AIAssistantProvider, AIAssistantFAB, AIAssistantPanel } from '@/components/ai-assistant';
import './globals.css';

const instrumentSans = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Aligned - Discover What People Think',
  description: 'A modern polling platform to track opinions, find common ground, and understand where people stand on issues that matter.',
  keywords: ['polling', 'opinions', 'yes', 'no', 'voting', 'social'],
  manifest: '/manifest.json',
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo-transparent.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Aligned',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${instrumentSans.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="apple-touch-icon" href="/logo-transparent.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#18181b" />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {/* Inline splash screen - renders before JS/CSS loads */}
        <div
          id="splash-screen"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#09090b',
            transition: 'opacity 0.3s ease-out',
          }}
        >
          <img
            src="/logo-transparent.png"
            alt=""
            width={80}
            height={80}
            style={{
              width: 80,
              height: 80,
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.7; transform: scale(0.95); }
            }
          `}} />
        </div>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('load', function() {
                var splash = document.getElementById('splash-screen');
                if (splash) {
                  splash.style.opacity = '0';
                  setTimeout(function() { splash.remove(); }, 300);
                }
              });
            `,
          }}
        />
        <AuthProvider>
          <AIAssistantProvider>
            <ToastProvider>
              <Header />
              <main>{children}</main>
              <InstallPrompt />
              <AIAssistantFAB />
              <AIAssistantPanel />
            </ToastProvider>
          </AIAssistantProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
