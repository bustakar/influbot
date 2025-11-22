import { AppSidebar } from '@/components/app-sidebar';
import { DashboardBreadcrumbs } from '@/components/dashboard-breadcrumbs';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-4 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <DashboardBreadcrumbs />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
