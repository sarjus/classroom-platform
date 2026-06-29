import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "./supabase";
import type { UserRole } from "@/types/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: { scope: "read:user user:email repo" },
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const { data: user, error } = await supabaseAdmin
          .from("User")
          .select("id, email, name, image, password, role, isActive")
          .eq("email", credentials.email as string)
          .maybeSingle();

        if (error || !user || !user.password) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!isValid) return null;
        if (!user.isActive) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role as UserRole,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        // Always resolve the real DB id by email, not NextAuth's generated id
        const { data: dbUser } = await supabaseAdmin
          .from("User")
          .select("id, role")
          .eq("email", user.email!)
          .maybeSingle();

        token.id = dbUser?.id ?? user.id;
        token.role = dbUser?.role ?? (user as any).role;
      }
      if (account?.provider === "github" && token.id) {
        await supabaseAdmin
          .from("User")
          .update({ githubToken: account.access_token, updatedAt: new Date().toISOString() })
          .eq("id", token.id as string);
        token.githubToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === "github" || account?.provider === "google") {
        const { data: existing } = await supabaseAdmin
          .from("User")
          .select("id, name, image")
          .eq("email", user.email!)
          .maybeSingle();

        const now = new Date().toISOString();

        if (!existing) {
          // First time — create user row
          const { error } = await supabaseAdmin.from("User").insert({
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            role: "STUDENT",
            isActive: true,
            githubId: account.provider === "github" ? String((profile as any)?.id ?? "") : null,
            googleId: account.provider === "google" ? String((profile as any)?.sub ?? "") : null,
            createdAt: now,
            updatedAt: now,
          });
          if (error) {
            console.error("[signIn] failed to create user:", error.message);
            return false;
          }
        } else {
          // User exists — update name/image/token in case they changed
          await supabaseAdmin
            .from("User")
            .update({
              name: user.name ?? existing.name,
              image: user.image ?? existing.image,
              updatedAt: now,
            })
            .eq("id", existing.id);

          // Make NextAuth use the existing DB id so JWT.id is correct
          user.id = existing.id;
        }
      }
      return true;
    },
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
});
