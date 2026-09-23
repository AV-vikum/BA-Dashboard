import { isValidEmail, normalizeEmail, parseEmailList } from '@ba/shared';
import { useState } from 'react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

// Combobox suggesting known emails, accepting a typed new one (Enter) or a
// pasted list (comma/newline-separated). Used for both direct and external
// additions in the Access panel (step 4.6).
export function EmailCombobox({
  suggestions,
  alreadyAdded,
  onAdd,
  placeholder = 'Add by email…',
}: {
  suggestions: string[];
  alreadyAdded: string[];
  onAdd: (emails: string[]) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const addedSet = new Set(alreadyAdded.map(normalizeEmail));
  const filtered = suggestions
    .filter((email) => !addedSet.has(normalizeEmail(email)))
    .filter((email) => email.includes(query.trim().toLowerCase()))
    .slice(0, 20);

  function commit(raw: string) {
    const { emails } = parseEmailList(raw);
    if (emails.length > 0) {
      onAdd(emails);
    }
    setQuery('');
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start font-normal text-muted-foreground"
        >
          {placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Type or paste emails…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                e.preventDefault();
                commit(query);
              }
            }}
          />
          <CommandList>
            {query.trim() && isValidEmail(query) && (
              <CommandGroup>
                <CommandItem onSelect={() => commit(query)}>
                  Add “{normalizeEmail(query)}”
                </CommandItem>
              </CommandGroup>
            )}
            {filtered.length > 0 && (
              <CommandGroup heading="Suggestions">
                {filtered.map((email) => (
                  <CommandItem key={email} onSelect={() => commit(email)}>
                    {email}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {filtered.length === 0 && !(query.trim() && isValidEmail(query)) && (
              <CommandEmpty>
                {query.trim() ? 'Not a valid email.' : 'Type an email, or paste a list.'}
              </CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
