"use client";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap, AlertCircle } from "lucide-react";
import Link from "next/link";

const errorMessages: Record<string, string> = {
  Configuration: "Server configuration error. Please contact support.",
  AccessDenied: "Access denied. You don't have permission to sign in.",
  Verification: "Verification link expired or already used.",
  Default: "An authentication error occurred. Please try again.",
  OAuthAccountNotLinked: "An account with this email already exists with a different sign-in method.",
};

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") ?? "Default";
  const message = errorMessages[error] ?? errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold">ClassroomHub</span>
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle>Authentication Error</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{message}</p>
            <Link href="/auth/login">
              <Button className="w-full">Back to Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
