#!/usr/bin/env node
// Pulls the Google rating, review count and latest reviews for the dealership
// from the Google Places API (New) and writes them to data/google.json.
//
// Usage:
//   GOOGLE_PLACES_API_KEY=... node reputation/scripts/fetch-google-reviews.mjs
//
// Optional: GOOGLE_PLACE_ID=ChIJ... to skip the text search. On the first run
// the script finds the place by name and saves its ID into google.json, so
// later runs reuse it.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DATA_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "google.json");
const SEARCH_QUERY = "Grimsby Chevrolet Buick GMC, 337 Main St E, Grimsby, ON";
const API = "https://places.googleapis.com/v1";
const MAX_HISTORY = 400; // ~1 year of daily snapshots

const apiKey = process.env.GOOGLE_PLACES_API_KEY;
if (!apiKey) {
  console.error("Set GOOGLE_PLACES_API_KEY (Google Cloud project with Places API (New) enabled).");
  process.exit(1);
}

async function places(url, { fieldMask, body } = {}) {
  const res = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Places API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function findPlaceId() {
  const data = await places(`${API}/places:searchText`, {
    fieldMask: "places.id,places.displayName,places.formattedAddress",
    body: { textQuery: SEARCH_QUERY, regionCode: "CA" },
  });
  const match = data.places?.[0];
  if (!match) throw new Error(`No Google place found for "${SEARCH_QUERY}"`);
  console.log(`Matched: ${match.displayName?.text} — ${match.formattedAddress} (${match.id})`);
  return match.id;
}

const existing = JSON.parse(await readFile(DATA_FILE, "utf8").catch(() => "{}"));
const placeId = process.env.GOOGLE_PLACE_ID || existing.placeId || (await findPlaceId());

const place = await places(`${API}/places/${placeId}`, {
  fieldMask: "id,displayName,rating,userRatingCount,googleMapsUri,reviews",
});

const today = new Date().toISOString().slice(0, 10);
const history = (existing.history || []).filter(h => h.date !== today);
history.push({ date: today, rating: place.rating, count: place.userRatingCount });

const out = {
  placeId: place.id,
  name: place.displayName?.text ?? existing.name,
  rating: place.rating ?? null,
  userRatingCount: place.userRatingCount ?? null,
  googleMapsUri: place.googleMapsUri ?? null,
  fetchedAt: new Date().toISOString(),
  history: history.slice(-MAX_HISTORY),
  reviews: (place.reviews || []).map(r => ({
    author: r.authorAttribution?.displayName,
    rating: r.rating,
    text: r.text?.text ?? r.originalText?.text ?? "",
    relativeTime: r.relativePublishTimeDescription,
    publishTime: r.publishTime,
  })),
};

await writeFile(DATA_FILE, JSON.stringify(out, null, 2) + "\n");
console.log(`Saved ${out.name}: ${out.rating} stars, ${out.userRatingCount} reviews → ${DATA_FILE}`);
