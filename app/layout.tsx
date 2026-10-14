import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ART TO INK — Original Tattoo Art",
  description: "Original tattoo artwork by Kateřina Pohnetalová. Discover the same shape, a new story.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://art-to-ink.vercel.app"),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
