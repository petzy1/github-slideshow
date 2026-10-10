// Reputation dashboard: loads JSON from ./data and renders the metric tiles.
// Live data lives in data/google.json and data/csi.json. Any metric that has
// not been synced yet falls back to data/sample.json and the page shows a
// "Sample data" badge so placeholder numbers are never mistaken for real ones.

async function loadJson(path) {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

const $ = (root, field) => root.querySelector(`[data-field="${field}"]`);

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

function setDelta(el, current, previous, digits, suffix = "") {
  if (current == null || previous == null) { el.textContent = ""; return; }
  const diff = current - previous;
  el.classList.toggle("up", diff > 0);
  el.classList.toggle("down", diff < 0);
  const sign = diff > 0 ? "▲ +" : diff < 0 ? "▼ " : "— ";
  el.textContent = `${sign}${diff.toFixed(digits)}${suffix}`;
}

function renderGoogle(g) {
  const tile = document.getElementById("tile-google");
  if (!g || g.rating == null) { tile.classList.add("empty"); return; }

  $(tile, "value").textContent = g.rating.toFixed(1);
  const stars = $(tile, "stars");
  stars.innerHTML = `<span style="width:${(g.rating / 5) * 100}%">★★★★★</span>`;
  stars.setAttribute("aria-label", `${g.rating} out of 5 stars`);
  $(tile, "sub").textContent = `${g.userRatingCount.toLocaleString("en-CA")} reviews`;

  // Compare against the oldest snapshot within ~30 days.
  const history = g.history || [];
  const cutoff = Date.now() - 30 * 864e5;
  const baseline = history.find(h => new Date(h.date).getTime() >= cutoff);
  const delta = $(tile, "delta");
  if (baseline && baseline !== history[history.length - 1]) {
    setDelta(delta, g.rating, baseline.rating, 2);
    const newReviews = g.userRatingCount - baseline.count;
    if (newReviews > 0) delta.textContent += `  ·  +${newReviews} reviews (30d)`;
  }

  if (g.googleMapsUri) {
    const link = $(tile, "link");
    link.href = g.googleMapsUri;
    link.hidden = false;
  }
}

function renderCsi(id, m) {
  const tile = document.getElementById(id);
  if (!m || m.score == null) { tile.classList.add("empty"); return; }

  const scale = m.scale || 100;
  const digits = scale <= 10 ? 1 : 0;
  $(tile, "value").textContent = m.score.toFixed(digits);
  $(tile, "unit").textContent = `/ ${scale}`;
  if (m.source) $(tile, "source").textContent = m.source;

  const gauge = $(tile, "gauge");
  gauge.querySelector("span").style.width = `${Math.min(100, (m.score / scale) * 100)}%`;
  if (m.target != null) {
    const marker = gauge.querySelector("i");
    marker.style.left = `${(m.target / scale) * 100}%`;
    marker.style.display = "block";
    marker.title = `Target ${m.target}`;
  }

  const parts = [];
  if (m.target != null) {
    parts.push(m.score >= m.target ? `On target (${m.target})` : `${(m.target - m.score).toFixed(digits)} below target (${m.target})`);
  }
  if (m.surveys != null) parts.push(`${m.surveys} surveys`);
  $(tile, "sub").textContent = parts.join("  ·  ") || "";

  setDelta($(tile, "delta"), m.score, m.previous, digits, " vs prior");
  $(tile, "period").textContent = m.period || "";
}

function renderReviews(g) {
  const list = document.getElementById("reviews");
  const reviews = (g && g.reviews) || [];
  if (!reviews.length) {
    list.innerHTML = `<li class="empty-row">No reviews loaded yet.</li>`;
    return;
  }
  list.innerHTML = "";
  for (const r of reviews) {
    const li = document.createElement("li");
    const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
    li.innerHTML = `
      <div class="review-top">
        <span class="review-author"></span>
        <span><span class="review-stars ${r.rating <= 2 ? "low" : ""}">${stars}</span>
        <span class="muted"> · ${r.relativeTime || fmtDate(r.publishTime)}</span></span>
      </div>
      <p class="review-text"></p>`;
    li.querySelector(".review-author").textContent = r.author || "Google user";
    li.querySelector(".review-text").textContent = r.text || "(rating only, no text)";
    list.appendChild(li);
  }
  document.getElementById("reviews-note").textContent =
    "Google's API returns up to 5 recent reviews per sync";
}

async function main() {
  const [google, csi] = await Promise.all([loadJson("data/google.json"), loadJson("data/csi.json")]);
  const sample = await loadJson("data/sample.json");

  const sampled = [];
  let g = google;
  if (!g || g.rating == null) { g = sample && sample.google; sampled.push("Google"); }
  let service = csi && csi.service;
  if (!service || service.score == null) { service = sample && sample.csi.service; sampled.push("Service CSI"); }
  let sales = csi && csi.sales;
  if (!sales || sales.score == null) { sales = sample && sample.csi.sales; sampled.push("Sales CSI"); }

  renderGoogle(g);
  renderCsi("tile-service", service);
  renderCsi("tile-sales", sales);
  renderReviews(g);

  if (sampled.length) {
    const badge = document.getElementById("data-mode");
    badge.textContent = sampled.length === 3 ? "Sample data" : `Sample data: ${sampled.join(", ")}`;
    badge.title = "These tiles show placeholder numbers until their data source is connected.";
    badge.hidden = false;
  }
  if (google && google.fetchedAt) {
    document.getElementById("last-updated").textContent = `Google synced ${fmtDate(google.fetchedAt)}`;
  }
}

main();
