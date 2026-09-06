import { createClient } from "@supabase/supabase-js";

// Publishable/anon key is safe to expose client-side by design — Supabase
// enforces access via Row Level Security policies, not by hiding this key.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kmcjfvbqmoihkjgwisnz.supabase.co";
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttY2pmdmJxbW9paGtqZ3dpc256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzOTg4NzAsImV4cCI6MjEwMzk3NDg3MH0.71vQ81pJ_Z4RpCa1ge2wapyB71kJAa1jGOSwjPjg1UQ";

export const supabase = createClient(supabaseUrl, supabaseKey);

export const BATCH_FILES_BUCKET = "batch-files";
