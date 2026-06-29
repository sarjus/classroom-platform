import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { supabaseAdmin } from "@/lib/supabase";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export async function AppLayout({ children, title }: AppLayoutProps) {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  const { data: user, error: userError } = await supabaseAdmin
    .from("User")
    .select("id, name, email, image, role")
    .eq("id", session.user.id)
    .maybeSingle();

  if (userError) console.error("[app-layout user]", userError);
  if (!user) redirect("/auth/login");

  const unreadCount = await supabaseAdmin
      .from("Notification")
      .select("*", { count: "exact", head: true })
      .eq("userId", user.id)
      .eq("isRead", false)
      .then(({ count, error }) => {
        if (error) { console.error("[app-layout notification count]", error); return 0; }
        return count ?? 0;
      });

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header title={title} unreadCount={unreadCount} />
        <main className="flex-1 overflow-y-auto p-6 bg-muted/20">
          {children}
        </main>
      </div>
    </div>
  );
}
