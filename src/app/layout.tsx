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
      className={`dark ${archivo.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
