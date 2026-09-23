import { ArrowLeft, Menu } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AdminNav } from './AdminNav';

export function AdminLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const appName = import.meta.env.VITE_APP_NAME;

  useEffect(() => {
    document.title = `Admin · ${appName}`;
  }, [appName]);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col gap-4 border-r p-4 md:flex">
        <AdminNav />
        <Separator />
        <Button variant="ghost" size="sm" asChild className="justify-start">
          <Link to="/">
            <ArrowLeft /> Back to my reports
          </Link>
        </Button>
      </aside>

      {/* Mobile top bar */}
      <div className="flex items-center gap-2 border-b p-3 md:hidden">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open admin menu"
          onClick={() => setMobileNavOpen(true)}
        >
          <Menu />
        </Button>
        <span className="font-semibold">Admin</span>
      </div>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Admin</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4">
            <AdminNav onNavigate={() => setMobileNavOpen(false)} />
            <Separator />
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="justify-start"
              onClick={() => setMobileNavOpen(false)}
            >
              <Link to="/">
                <ArrowLeft /> Back to my reports
              </Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <main className="min-w-0 flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
