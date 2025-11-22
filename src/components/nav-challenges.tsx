'use client';

import { useQuery } from 'convex/react';
import { Folder } from 'lucide-react';
import Link from 'next/link';

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

import { api } from '../../convex/_generated/api';
import { Challenge } from '../../convex/schema';

export function NavChallenges() {
  const challenges = useQuery(api.challenges.list) ?? [];

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Challenges</SidebarGroupLabel>
      <SidebarMenu>
        {challenges.map((challenge: Challenge) => (
          <SidebarMenuItem key={challenge._id}>
            <SidebarMenuButton asChild>
              <Link href={`/dashboard/challenges/${challenge._id}`}>
                <Folder />
                <span>{challenge.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
