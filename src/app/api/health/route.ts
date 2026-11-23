import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/health — is the app up, and can it reach the database?
// Open to everyone; reveals nothing but yes/no.
export async function GET() {
  const checks = { app: true, database: false, categories: 0, googleKeyConfigured: Boolean(process.env.GOOGLE_MAPS_SERVER_KEY) };
  try {
    const supabase = await createClient();
    const { count, error } = await supabase.from('categories').select('id', { count: 'exact', head: true });
    if (!error) {
      checks.database = true;
      checks.categories = count ?? 0;
    }
  } catch {
    // leave database: false
  }
  const healthy = checks.database && checks.categories > 0 && checks.googleKeyConfigured;
  return NextResponse.json(checks, { status: healthy ? 200 : 503 });
}
