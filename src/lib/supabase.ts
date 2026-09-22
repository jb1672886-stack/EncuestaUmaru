import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://nkpcritxwmrlbcbabrkg.supabase.co";

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5rcGNyaXR4d21ybGJjYmFicmtnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAwODg5ODAsImV4cCI6MjEwNTY2NDk4MH0.iGuOhBdW1K25NBOlF-F3lLvhVcPnZtUYnNEUqpCDXRk";

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

