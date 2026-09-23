import { X } from 'lucide-react';
import { useId, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Comma-separated entry → chips, lower-cased, de-duplicated, capped at
// maxTags. Used by the New report dialog (4.4) and report details (4.5).
export function TagsInput({
  tags,
  onChange,
  maxTags = 10,
  label = 'Tags',
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  maxTags?: number;
  label?: string;
}) {
  const [draft, setDraft] = useState('');
  const id = useId();

  function commit(raw: string) {
    const parts = raw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...new Set([...tags, ...parts])].slice(0, maxTags);
    onChange(next);
    setDraft('');
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit(draft);
          } else if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
            const last = tags.at(-1);
            if (last) removeTag(last);
          }
        }}
        onBlur={() => draft && commit(draft)}
        placeholder={tags.length >= maxTags ? `Up to ${maxTags} tags` : 'Add a tag, press Enter…'}
        disabled={tags.length >= maxTags}
      />
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
                className="cursor-pointer rounded-full hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
