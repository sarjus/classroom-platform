import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side admin client (bypasses RLS) — use in API routes and server components
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

// Client-side anon client — use in client components
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Default export is the admin client for server usage
export default supabaseAdmin;
