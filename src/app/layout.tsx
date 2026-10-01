import type { Metadata } from "next";
import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Exam Seating",
  description: "Exam seating plans and RFID attendance",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans text-[15px] leading-relaxed">
        <header className="border-b border-line">
          <div className="mx-auto flex h-14 w-full max-w-4xl items-center px-6">
            <Link href="/exams" className="font-medium tracking-tight">
              Exam Seating
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">{children}</main>
      </body>
    </html>
  );
}
