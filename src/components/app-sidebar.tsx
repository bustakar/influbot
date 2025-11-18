import * as React from 'react';

import { CreateChallengeDialog } from '@/app/dashboard/_components/create-challenge-dialog';
import { NavChallenges } from '@/components/nav-challenges';
import { NavUser } from '@/components/nav-user';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
} from '@/components/ui/sidebar';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="floating" {...props}>
      <SidebarHeader>
        <CreateChallengeDialog />
      </SidebarHeader>
      <SidebarContent>
        <NavChallenges />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
