"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

interface Criteria {
  id: string;
  title: string;
  description?: string | null;
  maxPoints: number;
}

interface GradeItem {
  criteriaId: string;
  points: number;
  comment?: string | null;
}

interface Props {
  submissionId: string;
  rubric?: { criteria: Criteria[] } | null;
  existingGrade?: {
    score: number;
    maxScore: number;
    notes?: string | null;
    isReleased: boolean;
    items: GradeItem[];
  } | null;
  maxScore: number;
}

export function GradeForm({ submissionId, rubric, existingGrade, maxScore }: Props) {
  const router = useRouter();
  const [notes, setNotes] = useState(existingGrade?.notes ?? "");
  const [isReleased, setIsReleased] = useState(existingGrade?.isReleased ?? false);
  const [saving, setSaving] = useState(false);

  const [items, setItems] = useState<{ criteriaId: string; points: number; comment: string }[]>(
    rubric?.criteria.map((c) => {
      const existing = existingGrade?.items.find((i) => i.criteriaId === c.id);
      return { criteriaId: c.id, points: existing?.points ?? 0, comment: existing?.comment ?? "" };
    }) ?? []
  );

  const [directScore, setDirectScore] = useState(existingGrade?.score ?? 0);

  const totalPoints = rubric ? items.reduce((sum, i) => sum + Number(i.points), 0) : directScore;
  const percentage = Math.round((totalPoints / maxScore) * 100);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = rubric
        ? { submissionId, items, notes, isReleased }
        : { submissionId, items: [{ criteriaId: "manual", points: directScore }], notes, isReleased };

      const res = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json();
        toast({ title: "Error", description: body.error, variant: "destructive" });
        return;
      }
      toast({ title: "Grade saved!", description: isReleased ? "Student has been notified." : "Not yet released to student." });
      router.refresh();
    } catch {
      toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Grade Submission</CardTitle>
        <p className="text-sm text-muted-foreground">
          Total: <span className="font-bold text-foreground">{totalPoints}/{maxScore}</span>
          {" "}({percentage}%)
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {rubric ? (
          <div className="space-y-4">
            {rubric.criteria.map((c, i) => (
              <div key={c.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-medium">{c.title}</p>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={c.maxPoints}
                      value={items[i]?.points ?? 0}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[i] = { ...newItems[i], points: Number(e.target.value) };
                        setItems(newItems);
                      }}
                      className="w-20 text-center"
                    />
                    <span className="text-sm text-muted-foreground">/ {c.maxPoints}</span>
                  </div>
                </div>
                <Textarea
                  placeholder="Comment on this criterion..."
                  rows={2}
                  value={items[i]?.comment ?? ""}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[i] = { ...newItems[i], comment: e.target.value };
                    setItems(newItems);
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Score (out of {maxScore})</Label>
            <Input
              type="number"
              min={0}
              max={maxScore}
              value={directScore}
              onChange={(e) => setDirectScore(Number(e.target.value))}
              className="w-32"
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="notes">Overall Notes</Label>
          <Textarea
            id="notes"
            placeholder="Overall feedback for the student..."
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="isReleased"
            checked={isReleased}
            onChange={(e) => setIsReleased(e.target.checked)}
            className="w-4 h-4"
          />
          <Label htmlFor="isReleased">Release grade to student</Label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Grade"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
