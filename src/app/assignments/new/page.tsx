"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createAssignmentSchema, type CreateAssignmentInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LANGUAGE_LABELS } from "@/lib/utils";

export default function NewAssignmentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClassroom = searchParams.get("classroomId");
  const [classrooms, setClassrooms] = useState<{ id: string; name: string }[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<CreateAssignmentInput>({
    resolver: zodResolver(createAssignmentSchema),
    defaultValues: {
      language: "PYTHON",
      maxScore: 100,
      allowLateSubmission: false,
      latePenaltyPercent: 0,
      isGroupAssignment: false,
      classroomId: preselectedClassroom ?? "",
    },
  });

  useEffect(() => {
    fetch("/api/classrooms?limit=50")
      .then((r) => r.json())
      .then((d) => setClassrooms(d.classrooms ?? []));
  }, []);

  const onSubmit = async (data: CreateAssignmentInput) => {
    try {
      const res = await fetch("/api/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: body.error, variant: "destructive" });
        return;
      }
      toast({ title: "Assignment created!", description: "Publish when ready." });
      router.push(`/assignments/${body.assignment.id}`);
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 p-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/assignments" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Assignments
        </Link>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Assignment</CardTitle>
              <CardDescription>Define the assignment details, instructions, and grading configuration.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Classroom */}
              <div className="space-y-2">
                <Label>Classroom *</Label>
                <Select
                  defaultValue={preselectedClassroom ?? undefined}
                  onValueChange={(v) => setValue("classroomId", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select classroom..." />
                  </SelectTrigger>
                  <SelectContent>
                    {classrooms.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.classroomId && <p className="text-xs text-destructive">{errors.classroomId.message}</p>}
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" placeholder="e.g. Linked List Implementation" {...register("title")} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Short Description</Label>
                <Textarea id="description" placeholder="Brief overview..." rows={2} {...register("description")} />
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions (Markdown)</Label>
                <Textarea id="instructions" placeholder="# Assignment Instructions&#10;&#10;Implement a singly linked list..." rows={6} {...register("instructions")} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Language */}
                <div className="space-y-2">
                  <Label>Language *</Label>
                  <Select defaultValue="PYTHON" onValueChange={(v) => setValue("language", v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LANGUAGE_LABELS).map(([val, label]) => (
                        <SelectItem key={val} value={val}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Max Score */}
                <div className="space-y-2">
                  <Label htmlFor="maxScore">Max Score</Label>
                  <Input id="maxScore" type="number" min="1" max="1000" {...register("maxScore")} />
                  {errors.maxScore && <p className="text-xs text-destructive">{errors.maxScore.message}</p>}
                </div>
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input id="dueDate" type="datetime-local" {...register("dueDate")} />
              </div>

              {/* Starter Repo */}
              <div className="space-y-2">
                <Label htmlFor="starterRepoUrl">Starter Repository URL</Label>
                <Input id="starterRepoUrl" placeholder="https://github.com/org/starter-template" {...register("starterRepoUrl")} />
                {errors.starterRepoUrl && <p className="text-xs text-destructive">{errors.starterRepoUrl.message}</p>}
              </div>

              {/* Late submission */}
              <div className="flex items-center gap-3">
                <input type="checkbox" id="allowLateSubmission" {...register("allowLateSubmission")} className="w-4 h-4" />
                <Label htmlFor="allowLateSubmission">Allow late submissions</Label>
              </div>

              {watch("allowLateSubmission") && (
                <div className="space-y-2">
                  <Label htmlFor="latePenaltyPercent">Late Penalty (%)</Label>
                  <Input id="latePenaltyPercent" type="number" min="0" max="100" {...register("latePenaltyPercent")} />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Creating..." : "Create Assignment"}
            </Button>
            <Link href="/assignments">
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
