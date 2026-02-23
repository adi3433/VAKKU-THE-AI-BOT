import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vaakku — Voter Information Assistant | SVEEP Kottayam",
  description:
    "Vaakku is a bilingual (Malayalam + English) AI voter information assistant for Kottayam district. Check registration, locate polling booths, and report violations.",
  keywords: ["voter", "SVEEP", "Kottayam", "election", "polling booth", "Kerala", "Malayalam"],
  openGraph: {
    title: "Vaakku — Voter Information Assistant",
    description: "Your impartial voter information assistant for Kottayam district.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-[var(--color-neutral-50)] text-[var(--color-neutral-900)]">
        {children}
      </body>
    </html>
  );
}
