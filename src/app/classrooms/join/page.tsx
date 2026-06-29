"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { joinClassroomSchema, type JoinClassroomInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Key } from "lucide-react";
import Link from "next/link";

export default function JoinClassroomPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<JoinClassroomInput>({
    resolver: zodResolver(joinClassroomSchema),
  });

  const onSubmit = async (data: JoinClassroomInput) => {
    try {
      const res = await fetch("/api/classrooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: data.code }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: body.error, variant: "destructive" });
        return;
      }
      toast({ title: `Joined ${body.name}!`, description: "You can now access classroom assignments." });
      router.push(`/classrooms/${body.classroomId}`);
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/classrooms" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Classrooms
        </Link>

        <Card>
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Key className="w-6 h-6 text-primary" />
            </div>
            <CardTitle>Join a Classroom</CardTitle>
            <CardDescription>Enter the 6-character join code provided by your instructor</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="code">Join Code</Label>
                <Input
                  id="code"
                  placeholder="CS2026A"
                  className="text-center text-2xl font-mono tracking-widest uppercase"
                  maxLength={10}
                  {...register("code")}
                />
                {errors.code && <p className="text-xs text-destructive text-center">{errors.code.message}</p>}
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Joining..." : "Join Classroom"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
