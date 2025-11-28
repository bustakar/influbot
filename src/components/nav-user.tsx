'use client';

import { UserButton as ClerkUserButton, useUser } from '@clerk/nextjs';

import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar';

export function NavUser() {
  const { user, isLoaded } = useUser();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="group relative w-full">
          <ClerkUserButton
            appearance={{
              elements: {
                rootBox: 'w-full',
                userButtonTrigger:
                  'w-full h-full justify-start data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground rounded-md p-2 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors min-h-[3rem]',
                userButtonBox: 'w-full flex items-center gap-3 relative',
                userButtonAvatarBox:
                  'h-8 w-8 rounded-lg shrink-0 relative z-10',
                userButtonOuterIdentifier: 'hidden',
                userButtonPopoverCard: 'bg-background border',
              },
            }}
          />
          {isLoaded && user && (
            <>
              <div className="absolute left-12 top-1/2 -translate-y-1/2 flex flex-col flex-1 min-w-0 pr-8 pointer-events-none">
                <span className="truncate text-sm font-medium leading-tight">
                  {user.fullName}
                </span>
                <span className="truncate text-xs text-muted-foreground leading-tight">
                  {user.primaryEmailAddress?.emailAddress || ''}
                </span>
              </div>
            </>
          )}
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
