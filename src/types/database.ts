// Row shapes of the database tables (mirrors supabase/migrations).
// Once the Supabase project is linked, `npm run db:types` generates the
// full typed client into src/types/supabase.generated.ts.

export type UserRole = 'user' | 'creator' | 'admin';
export type BudgetLevel = 'low' | 'medium' | 'high';
export type TransportMode = 'walk' | 'transit' | 'car' | 'taxi';
export type PlaceStatus = 'saved' | 'planned' | 'visited';
export type TripVisibility = 'private' | 'link' | 'public';

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  locale: 'he' | 'en';
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: number;
  key: string;
  name_he: string;
  name_en: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
}

export interface PlaceRow {
  id: string;
  google_place_id: string;
  lat: number;
  lng: number;
  primary_type: string | null;
  synced_at: string;
}

export interface Trip {
  id: string;
  owner_id: string;
  title: string;
  destination_name: string;
  destination_place_id: string | null;
  center_lat: number | null;
  center_lng: number | null;
  start_date: string | null; // YYYY-MM-DD
  end_date: string | null;
  travelers_count: number;
  transport_modes: TransportMode[];
  travel_styles: string[];
  budget_level: BudgetLevel | null;
  hotel_saved_place_id: string | null;
  visibility: TripVisibility;
  share_token: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripDay {
  id: string;
  trip_id: string;
  day_index: number;
  date: string | null;
  title: string | null;
  start_time: string | null;
  notes: string | null;
}

export interface SavedPlace {
  id: string;
  trip_id: string;
  place_id: string;
  category_id: number | null;
  label: string;
  is_must: boolean;
  personal_note: string | null;
  status: PlaceStatus;
}

export interface TripPlace {
  id: string;
  trip_id: string;
  trip_day_id: string;
  saved_place_id: string;
  position: number;
  planned_time: string | null;
  duration_min: number | null;
  transport_to_next: TransportMode | null;
  note: string | null;
}
