"use client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export function MarkAllReadButton() {
  const router = useRouter();

  const handleMarkAll = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    toast({ title: "All notifications marked as read" });
    router.refresh();
  };

  return (
    <Button variant="outline" size="sm" onClick={handleMarkAll}>
      Mark all as read
    </Button>
  );
}
