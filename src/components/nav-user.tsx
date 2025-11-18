'use client';

import { UserProfile, useUser } from '@clerk/nextjs';
import { ChevronsUpDown } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

import { Skeleton } from './ui/skeleton';

const UserButton = ({
  isLoaded,
  name,
  email,
  imageUrl,
}: {
  isLoaded: boolean;
  name: string | null;
  email: string | null;
  imageUrl: string | null;
}) => {
  if (!isLoaded) {
    return (
      <SidebarMenuButton
        size="lg"
        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
      >
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
      </SidebarMenuButton>
    );
  }

  const userInitials = name
    ?.split(' ')
    .map((name: string) => name[0])
    .join('');
  return (
    <SidebarMenuButton
      size="lg"
      className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
    >
      <Avatar className="h-8 w-8 rounded-lg">
        <AvatarImage src={imageUrl ?? ''} alt={name ?? 'User Avatar'} />
        <AvatarFallback className="rounded-lg">{userInitials}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-xs">{email}</span>
      </div>
      <ChevronsUpDown className="ml-auto size-4" />
    </SidebarMenuButton>
  );
};

export function NavUser() {
  const { isMobile } = useSidebar();
  const { user, isLoaded } = useUser();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <UserButton
              isLoaded={isLoaded}
              name={user?.fullName ?? null}
              email={user?.primaryEmailAddress?.emailAddress ?? null}
              imageUrl={user?.imageUrl ?? null}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <UserProfile />
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
