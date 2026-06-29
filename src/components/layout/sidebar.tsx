"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, BookOpen, Users, ClipboardList, BarChart2,
  Settings, Bell, LogOut, GraduationCap, Building2, ChevronLeft, ChevronRight,
  GitBranch, Trophy, MessageSquare, Shield,
} from "lucide-react";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import type { UserRole } from "@/types/db";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Classrooms", href: "/classrooms", icon: BookOpen },
  { label: "Assignments", href: "/assignments", icon: ClipboardList },
  { label: "Submissions", href: "/submissions", icon: GitBranch, roles: ["FACULTY", "TEACHING_ASSISTANT"] },
  { label: "Students", href: "/students", icon: Users, roles: ["FACULTY", "TEACHING_ASSISTANT", "INSTITUTION_ADMIN"] },
  { label: "Analytics", href: "/analytics", icon: BarChart2, roles: ["FACULTY", "INSTITUTION_ADMIN", "SUPER_ADMIN"] },
  { label: "Leaderboard", href: "/leaderboard", icon: Trophy },
  { label: "Discussions", href: "/discussions", icon: MessageSquare },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Institution", href: "/institution", icon: Building2, roles: ["INSTITUTION_ADMIN", "SUPER_ADMIN"] },
  { label: "Admin", href: "/admin", icon: Shield, roles: ["SUPER_ADMIN"] },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: UserRole;
  };
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.includes(user.role)
  );

  return (
    <aside
      className={cn(
        "relative flex flex-col h-screen bg-card border-r border-border transition-all duration-300",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-border">
        <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight">ClassroomHub</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {visibleItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t border-border p-3">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarImage src={user.image ?? undefined} />
            <AvatarFallback className="text-xs">{getInitials(user.name)}</AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name ?? "User"}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => signOut({ callbackUrl: "/auth/login" })}
            className="mt-2 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        )}
      </div>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border bg-background shadow-sm flex items-center justify-center hover:bg-accent transition-colors"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>
    </aside>
  );
}
