import type { Metadata } from "next";
import Script from "next/script";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import "./globals.css";

// Same typefaces as the public site: Bricolage Grotesque for headings, Inter for interface text.
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["600", "700", "800"] });
const sans = Inter({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "North Star AI OS",
  description: "Leads, CRM and revenue for AI voice and web development",
};

// Applies the saved theme before first paint to avoid a flash
const themeScript = `try{var t=localStorage.getItem('theme');if(t!=='light')document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${sans.variable} h-full`}>
      <body className="min-h-full">
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: themeScript }} />
        {children}
      </body>
    </html>
  );
}
