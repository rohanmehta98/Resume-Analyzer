"use client";

import { useRef, useState } from "react";
import { ChevronDown, FileText, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MAX_FILE_BYTES, MAX_FILE_MB, MAX_JD_CHARS, MAX_ROLE_CHARS, MAX_TEXT_CHARS } from "@/lib/constants";
import { CAREER_FIELD_OPTIONS } from "@/lib/careers";
import { SAMPLE_RESUME, SAMPLE_ROLE } from "@/lib/sample-resume";

export interface AnalyzeInput {
  mode: "upload" | "paste";
  file: File | null;
  pastedText: string;
  targetRole: string;
  jobDescription: string;
  careerField: string;
}

export function UploadForm({ loading, onAnalyze }: { loading: boolean; onAnalyze: (input: AnalyzeInput) => void }) {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [careerField, setCareerField] = useState("auto");
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

  const ready = mode === "upload" ? Boolean(file) : pastedText.trim().length >= 100;

  function submit() {
    if (!ready || loading) return;
    onAnalyze({ mode, file, pastedText, targetRole, jobDescription, careerField });
  }

  function tryDemo() {
    const hasContent = mode === "paste" ? pastedText.trim().length > 0 : Boolean(file);
    if (hasContent && !window.confirm("Replace your current input with a sample resume?")) return;
    setMode("paste");
    setPastedText(SAMPLE_RESUME);
    setTargetRole(SAMPLE_ROLE);
    setFile(null);
    onAnalyze({
      mode: "paste",
      file: null,
      pastedText: SAMPLE_RESUME,
      targetRole: SAMPLE_ROLE,
      jobDescription: "",
      careerField: "auto",
    });
  }

  return (
    <Card className="w-full">
      <CardContent className="space-y-5">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "upload" | "paste")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload file</TabsTrigger>
            <TabsTrigger value="paste">Paste text</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-3">
            <div
              role="button"
              tabIndex={0}
              aria-label="Upload resume file"
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  inputRef.current?.click();
                }
              }}
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
                "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                Drop a resume here, or <span className="text-primary">browse</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">PDF, DOCX, or TXT · up to {MAX_FILE_MB} MB</p>
            </div>

            {file && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-primary" />
                <span className="flex-1 truncate font-medium">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</span>
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

          <TabsContent value="paste" className="mt-3">
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value.slice(0, MAX_TEXT_CHARS))}
              placeholder="Paste the full resume text…"
              aria-label="Resume text"
              className="min-h-44 resize-y"
            />
            <p className="mt-1.5 text-right text-xs text-muted-foreground tabular-nums">
              {pastedText.trim().length < 100 && pastedText.length > 0
                ? "Paste at least 100 characters"
                : `${pastedText.length.toLocaleString()} characters`}
            </p>
          </TabsContent>
        </Tabs>

        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <div className="space-y-2">
            <Label htmlFor="role">
              Target role <span className="font-normal text-muted-foreground">(recommended)</span>
            </Label>
            <Input
              id="role"
              value={targetRole}
              maxLength={MAX_ROLE_CHARS}
              onChange={(e) => setTargetRole(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="e.g. ICU Nurse, Financial Analyst, Backend Engineer"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="field">Career field</Label>
            <div className="relative">
              <select
                id="field"
                value={careerField}
                onChange={(e) => setCareerField(e.target.value)}
                className="h-8 w-full appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                <option value="auto">Auto-detect</option>
                {CAREER_FIELD_OPTIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>
        </div>

        <div className="rounded-lg border">
          <button
            type="button"
            onClick={() => setShowJd((s) => !s)}
            aria-expanded={showJd}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium"
          >
            <span>
              Job description{" "}
              <span className="font-normal text-muted-foreground">
                {jobDescription.trim() ? "· added" : "(optional — enables requirement matching)"}
              </span>
            </span>
            <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", showJd && "rotate-180")} />
          </button>
          {showJd && (
            <div className="px-4 pb-4">
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value.slice(0, MAX_JD_CHARS))}
                placeholder="Paste the job posting to score requirement-by-requirement fit…"
                aria-label="Job description"
                className="min-h-36 resize-y"
              />
              <p className="mt-1.5 text-right text-xs text-muted-foreground tabular-nums">
                {jobDescription.length.toLocaleString()} / {MAX_JD_CHARS.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        <Button size="lg" className="w-full" disabled={!ready || loading} onClick={submit}>
          {loading ? "Analyzing…" : "Analyze resume"}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          No resume handy?{" "}
          <button
            type="button"
            onClick={tryDemo}
            disabled={loading}
            className="font-medium text-foreground underline-offset-4 hover:underline disabled:opacity-50"
          >
            Try a sample
          </button>
        </p>
      </CardContent>
    </Card>
  );
}
