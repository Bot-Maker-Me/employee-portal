import type { Metadata, Viewport } from "next";
import "./globals.css";
import { jetbrainsMono, manrope, playfair } from "@/lib/fonts";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";

export const metadata: Metadata = {
  title: "Employee Portal",
  description:
    "Secure internal messaging and pharmacy chat channels for pharmacy teams.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: {
    capable: true,
    title: "Employee Portal",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1020",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${playfair.variable} ${manrope.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        {/* Decorative only: the slowly flowing silk backdrop. */}
        <div className="silk" aria-hidden="true">
          <span className="silk-1" />
          <span className="silk-2" />
          <span className="silk-3" />
          <span className="silk-4" />
          <span className="silk-sheen" />
          <span className="silk-weave" />
        </div>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
