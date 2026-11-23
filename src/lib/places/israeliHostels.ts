import { distanceMeters } from '@/lib/geo';

// Hostels and guesthouses known among Israeli backpackers ("the hummus trail"), collected by hand
// from Israeli travel sites. A fixed list: no search is run for it. Each is found on Google only
// when the traveller taps it. Meals and Shabbat-meal sign-up are not part of this list.

export type IsraeliHostel = { name: string; he?: string; town: string; lat: number; lng: number };

export const ISRAELI_HOSTELS: IsraeliHostel[] = [
  { name: 'Onda Azul', town: 'Lago Puelo', lat: -42.05551, lng: -71.61063 },
  { name: 'Ideal Social Hostel', town: 'Buenos Aires', lat: -34.60415, lng: -58.37952 },
  { name: 'Lobo Hostel', he: 'אל לובו', town: 'La Paz', lat: -16.49668, lng: -68.13957 },
  { name: 'Pousada Marcos', town: 'Salvador', lat: -13.00955, lng: -38.52944 },
  { name: 'Hostal Arauco', town: 'Pucón', lat: -39.27402, lng: -71.97311 },
  { name: 'Hostal Bambu', town: 'San Agustín', lat: 1.8852, lng: -76.27157 },
  { name: 'Cabinas Playa Surf Hostel', town: 'Santa Teresa', lat: 9.64457, lng: -85.16762 },
  { name: 'Hostal Transilvania', town: 'Baños', lat: -1.39626, lng: -78.42142 },
  { name: 'Zoola Resort', town: 'San Pedro La Laguna', lat: 14.69556, lng: -91.27085 },
  { name: 'Casa Blanca', town: 'San Pedro La Laguna', lat: 14.69336, lng: -91.27498 },
  { name: 'Blue Moon Hostel', town: 'Antigua Guatemala', lat: 14.55441, lng: -90.73678 },
  { name: 'Zoola Suites', town: 'Antigua Guatemala', lat: 14.54966, lng: -90.73078 },
  { name: 'White Rabbit guest house', town: 'Upper Bhagsu', lat: 32.24698, lng: 76.33282 },
  { name: 'Diamond Valley', town: 'Kasol', lat: 32.00912, lng: 77.3154 },
  { name: 'Ima Ganga Hotel', town: 'Rishikesh', lat: 30.13054, lng: 78.32267 },
  { name: 'The Paradise', town: 'Old Manali', lat: 32.25416, lng: 77.17834 },
  { name: 'Sima Guest House', town: 'Hampi', lat: 15.34792, lng: 76.46534 },
  { name: 'Rihanna Guest House', town: 'Arambol', lat: 15.69086, lng: 73.70261 },
  { name: 'Yog hostel', town: 'Kathmandu', lat: 27.71691, lng: 85.30745 },
  { name: 'Hostal Loco Coco Loco', town: 'Panama City', lat: 8.9801, lng: -79.52083 },
  { name: 'Hostel Rivendell', town: 'Lima', lat: -12.11605, lng: -77.03144 },
  { name: 'TLV Hostel', town: 'Cusco', lat: -13.51628, lng: -71.98624 },
  { name: 'Bardak Hostel', town: 'Cusco', lat: -13.51729, lng: -71.98184 },
  { name: 'Luzerna Hostel', town: 'Cusco', lat: -13.51998, lng: -71.98496 },
  { name: 'Hummus Bay', town: 'Arugam Bay', lat: 6.839, lng: 81.8342 },
  { name: "Benny's House", he: 'הבית של בני', town: 'Pai', lat: 19.35886, lng: 98.4423 },
  { name: 'Shaya Resort & Home stay', town: 'Pai', lat: 19.35977, lng: 98.45015 },
  { name: 'Khaosan Art Hotel', town: 'Bangkok', lat: 13.76222, lng: 100.49393 },
];

/** The note saved with such a place. */
export const ISRAELI_NOTE = '(ישראל)';

/** Hostels from the list up to `km` from a point, nearest first. */
export function israeliHostelsNear(center: { lat: number; lng: number }, km = 60): (IsraeliHostel & { meters: number })[] {
  return ISRAELI_HOSTELS
    .map((h) => ({ ...h, meters: distanceMeters(center, h) }))
    .filter((h) => h.meters <= km * 1000)
    .sort((a, b) => a.meters - b.meters);
}
