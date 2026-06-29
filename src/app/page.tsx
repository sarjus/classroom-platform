import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GraduationCap, Code, GitBranch, BarChart, CheckCircle, Users, Zap, Shield } from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center">
            <GraduationCap className="w-5 h-5" />
          </div>
          <span className="text-xl font-bold">ClassroomHub</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login">
            <Button variant="ghost" className="text-white hover:text-white hover:bg-white/10">
              Sign in
            </Button>
          </Link>
          <Link href="/auth/register">
            <Button className="bg-blue-500 hover:bg-blue-600">Get started</Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center py-24 px-6 max-w-5xl mx-auto">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-300 mb-6">
          <Zap className="w-4 h-4" />
          GitHub Classroom Alternative — Open & Powerful
        </div>
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-white to-blue-300 bg-clip-text text-transparent">
          Modern Classroom<br />Assignment Platform
        </h1>
        <p className="text-xl text-slate-400 mb-10 max-w-3xl mx-auto">
          Create programming assignments, distribute starter code, collect student submissions
          through Git, run automated tests, and evaluate performance — all in one place.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/register">
            <Button size="lg" className="bg-blue-500 hover:bg-blue-600 px-8">
              Start for free
            </Button>
          </Link>
          <Link href="/auth/login">
            <Button size="lg" variant="outline" className="border-white/20 text-white hover:bg-white/10 px-8">
              Sign in
            </Button>
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 max-w-7xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-4">Everything you need</h2>
        <p className="text-slate-400 text-center mb-12">Built for universities and coding bootcamps</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: GitBranch, title: "Git Integration", desc: "Auto-create private repos, copy starter code, manage branches and collaborators." },
            { icon: Code, title: "Autograding", desc: "Docker-sandboxed test execution for C, C++, Java, Python, JS, TypeScript, Go, Rust." },
            { icon: BarChart, title: "Analytics", desc: "Submission rates, grade distributions, commit frequency, and student progress." },
            { icon: CheckCircle, title: "Rubric Grading", desc: "Flexible criteria-based grading with inline feedback and grade release control." },
            { icon: Users, title: "Multi-Role System", desc: "Super Admin, Institution Admin, Faculty, TAs, and Student roles with full RBAC." },
            { icon: Shield, title: "Plagiarism Detection", desc: "AST, token, and repository similarity analysis to flag suspicious submissions." },
            { icon: Zap, title: "Real-time Updates", desc: "Webhook-driven autograding on every push. Instant notifications and dashboards." },
            { icon: GraduationCap, title: "Institution Scale", desc: "Multi-tenant with departments, courses, and organization-level GitHub integration." },
          ].map((f) => (
            <div key={f.title} className="rounded-xl border border-white/10 bg-white/5 p-6 hover:bg-white/10 transition-colors">
              <f.icon className="w-8 h-8 text-blue-400 mb-3" />
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-20 px-6">
        <h2 className="text-3xl font-bold mb-4">Ready to transform your classroom?</h2>
        <p className="text-slate-400 mb-8">Join thousands of educators using ClassroomHub</p>
        <Link href="/auth/register">
          <Button size="lg" className="bg-blue-500 hover:bg-blue-600 px-10">
            Get started for free
          </Button>
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-slate-500 text-sm">
        <p>© {new Date().getFullYear()} ClassroomHub. Built with Next.js, Prisma, and PostgreSQL.</p>
      </footer>
    </div>
  );
}
