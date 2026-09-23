import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

// Full-page icon + title + text + actions, for "not found", "no access",
// "something went wrong" and similar states.
export function MessagePage({
  icon: Icon,
  title,
  text,
  children,
}: {
  icon: LucideIcon;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <Icon className="size-10 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-xl font-bold">{title}</h1>
      {text ? <p className="max-w-sm text-sm text-muted-foreground">{text}</p> : null}
      {children ? <div className="flex gap-2">{children}</div> : null}
    </div>
  );
}
