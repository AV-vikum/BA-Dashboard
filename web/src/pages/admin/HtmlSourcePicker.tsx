import { REPORT_MAX_BYTES } from '@ba/shared';
import { Upload } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { byteLength } from '@/lib/firestore/admin-helpers';

function formatBytes(n: number): string {
  return `${(n / 1000).toFixed(0)} KB`;
}

// File picker / drag-and-drop or a paste textarea, tabbed. Reports the
// chosen HTML (or null) and its size to the caller, who decides what to do
// with it (create vs replace) — used by both New report and Replace HTML.
export function HtmlSourcePicker({
  html,
  onChange,
}: {
  html: string | null;
  onChange: (html: string | null) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteId = useId();

  const sizeBytes = html !== null ? byteLength(html) : 0;
  const tooLarge = html !== null && sizeBytes > REPORT_MAX_BYTES;

  async function loadFile(file: File) {
    setError(null);
    if (!file.name.toLowerCase().endsWith('.html')) {
      setError('Please choose an .html file.');
      return;
    }
    const text = await file.text();
    if (byteLength(text) > REPORT_MAX_BYTES) {
      setError(
        `That file is ${formatBytes(byteLength(text))}, over the ${formatBytes(REPORT_MAX_BYTES)} limit.`,
      );
      setFileName(file.name);
      onChange(null);
      return;
    }
    setFileName(file.name);
    onChange(text);
  }

  return (
    <div className="flex flex-col gap-2">
      <Tabs defaultValue="file">
        <TabsList>
          <TabsTrigger value="file">Upload file</TabsTrigger>
          <TabsTrigger value="paste">Paste HTML</TabsTrigger>
        </TabsList>

        <TabsContent value="file">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files[0];
              if (file) void loadFile(file);
            }}
            className={`flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
              dragOver ? 'border-ring bg-muted/50' : 'border-input hover:bg-muted/30'
            }`}
          >
            <Upload className="size-6 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm">
              {fileName ?? 'Drag an .html file here, or click to choose one'}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,text/html"
            className="sr-only"
            aria-label="Choose an HTML file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void loadFile(file);
              e.target.value = '';
            }}
          />
        </TabsContent>

        <TabsContent value="paste">
          <Label htmlFor={pasteId} className="sr-only">
            Report HTML
          </Label>
          <Textarea
            id={pasteId}
            value={html ?? ''}
            onChange={(e) => {
              setError(null);
              setFileName(null);
              onChange(e.target.value || null);
            }}
            placeholder="<!doctype html>…"
            className="min-h-40 font-mono text-xs"
          />
        </TabsContent>
      </Tabs>

      {html !== null && (
        <p className={`text-xs ${tooLarge ? 'text-destructive' : 'text-muted-foreground'}`}>
          {formatBytes(sizeBytes)} of {formatBytes(REPORT_MAX_BYTES)} max
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
