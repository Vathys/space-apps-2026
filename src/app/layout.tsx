import type { Metadata } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// The pitch's type: Archivo (variable width, for the condensed-to-wide display headings) and IBM Plex Mono for numbers
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "LunaNav",
  description: "Lunar south-pole communication planner: direct-to-Earth vs relay-assisted",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      // The theme script below may drop "dark" before React hydrates
      suppressHydrationWarning
      className={`dark ${archivo.variable} ${plexMono.variable} h-full antialiased motion-safe:scroll-smooth`}
    >
      <head>
        {/* Before paint: the viewer's saved theme (light or dark; dark when none or storage is blocked) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("lunanav.theme")==="light")document.documentElement.classList.remove("dark")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
