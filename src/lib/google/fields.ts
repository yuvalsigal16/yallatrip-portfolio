// Field masks decide what Google returns AND how much each call costs.
// Asking for rating or opening hours moves a call to the pricier
// "Enterprise" tier, so each screen asks only for what it shows.

/** Place Details for saving a place: name, address, location, type (Pro tier). */
export const DETAILS_BASIC = ['id', 'displayName', 'formattedAddress', 'location', 'primaryType'].join(',');

/** Place Details for the place card: adds rating, hours, link, photo (Enterprise tier). */
export const DETAILS_CARD = [
  'id', 'displayName', 'formattedAddress', 'location', 'primaryType', 'googleMapsUri',
  'rating', 'userRatingCount', 'regularOpeningHours', 'currentOpeningHours.openNow', 'photos',
  'websiteUri', 'priceRange', 'types',
].join(',');

/** Nearby Search for "near you": the list shows name, rating, open now, distance. */
export const NEARBY = [
  'places.id', 'places.displayName', 'places.location', 'places.primaryType',
  'places.rating', 'places.userRatingCount', 'places.currentOpeningHours.openNow',
].join(',');

/** "✨ מה יש בסביבה": name, location and type only, so the call stays in the cheaper "Pro" tier (no rating, no hours). */
export const AROUND = ['places.id', 'places.displayName', 'places.location', 'places.primaryType'].join(',');

export const AUTOCOMPLETE = [
  'suggestions.placePrediction.placeId',
  'suggestions.placePrediction.text',
  'suggestions.placePrediction.structuredFormat',
  'suggestions.placePrediction.types',
].join(',');

export const ROUTE_MATRIX = ['originIndex', 'destinationIndex', 'duration', 'distanceMeters', 'condition'].join(',');

export const DAY_ROUTE = ['routes.legs.duration', 'routes.legs.distanceMeters', 'routes.legs.polyline.encodedPolyline'].join(',');
