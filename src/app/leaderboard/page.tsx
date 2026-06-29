import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppLayout } from "@/components/layout/app-layout";
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal } from "lucide-react";
import { getInitials, gradeColor } from "@/lib/utils";

export default async function LeaderboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/login");

  // Get top students by average grade
  const leaderboard = await prisma.user.findMany({
    where: { role: "STUDENT" },
    include: {
      grades: {
        where: { isReleased: true },
        select: { percentage: true, score: true, maxScore: true },
      },
    },
  });

  const ranked = (leaderboard as any[])
    .map((u: any) => {
      const grades: Array<{ percentage: number; score: number; maxScore: number }> = u.grades ?? [];
      const avg = grades.length > 0
        ? grades.reduce((s, g) => s + g.percentage, 0) / grades.length
        : 0;
      return {
        id: u.id as string,
        name: u.name as string,
        image: u.image as string | null,
        email: u.email as string,
        avgGrade: Math.round(avg),
        totalSubmissions: grades.length,
        totalScore: grades.reduce((s, g) => s + g.score, 0),
      };
    })
    .filter((u) => u.totalSubmissions > 0)
    .sort((a, b) => b.avgGrade - a.avgGrade)
    .slice(0, 50);

  const medalColors = ["text-yellow-500", "text-slate-400", "text-amber-600"];
  const medalLabels = ["🥇", "🥈", "🥉"];

  return (
    <AppLayout title="Leaderboard">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-7 h-7 text-yellow-500" />
          <h2 className="text-2xl font-bold">Leaderboard</h2>
        </div>

        {/* Top 3 podium */}
        {ranked.length >= 3 && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[ranked[1], ranked[0], ranked[2]].map((student, i) => {
              const actualRank = i === 0 ? 2 : i === 1 ? 1 : 3;
              return (
                <Card key={student.id} className={actualRank === 1 ? "border-yellow-500 bg-yellow-50/50 dark:bg-yellow-950/20" : ""}>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl mb-2">{medalLabels[actualRank - 1]}</div>
                    <Avatar className="w-12 h-12 mx-auto mb-2">
                      <AvatarImage src={student.image ?? undefined} />
                      <AvatarFallback>{getInitials(student.name)}</AvatarFallback>
                    </Avatar>
                    <p className="font-semibold text-sm truncate">{student.name}</p>
                    <p className={`text-xl font-bold ${gradeColor(student.avgGrade)}`}>{student.avgGrade}%</p>
                    <p className="text-xs text-muted-foreground">{student.totalSubmissions} assignments</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Full ranking */}
        <Card>
          <CardHeader><CardTitle className="text-base">Full Ranking</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {ranked.map((student, index) => (
                <div
                  key={student.id}
                  className={`flex items-center gap-4 p-4 ${student.id === session.user.id ? "bg-primary/5" : "hover:bg-muted/30"} transition-colors`}
                >
                  <div className="w-8 text-center">
                    {index < 3 ? (
                      <span className="text-lg">{medalLabels[index]}</span>
                    ) : (
                      <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>
                    )}
                  </div>
                  <Avatar className="w-9 h-9">
                    <AvatarImage src={student.image ?? undefined} />
                    <AvatarFallback className="text-xs">{getInitials(student.name)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">
                      {student.name}
                      {student.id === session.user.id && (
                        <Badge variant="info" className="ml-2 text-xs">You</Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{student.totalSubmissions} assignments graded</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-lg ${gradeColor(student.avgGrade)}`}>{student.avgGrade}%</p>
                    <p className="text-xs text-muted-foreground">{student.totalScore} pts total</p>
                  </div>
                </div>
              ))}
              {ranked.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No grades available yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
