import { LIMITS, REPORT_MAX_BYTES } from '@ba/shared';
import { useId, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TagsInput } from '@/components/TagsInput';
import { createReportFromHtml, ReportTooLargeError } from '@/lib/firestore/admin';
import { byteLength } from '@/lib/firestore/admin-helpers';
import { HtmlSourcePicker } from './HtmlSourcePicker';

export function NewReportDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [html, setHtml] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const titleId = useId();
  const descriptionId = useId();

  function reset() {
    setTitle('');
    setDescription('');
    setTags([]);
    setHtml(null);
  }

  const titleValid = title.trim().length > 0 && title.trim().length <= LIMITS.titleMax;
  const htmlValid = html !== null && byteLength(html) <= REPORT_MAX_BYTES;
  const canCreate = titleValid && htmlValid && !creating;

  async function handleCreate() {
    if (!canCreate || html === null) return;
    setCreating(true);
    try {
      const id = await createReportFromHtml({ title, description, tags, html });
      toast.success('Draft created — add people and publish when ready.');
      reset();
      onOpenChange(false);
      onCreated(id);
    } catch (error) {
      if (error instanceof ReportTooLargeError) {
        toast.error('That HTML is too large — see the limit above the file picker.');
      } else {
        toast.error('Could not create the report.');
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New report</DialogTitle>
          <DialogDescription>
            Upload or paste a built report HTML file. It starts as a draft with no access.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={titleId}>Title</Label>
            <Input
              id={titleId}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={LIMITS.titleMax}
              placeholder="Sales Overview"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={descriptionId}>Description</Label>
            <Textarea
              id={descriptionId}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={LIMITS.descriptionMax}
              placeholder="Optional"
            />
          </div>

          <TagsInput tags={tags} onChange={setTags} />

          <div className="flex flex-col gap-1.5">
            <Label>Report HTML</Label>
            <HtmlSourcePicker html={html} onChange={setHtml} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={() => void handleCreate()} disabled={!canCreate}>
            {creating ? 'Creating…' : 'Create draft'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
