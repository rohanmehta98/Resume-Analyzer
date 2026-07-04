import { FileSearch } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Analyzer } from "@/components/analyzer";

export default function Home() {
  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <FileSearch className="h-4 w-4" />
            </span>
            <span className="text-base font-semibold tracking-tight">ResumeIQ</span>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <Analyzer />
      </main>

      <footer className="border-t py-6 print:hidden">
        <div className="mx-auto w-full max-w-6xl px-4 text-center text-sm text-muted-foreground sm:px-6">
          ResumeIQ · Your resume is processed in memory and never stored.
        </div>
      </footer>
    </>
  );
}
