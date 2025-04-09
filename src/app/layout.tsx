import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://taivas.komakallio.fi"),
  title: "Komakallio Observatory",
  description: "Live view from Komakallio, Kirkkonummi, Finland",
  openGraph: {
    title: "Komakallio Observatory",
    description: "Live view from Komakallio, Kirkkonummi, Finland",
    images: [
      {
        url: "/images/latest.jpg",
        width: 1200,
        height: 1200,
        alt: "Latest image from Komakallio Observatory",
      },
    ],
    type: "website",
    siteName: "Komakallio Observatory",
  },
  twitter: {
    card: "summary_large_image",
    title: "Komakallio Observatory",
    description: "Live view from Komakallio, Kirkkonummi, Finland",
    images: ["/images/latest.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <Navbar />
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}
