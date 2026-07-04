import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  applicationName: "ResumeIQ",
  title: {
    default: "ResumeIQ — AI Resume Analyzer",
    template: "%s · ResumeIQ",
  },
  description:
    "Get recruiter-grade feedback on your resume in seconds: ATS score, keyword match against a job description, section-by-section grades, and specific rewrites.",
  keywords: ["resume analyzer", "ATS checker", "resume score", "AI resume review", "keyword match", "job description"],
  openGraph: {
    title: "ResumeIQ — AI Resume Analyzer",
    description:
      "Recruiter-grade resume feedback in seconds: ATS score, keyword match, section grades, and specific rewrites.",
    type: "website",
    siteName: "ResumeIQ",
  },
  twitter: {
    card: "summary_large_image",
    title: "ResumeIQ — AI Resume Analyzer",
    description: "Recruiter-grade resume feedback in seconds: ATS score, keyword match, and specific rewrites.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster richColors position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
