import { REPORT_MAX_BYTES } from '@ba/shared';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { replaceReportHtml, ReportTooLargeError } from '@/lib/firestore/admin';
import { byteLength } from '@/lib/firestore/admin-helpers';
import { HtmlSourcePicker } from './HtmlSourcePicker';

// Used from the report detail page (step 4.5) to replace a report's HTML
// in place, keeping title/description/tags/access untouched.
export function ReplaceHtmlDialog({
  reportId,
  open,
  onOpenChange,
  onReplaced,
}: {
  reportId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplaced?: () => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  const canReplace = html !== null && byteLength(html) <= REPORT_MAX_BYTES && !replacing;

  async function handleReplace() {
    if (!canReplace || html === null) return;
    setReplacing(true);
    try {
      await replaceReportHtml(reportId, html);
      toast.success('Report HTML replaced.');
      setHtml(null);
      onOpenChange(false);
      onReplaced?.();
    } catch (error) {
      if (error instanceof ReportTooLargeError) {
        toast.error('That HTML is too large — see the limit above the file picker.');
      } else {
        toast.error('Could not replace the report HTML.');
      }
    } finally {
      setReplacing(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setHtml(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Replace HTML</DialogTitle>
          <DialogDescription>
            The new file replaces the report's content. Title, description, tags and access are
            unchanged.
          </DialogDescription>
        </DialogHeader>

        <HtmlSourcePicker html={html} onChange={setHtml} />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={replacing}>
            Cancel
          </Button>
          <Button onClick={() => void handleReplace()} disabled={!canReplace}>
            {replacing ? 'Replacing…' : 'Replace'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
