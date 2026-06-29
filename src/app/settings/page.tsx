import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getInitials } from "@/lib/utils";
import { ProfileForm } from "@/components/settings/profile-form";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, image: true, role: true, username: true, githubId: true, createdAt: true },
  });

  if (!user) redirect("/auth/login");

  const roleColors: Record<string, string> = {
    SUPER_ADMIN: "destructive",
    INSTITUTION_ADMIN: "info",
    FACULTY: "success",
    TEACHING_ASSISTANT: "warning",
    STUDENT: "secondary",
  };

  return (
    <AppLayout title="Settings">
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-2xl font-bold">Settings</h2>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={user.image ?? undefined} />
                <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {user.name}
                  <Badge variant={(roleColors[user.role] as any) ?? "secondary"} className="text-xs">
                    {user.role.replace("_", " ")}
                  </Badge>
                </CardTitle>
                <CardDescription>{user.email}</CardDescription>
                {user.githubId && (
                  <p className="text-xs text-muted-foreground mt-1">GitHub connected</p>
                )}
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Profile Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile Information</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileForm user={{ name: user.name ?? "", username: user.username ?? "" }} />
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
