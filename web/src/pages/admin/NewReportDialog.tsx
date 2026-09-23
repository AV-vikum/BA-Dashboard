import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Placeholder — built out in step 4.4 (title/description/tags + HTML
// upload or paste, creating the report via createReportFromHtml).
export function NewReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (id: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New report</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Coming in step 4.4.</p>
      </DialogContent>
    </Dialog>
  );
}
