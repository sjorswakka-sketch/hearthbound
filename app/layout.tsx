import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hearthbound — A world you share",
  description: "Gather your party. A shared visual fantasy tabletop with a living map, dice, and a Game Master.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
