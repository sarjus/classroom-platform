"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { GitBranch, Loader2 } from "lucide-react";

export function AcceptAssignmentButton({ assignmentId }: { assignmentId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAccept = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: body.error, variant: "destructive" });
        return;
      }

      toast({ title: "Assignment accepted!" });

      // Redirect to GitHub if a repo URL was created
      if (body.submission?.repoUrl) {
        window.open(body.submission.repoUrl, "_blank");
      } else if (body.githubUrl) {
        // Fallback: open GitHub link provided by server
        window.open(body.githubUrl, "_blank");
      }

      router.refresh();
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleAccept} disabled={loading}>
      {loading ? (
        <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Setting up...</>
      ) : (
        <><GitBranch className="w-4 h-4 mr-2" />Accept Assignment</>
      )}
    </Button>
  );
}
