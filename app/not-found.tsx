import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <span className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <FileQuestion className="h-6 w-6" />
      </span>
      <h1 className="text-3xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link href="/" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
        Back to ResumeIQ
      </Link>
    </main>
  );
}
