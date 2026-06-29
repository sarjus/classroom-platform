"use client";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClassroomSchema, type CreateClassroomInput } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewClassroomPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateClassroomInput>({
    resolver: zodResolver(createClassroomSchema),
  });

  const onSubmit = async (data: CreateClassroomInput) => {
    try {
      const res = await fetch("/api/classrooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (!res.ok) {
        toast({ title: "Error", description: body.error, variant: "destructive" });
        return;
      }
      toast({ title: "Classroom created!", description: `Join code: ${body.classroom.code}` });
      router.push(`/classrooms/${body.classroom.id}`);
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-muted/20 p-6">
      <div className="max-w-2xl mx-auto">
        <Link href="/classrooms" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to Classrooms
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Create New Classroom</CardTitle>
            <CardDescription>Set up a new classroom for your students. A unique join code will be generated automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Classroom Name *</Label>
                <Input id="name" placeholder="e.g. CS101 - Introduction to Programming" {...register("name")} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Brief description of the classroom..." rows={3} {...register("description")} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="semester">Semester</Label>
                  <Input id="semester" placeholder="e.g. Fall, Spring" {...register("semester")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="year">Year</Label>
                  <Input id="year" type="number" placeholder={new Date().getFullYear().toString()} {...register("year")} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? "Creating..." : "Create Classroom"}
                </Button>
                <Link href="/classrooms">
                  <Button type="button" variant="outline">Cancel</Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
