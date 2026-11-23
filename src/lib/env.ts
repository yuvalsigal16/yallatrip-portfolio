// Reads environment variables and fails loudly, by name, when one is missing.
// NEXT_PUBLIC_* values are written out literally so Next.js can inline them.

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  }
  return value;
}

export function publicEnv() {
  return {
    supabaseUrl: required('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseKey: required('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  };
}

/** Server-only secrets. Importing this from client code would be a bug. */
export function serverEnv() {
  if (typeof window !== 'undefined') {
    throw new Error('serverEnv() was called in the browser');
  }
  return {
    googleServerKey: required('GOOGLE_MAPS_SERVER_KEY', process.env.GOOGLE_MAPS_SERVER_KEY),
  };
}
