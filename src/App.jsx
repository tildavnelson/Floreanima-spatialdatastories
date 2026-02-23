import { useEffect, useRef, useState } from "react";

const FRANCE_PLACE_ID = 6753;
const TILE_PER_PAGE = 8;
const VIEWER_PER_PAGE = 24;
const TILE_COUNT = 12;
const FRAME_INTERVAL = 140;
const VIEWER_INTERVAL = 120;

const MONTHS_FR = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"
];

const SEASON_PALETTES = {
  winter: { bg: "#f0f2f4", accent: "#1a2a3a", muted: "#8a9aaa" },
  spring: { bg: "#f0f4f0", accent: "#1a3a1a", muted: "#7a9a7a" },
  summer: { bg: "#f4f2e8", accent: "#3a2a00", muted: "#9a8a50" },
  autumn: { bg: "#f4ede8", accent: "#3a1a00", muted: "#9a6a50" },
};

function getSeason(m) {
  if ([11,0,1].includes(m)) return "winter";
  if ([2,3,4].includes(m)) return "spring";
  if ([5,6,7].includes(m)) return "summer";
  return "autumn";
}

function buildMonthList() {
  const now = new Date();
  const months = [];
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  }
  return months;
}

const MONTH_LIST = buildMonthList();

function topSpeciesUrl(year, month) {
  const m = month + 1;
  const lastDay = new Date(year, m, 0).getDate();
  const d1 = `${year}-${String(m).padStart(2,"0")}-01`;
  const d2 = `${year}-${String(m).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
  return (
    `https://api.inaturalist.org/v1/observations/species_counts` +
    `?d1=${d1}` +
    `&d2=${d2}` +
    `&photos=true` +
    `&place_id=${FRANCE_PLACE_ID}` +
    `&iconic_taxa=Plantae,Fungi` +
    `&order_by=observations_count` +
    `&per_page=30`
  );
}

function photosUrl(taxonId, year, month, perPage) {
  const m = month + 1;
  const lastDay = new Date(year, m, 0).getDate();
  const d1 = `${year}-${String(m).padStart(2,"0")}-01`;
  const d2 = `${year}-${String(m).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
  return (
    `https://api.inaturalist.org/v1/observations` +
    `?taxon_id=${taxonId}` +
    `&place_id=${FRANCE_PLACE_ID}` +
    `&d1=${d1}` +
    `&d2=${d2}` +
    `&photos=true` +
    `&per_page=${perPage}` +
    `&order_by=votes`
  );
}

function squareToSize(url, size = "medium") {
  return url?.replace("square", size) ?? null;
}

function extractPhotos(results, perPage) {
  const photos = [];
  for (const obs of results ?? []) {
    const p = obs?.photos?.[0];
    if (!p?.url) continue;
    const coords = obs?.geojson?.coordinates;
    photos.push({
      srcSmall: squareToSize(p.url, "small"),
      srcMedium: squareToSize(p.url, "medium"),
      lat: coords?.[1] ?? null,
      lng: coords?.[0] ?? null,
      date: obs?.observed_on ?? null,
      location: obs?.place_guess ?? null,
    });
    if (photos.length >= perPage) break;
  }
  return photos;
}

export default function App() {
  const [monthIdx, setMonthIdx] = useState(MONTH_LIST.length - 1);
  const [species, setSpecies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(null);
  const fetchRef = useRef(0);
  const cacheRef = useRef({});

  const { year, month } = MONTH_LIST[monthIdx];
  const season = getSeason(month);
  const palette = SEASON_PALETTES[season];
  const isCurrentMonth = monthIdx === MONTH_LIST.length - 1;

  useEffect(() => {
    const token = ++fetchRef.current;
    setLoading(true);
    setActive(null);

    async function load() {
      const cacheKey = `${year}-${month}`;

      if (cacheRef.current[cacheKey]) {
        setSpecies(cacheRef.current[cacheKey]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(topSpeciesUrl(year, month));
        const data = await res.json();
        if (token !== fetchRef.current) return;

        const results = (data.results ?? [])
          .filter(r => r.taxon?.default_photo)
          .slice(0, TILE_COUNT)
          .sort(() => Math.random() - 0.5);

        const enriched = [];

        for (let i = 0; i < results.length; i += 3) {
          const batch = results.slice(i, i + 3);
          const batchResults = await Promise.all(
            batch.map(async (r) => {
              const taxonId = r.taxon?.id;
              const name = r.taxon?.preferred_common_name || r.taxon?.name || "Unknown";
              const sciName = r.taxon?.name ?? "";
              const count = r.count ?? 0;
              try {
                const pr = await fetch(photosUrl(taxonId, year, month, TILE_PER_PAGE));
                const pd = await pr.json();
                if (token !== fetchRef.current) return null;
                const photos = extractPhotos(pd.results, TILE_PER_PAGE);
                return { taxonId, name, sciName, count, photos };
              } catch {
                return { taxonId, name, sciName, count, photos: [] };
              }
            })
          );

          enriched.push(...batchResults);
          if (token !== fetchRef.current) return;
          setSpecies(enriched.filter(Boolean));
        }

        cacheRef.current[cacheKey] = enriched.filter(Boolean);

      } catch (e) {
        console.error(e);
      } finally {
        if (token === fetchRef.current) setLoading(false);
      }
    }

    load();
  }, [year, month]);

  return (
    <div style={{ ...styles.page, background: "#000" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@100;300;400&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type=range] {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 4px;
          background: ${palette.muted}50;
          outline: none;
          cursor: pointer;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 12px; height: 12px;
          border-radius: 50%;
          background: ${palette.accent};
          cursor: pointer;
        }
        input[type=range]::-moz-range-thumb {
          width: 12px; height: 12px;
          border-radius: 50%;
          background: ${palette.accent};
          cursor: pointer;
          border: none;
        }
        .tile { transition: opacity 0.15s ease; }
        .tile:hover { opacity: 0.82; }
      `}</style>

      <header style={{ ...styles.header, borderBottomColor: `${palette.accent}15` }}>
        <div style={styles.headerLeft}>
          <button
            onClick={() => setActive(null)}
            style={{ ...styles.titleBtn, color: "rgba(180,255,200,0.75)" }}
          >
            flore anima
          </button>
          {!active && (
            <p style={{ ...styles.description, color: `${palette.muted}` }}>
              An animation to discover the changing flora of the French landscape. Use the slider below to move through the months and see the top 12 plant and fungi species photographed and submitted to iNaturalist. Click any tile to explore a species in detail.
            </p>
          )}
        </div>
        <span style={{ ...styles.headerRight, color: palette.muted }}>
          {isCurrentMonth ? "maintenant" : `${MONTHS_FR[month].toLowerCase()} ${year}`}
        </span>
      </header>

      <div style={styles.frameWrap}>
        <div style={active ? styles.frameViewer : styles.frame}>
          {active ? (
            <Viewer
              species={active}
              year={year}
              month={month}
              onClose={() => setActive(null)}
            />
          ) : (
            <Grid
              species={species}
              loading={loading}
              palette={palette}
              onSelect={setActive}
            />
          )}
        </div>
      </div>

      <div style={styles.sliderWrap}>
        <div style={styles.sliderRow}>
          <span style={{ ...styles.yearLabel, color: palette.muted }}>
            {MONTH_LIST[0].year}
          </span>

          <div style={styles.sliderInner}>
            <input
              type="range"
              min={0}
              max={MONTH_LIST.length - 1}
              value={monthIdx}
              onChange={(e) => setMonthIdx(Number(e.target.value))}
            />
            <div style={styles.ticks}>
              {MONTH_LIST.map((m, i) => (
                <div
                  key={i}
                  onMouseEnter={() => setMonthIdx(i)}
                  onClick={() => setMonthIdx(i)}
                  title={`${MONTHS_FR[m.month]} ${m.year}`}
                  style={{
                    ...styles.tick,
                    background: i === monthIdx
                      ? palette.accent
                      : m.month === 0
                        ? `${palette.accent}55`
                        : `${palette.accent}20`,
                    height: m.month === 0 ? 7 : 3,
                  }}
                />
              ))}
            </div>
          </div>

          <span style={{ ...styles.yearLabel, color: palette.muted }}>
            {MONTH_LIST[MONTH_LIST.length - 1].year}
          </span>
        </div>

        <div style={{ ...styles.monthLabel, color: palette.accent }}>
          {MONTHS_FR[month].toLowerCase()} {year}
          {isCurrentMonth && <span style={{ ...styles.liveDot, background: palette.accent }} />}
        </div>
      </div>
    </div>
  );
}

function Grid({ species, loading, palette, onSelect }) {
  const [indices, setIndices] = useState({});
  const positionsRef = useRef([]);

  useEffect(() => {
    if (!species.length) return;
    if (species.length <= 3) {
      const slots = Array.from({ length: TILE_COUNT }, (_, i) => i);
      for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
      }
      positionsRef.current = slots;
    }
  }, [species]);

  useEffect(() => {
    if (!species.length) return;
    const id = setInterval(() => {
      setIndices((prev) => {
        const next = { ...prev };
        species.forEach((s) => {
          if (s.photos.length > 1) {
            next[s.taxonId] = ((prev[s.taxonId] ?? 0) + 1) % s.photos.length;
          }
        });
        return next;
      });
    }, FRAME_INTERVAL);
    return () => clearInterval(id);
  }, [species]);

  if (loading && species.length === 0) {
    return (
      <div style={{ ...styles.loadState, color: palette.muted }}>
        <div style={{ ...styles.loadLine, background: `${palette.accent}20` }} />
        <span style={{ fontSize: 9, letterSpacing: "0.4em", fontWeight: 300 }}>
          chargement
        </span>
      </div>
    );
  }

  const slots = Array(TILE_COUNT).fill(null);
  species.forEach((s, i) => {
    if (positionsRef.current[i] !== undefined) slots[positionsRef.current[i]] = s;
  });

  return (
    <div style={styles.grid}>
      {slots.map((s, i) => {
        if (!s) return (
          <div key={`e-${i}`} style={{ ...styles.tile, background: `${palette.accent}05`, cursor: "default" }} />
        );
        const idx = indices[s.taxonId] ?? 0;
        const photo = s.photos[idx];
        return (
          <div key={s.taxonId} className="tile" style={styles.tile} onClick={() => onSelect(s)}>
            {photo
              ? <img src={photo.srcSmall} alt="" style={styles.tileImg} />
              : <div style={{ ...styles.tileBlank, background: `${palette.accent}08` }} />
            }
          </div>
        );
      })}
    </div>
  );
}

function Viewer({ species, year, month, onClose }) {
  const [photos, setPhotos] = useState(species.photos);
  const [idx, setIdx] = useState(0);
  const [loadingMore, setLoadingMore] = useState(true);

  useEffect(() => {
    setPhotos(species.photos);
    setIdx(0);
    setLoadingMore(true);

    async function fetchMore() {
      try {
        const res = await fetch(photosUrl(species.taxonId, year, month, VIEWER_PER_PAGE));
        const data = await res.json();
        const full = extractPhotos(data.results, VIEWER_PER_PAGE);
        if (full.length > 0) setPhotos(full);
      } catch {
        // keep the tile photos we already have
      } finally {
        setLoadingMore(false);
      }
    }

    fetchMore();
  }, [species.taxonId]);

  useEffect(() => {
    if (!photos.length) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % photos.length), VIEWER_INTERVAL);
    return () => clearInterval(id);
  }, [photos]);

  const photo = photos[idx] ?? null;

  return (
    <div style={styles.viewer}>
      {photo ? (
        <>
          <img key={idx} src={photo.srcMedium} alt={species.name} style={styles.viewerImg} />

          <div style={styles.nameStamp}>
            <div style={styles.nameMain}>{species.name.toLowerCase()}</div>
            <div style={styles.nameSci}>{species.sciName}</div>
          </div>

          <div style={styles.locationStamp}>
            {photo.location && <div style={styles.locationText}>{photo.location.toLowerCase()}</div>}
            {photo.date && <div style={styles.dateText}>{photo.date}</div>}
          </div>

          <button onClick={onClose} style={styles.backBtn}>←</button>
          <div style={styles.frameCount}>
            {idx + 1} / {photos.length}
            {loadingMore && <span style={{ opacity: 0.4 }}> ···</span>}
          </div>
        </>
      ) : (
        <div style={styles.noPhoto}>aucune photo</div>
      )}
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    overflowY: "auto",
    color: "rgba(180,255,200,0.75)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 300,
  },
  header: {
    width: "100%",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "16px 28px",
    borderBottom: "1px solid",
  },
  headerLeft: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    maxWidth: 360,
  },
  titleBtn: {
    background: "transparent",
    border: "none",
    padding: 0,
    margin: 0,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 300,
    letterSpacing: "0.3em",
    fontFamily: "'Roboto', sans-serif",
    textTransform: "lowercase",
    textAlign: "left",
  },
  description: {
    fontSize: 12,
    fontWeight: 400,
    letterSpacing: "0.08em",
    lineHeight: 1.8,
    opacity: 0.8,
    textAlign: "left",
  },
  headerRight: {
    fontSize: 10,
    fontWeight: 300,
    letterSpacing: "0.25em",
    paddingTop: 2,
    whiteSpace: "nowrap",
  },
  frameWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    padding: "36px 28px 0",
  },
  frame: {
    // square grid: 4 cols × 3 rows, tiles are square
    width: "min(560px, 80vw)",
    aspectRatio: "4 / 3",
    overflow: "hidden",
    position: "relative",
  },
  frameViewer: {
    width: "min(560px, 80vw)",
    aspectRatio: "4 / 3",
    overflow: "hidden",
    position: "relative",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gridTemplateRows: "repeat(3, 1fr)",
    width: "100%",
    height: "100%",
    gap: 0,
    margin: 0,
    padding: 0,

  },
  tile: {
    position: "relative",
    cursor: "pointer",
    overflow: "hidden",
    aspectRatio: "1 / 1",
    zIndex: 2,
    userSelect: "none",
  },
  tileImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    transform: "translateZ(0)",
    pointerEvents: "none",
  },
  tileBlank: { width: "100%", height: "100%" },
  loadState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    gap: 14,
  },
  loadLine: {
    width: 60,
    height: 1,
  },
  viewer: {
    width: "100%",
    height: "100%",
    position: "relative",
    background: "#000",
    overflow: "hidden",
  },
  viewerImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  nameStamp: {
    position: "absolute",
    top: 16,
    left: 18,
    pointerEvents: "none",
  },
  nameMain: {
    fontSize: 12,
    fontWeight: 300,
    color: "rgba(255,255,255,0.9)",
    letterSpacing: "0.18em",
    textShadow: "0 1px 8px rgba(0,0,0,0.7)",
  },
  nameSci: {
    fontSize: 9,
    fontStyle: "italic",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: "0.1em",
    textShadow: "0 1px 6px rgba(0,0,0,0.7)",
    marginTop: 3,
  },
  locationStamp: {
    position: "absolute",
    bottom: 16,
    right: 18,
    textAlign: "right",
    pointerEvents: "none",
  },
  locationText: {
    fontSize: 10,
    fontWeight: 300,
    color: "rgba(255,255,255,0.7)",
    letterSpacing: "0.12em",
    textShadow: "0 1px 6px rgba(0,0,0,0.7)",
  },
  dateText: {
    fontSize: 9,
    fontWeight: 300,
    color: "rgba(255,255,255,0.35)",
    letterSpacing: "0.18em",
    textShadow: "0 1px 6px rgba(0,0,0,0.7)",
    marginTop: 4,
  },
  backBtn: {
    position: "absolute",
    top: 14,
    right: 16,
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.25)",
    color: "rgba(255,255,255,0.6)",
    padding: "3px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontFamily: "'Roboto', sans-serif",
    fontWeight: 300,
    letterSpacing: "0.05em",
  },
  frameCount: {
    position: "absolute",
    bottom: 16,
    left: 18,
    fontSize: 9,
    fontWeight: 300,
    color: "rgba(255,255,255,0.25)",
    letterSpacing: "0.2em",
  },
  noPhoto: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    fontSize: 9,
    letterSpacing: "0.35em",
    fontWeight: 300,
    color: "rgba(255,255,255,0.3)",
  },
  sliderWrap: {
    width: "min(560px, 80vw)",
    padding: "36px 0 70px",
  },
  sliderRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
  },
  sliderInner: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  yearLabel: {
    fontSize: 11,
    fontWeight: 400,
    letterSpacing: "0.15em",
    minWidth: 28,
  },
  ticks: {
    display: "flex",
    alignItems: "flex-end",
    height: 9,
    gap: 0,
  },
  tick: {
    flex: 1,
    cursor: "pointer",
    minWidth: 1,
    transition: "background 0.25s ease",
  },
  monthLabel: {
    marginTop: 14,
    fontSize: 12,
    fontWeight: 400,
    letterSpacing: "0.35em",
    display: "flex",
    alignItems: "center",
    gap: 9,
    transition: "color 1.4s ease",
  },
  liveDot: {
    width: 4,
    height: 4,
    borderRadius: "50%",
    display: "inline-block",
    opacity: 0.6,
  },
};