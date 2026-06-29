"use client";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { LANGUAGE_LABELS } from "@/lib/utils";

const editSchema = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  instructions: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED", "SCHEDULED"]),
  dueDate: z.string().optional(),
  allowLateSubmission: z.boolean(),
  latePenaltyPercent: z.coerce.number().int().min(0).max(100),
  maxScore: z.coerce.number().int().min(1).max(1000),
  starterRepoUrl: z.string().optional(),
  language: z.enum(["C", "CPP", "JAVA", "PYTHON", "JAVASCRIPT", "TYPESCRIPT", "GO", "RUST"]),
});

type EditInput = z.infer<typeof editSchema>;

export default function EditAssignmentPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } =
    useForm<EditInput>({ resolver: zodResolver(editSchema) });

  useEffect(() => {
    fetch(`/api/assignments/${id}`)
      .then((r) => r.json())
      .then(({ assignment }) => {
        if (!assignment) return;
        reset({
          title: assignment.title ?? "",
          description: assignment.description ?? "",
          instructions: assignment.instructions ?? "",
          status: assignment.status ?? "DRAFT",
          dueDate: assignment.dueDate ? new Date(assignment.dueDate).toISOString().slice(0, 16) : "",
          allowLateSubmission: assignment.allowLateSubmission ?? false,
          latePenaltyPercent: assignment.latePenaltyPercent ?? 0,
          maxScore: assignment.maxScore ?? 100,
          starterRepoUrl: assignment.starterRepoUrl ?? "",
          language: assignment.language ?? "PYTHON",
        });
        setLoading(false);
      });
  }, [id, reset]);

  const onSubmit = async (data: EditInput) => {
    const res = await fetch(`/api/assignments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...data,
        dueDate: data.dueDate || null,
        starterRepoUrl: data.starterRepoUrl || null,
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      toast({ title: "Error", description: body.error, variant: "destructive" });
      return;
    }
    toast({ title: "Assignment updated!" });
    router.push(`/assignments/${id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-6">
      <div className="max-w-3xl mx-auto">
        <Link href={`/assignments/${id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Assignment
        </Link>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Edit Assignment</CardTitle>
              <CardDescription>Update assignment details and publish when ready.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={watch("status")}
                  onValueChange={(v) => setValue("status", v as any)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draft</SelectItem>
                    <SelectItem value="PUBLISHED">Published</SelectItem>
                    <SelectItem value="ARCHIVED">Archived</SelectItem>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" {...register("title")} />
                {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Short Description</Label>
                <Textarea id="description" rows={2} {...register("description")} />
              </div>

              {/* Instructions */}
              <div className="space-y-2">
                <Label htmlFor="instructions">Instructions (Markdown)</Label>
                <Textarea id="instructions" rows={8} {...register("instructions")} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Language */}
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select
                    value={watch("language")}
                    onValueChange={(v) => setValue("language", v as any)}
                  >
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
                <Input id="starterRepoUrl" placeholder="https://github.com/org/starter" {...register("starterRepoUrl")} />
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
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
            <Link href={`/assignments/${id}`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
