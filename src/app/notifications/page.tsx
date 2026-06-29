import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import prisma from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, BookOpen, GitBranch, Trophy, MessageSquare, AlertCircle } from "lucide-react";
import { formatRelative } from "@/lib/utils";
import Link from "next/link";
import { MarkAllReadButton } from "@/components/notifications/mark-read";
import type { NotificationType } from "@/types/db";

const typeIcons: Record<NotificationType, React.ComponentType<{ className?: string }>> = {
  ASSIGNMENT_PUBLISHED: BookOpen,
  DEADLINE_REMINDER: AlertCircle,
  LATE_WARNING: AlertCircle,
  AUTOGRADING_COMPLETE: GitBranch,
  FEEDBACK_AVAILABLE: MessageSquare,
  GRADE_RELEASED: Trophy,
  ANNOUNCEMENT: Bell,
  INVITATION: Bell,
};

const typeColors: Record<NotificationType, string> = {
  ASSIGNMENT_PUBLISHED: "text-blue-600",
  DEADLINE_REMINDER: "text-orange-600",
  LATE_WARNING: "text-red-600",
  AUTOGRADING_COMPLETE: "text-green-600",
  FEEDBACK_AVAILABLE: "text-purple-600",
  GRADE_RELEASED: "text-yellow-600",
  ANNOUNCEMENT: "text-gray-600",
  INVITATION: "text-teal-600",
};

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <AppLayout title="Notifications">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Notifications</h2>
            <p className="text-muted-foreground">{unreadCount} unread</p>
          </div>
          {unreadCount > 0 && <MarkAllReadButton />}
        </div>

        {notifications.length === 0 ? (
          <div className="text-center py-20">
            <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">All caught up!</h3>
            <p className="text-muted-foreground">No notifications to show.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((n) => {
              const Icon = typeIcons[n.type] ?? Bell;
              const iconColor = typeColors[n.type] ?? "text-gray-600";
              return (
                <Link key={n.id} href={n.link ?? "#"}>
                  <Card className={`hover:shadow-sm transition-shadow cursor-pointer ${!n.isRead ? "border-primary/30 bg-primary/5" : ""}`}>
                    <CardContent className="p-4 flex items-start gap-4">
                      <div className={`w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0 ${iconColor}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm font-medium ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                            {n.title}
                          </p>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!n.isRead && <div className="w-2 h-2 rounded-full bg-primary" />}
                            <span className="text-xs text-muted-foreground">{formatRelative(n.createdAt)}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
