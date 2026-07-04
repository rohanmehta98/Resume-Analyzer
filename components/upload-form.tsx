"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, X, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MAX_FILE_BYTES, MAX_FILE_MB } from "@/lib/constants";
import { SAMPLE_RESUME, SAMPLE_ROLE } from "@/lib/sample-resume";

export interface AnalyzeInput {
  file: File | null;
  pastedText: string;
  targetRole: string;
  jobDescription: string;
  mode: "upload" | "paste";
}

export function UploadForm({ loading, onAnalyze }: { loading: boolean; onAnalyze: (input: AnalyzeInput) => void }) {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [dragging, setDragging] = useState(false);
  const [showJd, setShowJd] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile(f: File | undefined | null) {
    if (!f) return;
    if (!/\.(pdf|docx|txt)$/i.test(f.name)) {
      toast.error("Please upload a PDF, DOCX, or TXT file.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      toast.error(`That file is over ${MAX_FILE_MB} MB. Please upload a smaller file.`);
      return;
    }
    setFile(f);
  }

  const ready = mode === "upload" ? Boolean(file) : pastedText.trim().length > 40;

  function tryDemo() {
    setMode("paste");
    setPastedText(SAMPLE_RESUME);
    setTargetRole(SAMPLE_ROLE);
    setFile(null);
    onAnalyze({ file: null, pastedText: SAMPLE_RESUME, targetRole: SAMPLE_ROLE, jobDescription: "", mode: "paste" });
  }

  return (
    <Card className="mx-auto w-full max-w-2xl">
      <CardContent className="space-y-5">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "upload" | "paste")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="paste">Paste text</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                dragging ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-accent/50"
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <UploadCloud className="mb-3 h-8 w-8 text-primary" />
              <p className="text-sm font-medium">
                Drop your resume here, or <span className="text-primary">browse</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, or TXT · max {MAX_FILE_MB} MB</p>
            </div>

            {file && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm">
                <FileText className="h-4 w-4 text-primary" />
                <span className="flex-1 truncate font-medium">{file.name}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  aria-label="Remove file"
                  onClick={() => {
                    setFile(null);
                    if (inputRef.current) inputRef.current.value = "";
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="paste" className="mt-4">
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste the full text of your resume here…"
              aria-label="Resume text"
              className="min-h-40 resize-y"
            />
          </TabsContent>
        </Tabs>

        <div className="space-y-2">
          <Label htmlFor="role">
            Target role <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="role"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="e.g. Senior Software Engineer"
          />
        </div>

        <div className="rounded-lg border">
          <button
            type="button"
            onClick={() => setShowJd((s) => !s)}
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium"
          >
            <span>
              Add a job description <span className="font-normal text-muted-foreground">(optional — enables match scoring)</span>
            </span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", showJd && "rotate-180")} />
          </button>
          {showJd && (
            <div className="px-4 pb-4">
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description to score how well your resume matches it…"
                aria-label="Job description"
                className="min-h-32 resize-y"
              />
            </div>
          )}
        </div>

        <Button
          size="lg"
          className="w-full"
          disabled={!ready || loading}
          onClick={() => onAnalyze({ file, pastedText, targetRole, jobDescription, mode })}
        >
          {loading ? "Analyzing…" : "Analyze resume"}
        </Button>

        <button
          type="button"
          onClick={tryDemo}
          disabled={loading}
          className="w-full text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
        >
          No resume handy? Try a sample →
        </button>
      </CardContent>
    </Card>
  );
}
