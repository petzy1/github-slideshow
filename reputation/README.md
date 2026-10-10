# Grimsby Chevrolet Buick GMC: Reputation Dashboard

A static dashboard with three headline tiles (Google Rating, Service CSI, Sales CSI) and a feed of the latest Google reviews.

## Run it locally

```sh
cd reputation
python3 -m http.server 8080   # then open http://localhost:8080
```

It has to be served over HTTP (not opened as a file), because the page loads its numbers from `data/*.json`.

## Data

| File | Feeds | How it gets filled |
| --- | --- | --- |
| `data/google.json` | Google Rating tile, reviews feed | `scripts/fetch-google-reviews.mjs` (Google Places API) |
| `data/csi.json` | Service CSI and Sales CSI tiles | Entered by hand for now (GM CSI source still to be decided) |
| `data/sample.json` | Fallback only | Placeholder numbers, shown with a **Sample data** badge |

Any tile whose live value is still `null` shows the sample numbers, and the header says which tiles are sampled.

### Google sync

1. In Google Cloud, enable **Places API (New)** and create an API key.
2. Run:
   ```sh
   GOOGLE_PLACES_API_KEY=your-key node reputation/scripts/fetch-google-reviews.mjs
   ```
   The first run looks up the dealership by name and address and saves its Place ID. Each run adds a dated snapshot to `history`, which the tile uses for its 30-day change.

Google's API returns the overall rating, the total review count and up to 5 recent reviews. Pulling the full review history and replying to reviews requires the Google Business Profile API, which needs owner access to the listing.

### CSI

Fill in `score`, `target`, `previous`, `surveys` and `period` in `data/csi.json`. `scale` defaults to 100.
