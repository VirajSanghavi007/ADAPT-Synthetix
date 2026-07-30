import type { Metadata } from "next";
import Script from "next/script";
import { Noto_Sans, Figtree } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import CookieConsent from "@/components/CookieConsent";
import ContentGuard from "@/components/ContentGuard";

const bodyFont = Noto_Sans({
  variable: "--font-body",
  subsets: ["latin"],
});

const headingFont = Figtree({
  variable: "--font-heading",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mercury",
  description: "ASR / TTS demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", bodyFont.variable, headingFont.variable)}
      suppressHydrationWarning
    >
      <head>
        <Script
          id="mercury-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mercury-theme');if(t&&t!=='system'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <TooltipProvider>{children}</TooltipProvider>
        <CookieConsent />
        <ContentGuard />
      </body>
    </html>
  );
}
