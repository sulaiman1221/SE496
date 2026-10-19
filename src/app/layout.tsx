import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { ThemeToggle } from "./theme-toggle";

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

// Applies the saved theme (or the system setting) before the page paints, so
// dark mode doesn't flash light on load.
const themeScript = `try {
  const saved = localStorage.getItem("theme");
  const dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = dark ? "dark" : "light";
} catch {}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The theme script sets data-theme before React loads.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="flex min-h-full flex-col font-sans text-[15px] leading-relaxed">
        <header className="border-b border-line">
          <div className="mx-auto grid h-16 w-full max-w-4xl grid-cols-[1fr_auto_1fr] items-center px-6">
            <Link href="/exams" className="font-medium tracking-tight">
              SE496 Exam Seating
            </Link>
            {/* The logo has a white background; multiply blends it into the
                header colour. In dark mode it sits on its own white tile. */}
            <Image
              src="/alfaisal-logo.png"
              alt="Alfaisal University"
              width={375}
              height={162}
              preload
              className="h-11 w-auto mix-blend-multiply dark:rounded-[4px] dark:mix-blend-normal"
            />
            <div className="justify-self-end">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-12">{children}</main>
      </body>
    </html>
  );
}
