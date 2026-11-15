"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Activity, CalendarDays, Camera, Download, Gauge, GitCompareArrows, Info, Link2, Play, Satellite, SlidersHorizontal, X } from "lucide-react";
import { Comparison } from "@/components/comparison";
import { LinkChip, OrbitView, type LinkStatus } from "@/components/hero";
import { BodiesTable } from "@/components/bodies-table";
import { EventsLog, MaskCurve, NextChange, SatelliteShares, WindowCalendar } from "@/components/insights";
import { StoryCard, type Chapter } from "@/components/story";
import { CompareAB } from "@/components/compare";
import { PolarMap } from "@/components/polar-map";
import { bestWindow, linkEvents, maskCurve, nextChange, powerAndTalk, resultCsv, satelliteShares, windowScores } from "@/lib/lunanav/insights";
import { ReplayBar } from "@/components/replay-bar";
import type { Replay, Speed } from "@/components/replay-bar";
import { bodiesAt } from "@/lib/lunanav/sky";
import { ControlBar } from "@/components/control-bar";
import { MaskControl } from "@/components/mask-control";
import { MetricCards } from "@/components/metric-cards";
import { MissionBar } from "@/components/mission-header";
import { Timelines } from "@/components/timelines";
import { DataError, loadIndex, loadRelay, loadSite } from "@/lib/lunanav/data";
import { analyzeScenario } from "@/lib/lunanav/analysis";
import { relayPositionsKm, relayTracks } from "@/lib/lunanav/moon";
import { sliceWindow } from "@/lib/lunanav/network";
import { abRows, comparisonRows, uncertaintySummaries } from "@/lib/lunanav/series";
import { MAX_MASK_DEG, dateOf, normalizeScenario, parseScenario, toSearch, windowDates, windowDays, windowLastDate } from "@/lib/lunanav/scenario";
import type { DatasetIndex, RelayLinkData, Scenario, SiteData } from "@/lib/lunanav/types";

// three.js is client-only and big: load it after the page, never in the static HTML
const SkyPanel = dynamic(() => import("@/components/sky-panel"), {
  ssr: false,
  loading: () => <p className="p-4 text-sm text-muted-foreground">Loading the lander view…</p>,
});

const STILL: Replay = { step: 0, n: 1, playing: false, speed: 6, setStep: () => {}, setPlaying: () => {}, setSpeed: () => {} };
const toOption = (n: { id: string; name: string }) => ({ value: n.id, label: n.name });
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

// The side panels, in rail order. Everything past the 3D and its four numbers lives here, closed by default
type Panel = "scenario" | "results" | "timeline" | "plan" | "network" | "compare" | "about";
const PANELS = [
  ["scenario", "Scenario", SlidersHorizontal],
  ["results", "Results", Gauge],
  ["timeline", "Timeline", Activity],
  ["plan", "Plan", CalendarDays],
  ["network", "Network", Satellite],
  ["compare", "Compare", GitCompareArrows],
  ["about", "About", Info],
] as const;
const WIDE: Panel[] = ["timeline", "compare"];

const NO_RESULT = { result: null, direct: null, error: null, grid: null, uncertainty: [] as string[] };

/**
 * The analysis for one choice, or the reason there is none. Cheap (~13k samples), so it runs on render.
 * `relayUnpublished`: the chosen relay has no data file yet, so the result is direct-to-Earth only and says so.
 */
function runAnalysis(
  scenario: Scenario,
  slice: { startIndex: number; endIndex: number },
  site: SiteData,
  relay: RelayLinkData | null,
  relayUnpublished: boolean,
) {
  if (scenario.relayConfigId && !relay) {
    // Still loading: no result, never a DTE-only result shown as relay-assisted
    if (!relayUnpublished) return NO_RESULT;
    // Not published: the honest answer is the direct-to-Earth result, labelled as such (never a made-up relay)
    return runAnalysis({ ...scenario, relayConfigId: null }, slice, site, null, false);
  }
  try {
    // The grid and the uncertainty come from the same files the result was built from, at the same time
    const result = analyzeScenario(scenario, slice, site, relay);
    return {
      result,
      // F5: the same scenario without the relay, from the same files and slice
      direct: relay ? analyzeScenario({ ...scenario, relayConfigId: null }, slice, site, null) : result,
      error: null,
      grid: site.window,
      uncertainty: uncertaintySummaries(site, relay, scenario.antennaHeightM),
    };
  } catch (e) {
    return { ...NO_RESULT, error: message(e) };
  }
}

/** A loaded file, tagged with the choice it was loaded for, so a stale result is never shown for a new choice. */
type LoadState<T> = { for: string; data: T | null; error: string | null; unpublished?: boolean };

export default function Home() {
  const [index, setIndex] = useState<DatasetIndex | null>(null);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [site, setSite] = useState<LoadState<SiteData> | null>(null);
  const [relay, setRelay] = useState<LoadState<RelayLinkData> | null>(null);
  // Compare (F16): scenario B differs from A only by site and/or start date
  const [compareB, setCompareB] = useState<{ siteId: string; startUtc: string } | null>(null);
  const [bData, setBData] = useState<{ for: string; site: SiteData | null; relay: RelayLinkData | null; error: string | null } | null>(null);

  useEffect(() => {
    loadIndex()
      .then(({ data }) => {
        // Parse first: if this throws, nothing is set and the .catch shows the error
        const initial = parseScenario(window.location.search, data);
        setIndex(data);
        setScenario(initial);
      })
      .catch((e: unknown) => setIndexError(message(e)));
  }, []);

  // Site and relay load separately: toggling the relay doesn't refetch the site, and each fails on its own
  const siteId = scenario?.siteId ?? "";
  const relayId = scenario?.relayConfigId ?? null;
  const relayKey = relayId ? `${siteId}|${relayId}` : "";
  useEffect(() => {
    if (!index || !siteId) return;
    let live = true;
    loadSite(index, siteId).then(
      (r) => live && setSite({ for: siteId, data: r.data, error: null }),
      (e: unknown) => live && setSite({ for: siteId, data: null, error: message(e) }),
    );
    return () => {
      live = false;
    };
  }, [index, siteId]);
  useEffect(() => {
    if (!index || !relayId) return;
    let live = true;
    loadRelay(index, siteId, relayId).then(
      (r) => live && setRelay({ for: relayKey, data: r.data, error: null, unpublished: false }),
      (e: unknown) =>
        live &&
        setRelay({
          for: relayKey,
          data: null,
          error: message(e),
          // Only a file known not to exist (404, or not listed in index.json) is "not published";
          // a network failure or a 5xx is a load error, never reported as a fact about the dataset
          unpublished: e instanceof DataError && e.absent,
        }),
    );
    return () => {
      live = false;
    };
  }, [index, siteId, relayId, relayKey]);

  const bSiteId = compareB?.siteId ?? "";
  const bKey = bSiteId ? `${bSiteId}|${relayId ?? ""}` : "";
  useEffect(() => {
    if (!index || !bSiteId) return;
    let live = true;
    const hasRelay = !!relayId && !!index.relayConfigs.find((c) => c.id === relayId)?.dataFiles[bSiteId];
    Promise.all([loadSite(index, bSiteId).then((r) => r.data), hasRelay && relayId ? loadRelay(index, bSiteId, relayId).then((r) => r.data) : Promise.resolve(null)]).then(
      ([s, r]) => live && setBData({ for: bKey, site: s, relay: r, error: null }),
      (e: unknown) => live && setBData({ for: bKey, site: null, relay: null, error: message(e) }),
    );
    return () => {
      live = false;
    };
  }, [index, bSiteId, relayId, bKey]);

  // Errors count only for the current choice; the relay only counts once it is loaded for the current choice, so no
  // relay-assisted number is shown before that
  const siteNow = site?.for === siteId ? site : null;
  const relayNow = relayKey && relay?.for === relayKey ? relay : null;
  // A relay config listed in index.json whose file isn't there yet is "not published", not an error
  const relayUnpublished = !!relayNow?.unpublished;
  const selectedRelayName = index?.relayConfigs.find((c) => c.id === scenario?.relayConfigId)?.name ?? null;
  // The relay the numbers actually use: none when its file isn't published for this site (then they are DTE only)
  const usedRelayName = relayUnpublished ? null : selectedRelayName;
  const noRelayReason = relayUnpublished ? `${selectedRelayName ?? "the selected relay"} data isn't published yet for this site` : undefined;
  const errors = [indexError, siteNow?.error ?? null, relayUnpublished ? null : (relayNow?.error ?? null)].filter((e): e is string => !!e);

  // Keep the URL in step with the controls, without a history write on every slider tick, and keep any #anchor
  useEffect(() => {
    if (!scenario) return;
    const id = setTimeout(() => window.history.replaceState(null, "", `?${toSearch(scenario)}${window.location.hash}`), 250);
    return () => clearTimeout(id);
  }, [scenario]);

  // One window rule for the whole app: network.sliceWindow (N3). Its return type is the whole ScenarioError
  // union, so the code check is what lets TypeScript read `.supported`.
  const sliced = useMemo(() => (index && scenario ? sliceWindow(index.window, scenario.startUtc, scenario.durationDays) : null), [index, scenario]);
  const outside = sliced && "code" in sliced && sliced.code === "outside-window" ? sliced : null;
  const slice = sliced && !("code" in sliced) ? sliced : null;

  // I1: the result for the current choice, once its files are in. Outside the window there is no result (§5);
  // with a relay selected, no result until that relay file is in (never a DTE-only result shown as relay-assisted).
  // Memoized so the replay's ticks don't rerun it.
  const siteData = siteNow?.data ?? null;
  const relayData = relayNow?.data ?? null;
  const analysis = useMemo(
    () => (scenario && slice && siteData ? runAnalysis(scenario, slice, siteData, relayData, relayUnpublished) : NO_RESULT),
    [scenario, slice, siteData, relayData, relayUnpublished],
  );
  const result = analysis.result;

  // Mission replay: one clock for the hero, the sky view and the timelines. It restarts at 0 for each new site/window.
  const n = slice ? slice.endIndex - slice.startIndex : 0;
  const replayKey = `${siteId}|${scenario?.startUtc}|${scenario?.durationDays}`;
  const [clock, setClock] = useState({ key: "", step: 0 });
  const step = clock.key === replayKey ? Math.min(clock.step, Math.max(n - 1, 0)) : 0;
  const setStep = useCallback((s: number) => setClock({ key: replayKey, step: s }), [replayKey]);
  const [playing, setPlaying] = useState(false);
  // Page chrome: the stage tab, and the one side panel open (none at first: the 3D gets the screen)
  const [tab, setTab] = useState<"orbit" | "lander">("orbit");
  const [panel, setPanel] = useState<Panel | null>(null);
  // Story mode: the chapter shown (null = planner), auto-play for the demo video, and a counter that replays the landing
  const [story, setStory] = useState<number | null>(null);
  const [demo, setDemo] = useState(false);
  const [landingKey, setLandingKey] = useState(0);
  const [speed, setSpeed] = useState<Speed>(6);
  useEffect(() => {
    if (!playing || n < 2) return;
    const id = setInterval(() => setClock((c) => ({ key: replayKey, step: ((c.key === replayKey ? c.step : 0) + speed) % n })), 120);
    return () => clearInterval(id);
  }, [playing, speed, n, replayKey]);
  const replay: Replay | null = slice ? { step, n, playing, speed, setStep, setPlaying, setSpeed } : null;

  // The first look shows the selected site's sky at the replay time: file values, and links from the result
  const i = slice ? slice.startIndex + step : -1;
  const sd = siteNow?.data;
  const siteMeta = index?.sites.find((s) => s.id === siteId);
  // Orbit tracks are rebuilt once per replay day (a satellite stays on its drawn orbit for at least that long)
  const perDay = index ? Math.round(86400 / index.window.stepSeconds) : 1;
  const trackFrom = slice ? slice.startIndex + perDay * Math.floor(step / perDay) : -1;
  const tracks = useMemo(
    () => (relayData && siteMeta && trackFrom >= 0 ? relayTracks(siteMeta.latDeg, siteMeta.lonEastDeg, relayData, trackFrom) : []),
    [relayData, siteMeta, trackFrom],
  );
  const positions = relayData && siteMeta && i >= 0 ? relayPositionsKm(siteMeta.latDeg, siteMeta.lonEastDeg, relayData, i) : {};
  const heroSky =
    sd && i >= 0
      ? {
          earthAzDeg: sd.earth.azimuthDeg[i]!,
          earthElDeg: sd.earth.elevationDeg[i]!,
          sunAzDeg: sd.sun.azimuthDeg[i]!,
          sunElDeg: sd.sun.elevationDeg[i]!,
          dte: result ? result.dte[step] === 1 : null,
          // A satellite's link is its complete path from the result (§5)
          relays: tracks.map((t) => ({
            ...t,
            nowKm: positions[t.id]!,
            linked: result?.scenario.relayConfigId ? result.relayPerSatellite[t.id]?.[step] === 1 : null,
          })),
        }
      : null;
  const status: LinkStatus | null = result ? (result.dte[step] ? "direct" : result.connected[step] ? "relay" : "blackout") : null;
  const atUtc = index && i >= 0 ? new Date(Date.parse(index.window.startUtc) + i * index.window.stepSeconds * 1000).toISOString() : null;
  // The readout's table: the same file values both 3D views draw
  const bodies = useMemo(() => (sd && i >= 0 ? bodiesAt(sd, relayData, i) : []), [sd, relayData, i]);

  // Planner insights (lib/lunanav/insights.ts): recomputed only when the result changes, never per replay tick
  const grid = analysis.grid;
  const resultRelay = result?.scenario.relayConfigId ? relayData : null;
  const events = useMemo(() => (result && grid ? linkEvents(result, grid) : []), [result, grid]);
  const next = grid ? nextChange(events, step, grid.stepSeconds) : null;
  const shares = useMemo(() => (result && grid ? satelliteShares(result, resultRelay, grid.stepSeconds) : []), [result, resultRelay, grid]);
  const talk = result && grid ? powerAndTalk(result, grid.stepSeconds) : null;
  // Dozens of reruns of the analysis: only while the Plan panel (curve, scores) or the story (best start) shows them
  const planShown = panel === "plan" || story !== null;
  const curve = useMemo(() => (panel === "plan" && result && sd ? maskCurve(result.scenario, result.slice, sd, resultRelay, MAX_MASK_DEG) : []), [panel, result, sd, resultRelay]);
  const scores = useMemo(() => (planShown && index && result && sd ? windowScores(index, result.scenario, sd, resultRelay) : []), [planShown, index, result, sd, resultRelay]);
  const best = useMemo(() => bestWindow(scores), [scores]);
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    // From the scenario, not location.href: the URL is updated 250 ms after a change
    if (!scenario) return;
    const { origin, pathname, hash } = window.location;
    void navigator.clipboard?.writeText(`${origin}${pathname}?${toSearch(scenario)}${hash}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const downloadCsv = () => {
    if (!result || !grid) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([resultCsv(result, grid)], { type: "text/csv" }));
    a.download = `lunanav_${result.scenario.siteId}_${result.scenario.relayConfigId ?? "direct"}_${dateOf(result.scenario.startUtc)}_${result.scenario.durationDays}d.csv`;
    a.click();
    // Revoked after the click is handled: revoking at once can cancel the download in some browsers
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  };
  // Only offer relay configs that have a file for this site
  const relays = index?.relayConfigs.filter((c) => !!c.dataFiles[siteId]) ?? [];
  // The lander view stays mounted once shown: unmounting its Canvas makes React fail removing the drei Html labels (the
  // page froze). While a new site or window loads it keeps the last files, with no links (no result for them yet).
  const landerNow = index && scenario && slice && siteNow?.data ? { site: siteNow.data, relay: relayNow?.data ?? null, slice, antennaHeightM: scenario.antennaHeightM, minElevationDeg: scenario.minElevationDeg } : null;
  const [landerKept, setLanderKept] = useState(landerNow);
  if (
    landerNow &&
    (landerKept?.site !== landerNow.site || landerKept.relay !== landerNow.relay || landerKept.slice !== landerNow.slice || landerKept.antennaHeightM !== landerNow.antennaHeightM || landerKept.minElevationDeg !== landerNow.minElevationDeg)
  ) {
    setLanderKept(landerNow);
  }
  const lander = landerKept ? { ...landerKept, fresh: !!landerNow } : null;

  // ---- Compare: B through the same analysis as A ----
  const bNow = bData && bData.for === bKey ? bData : null;
  const sideB = useMemo(() => {
    if (!index || !scenario || !compareB || !bNow?.site) return null;
    const sc = normalizeScenario({ ...scenario, siteId: compareB.siteId, startUtc: compareB.startUtc, relayConfigId: bNow.relay ? scenario.relayConfigId : null }, index);
    const sl = sliceWindow(index.window, sc.startUtc, sc.durationDays);
    if ("code" in sl) return { outside: true as const, side: null, notes: [], error: null };
    let r;
    try {
      r = analyzeScenario(sc, sl, bNow.site, bNow.relay);
    } catch (e) {
      // Same as A (runAnalysis): a bad file shows as an error, it must not throw out of render and blank the page
      return { outside: false as const, side: null, notes: [], error: message(e) };
    }
    const ev = linkEvents(r, index.window);
    const name = index.sites.find((x) => x.id === sc.siteId)?.name ?? sc.siteId;
    const notes = [
      ...(sc.antennaHeightM !== scenario.antennaHeightM ? [`B's site has no ${scenario.antennaHeightM} m antenna horizon, so B uses ${sc.antennaHeightM} m.`] : []),
      ...(scenario.relayConfigId && !sc.relayConfigId ? ["The relay's file isn't published for B's site, so B is direct to Earth only."] : []),
    ];
    return {
      outside: false as const,
      side: {
        label: `${name} · ${dateOf(sc.startUtc)} · ${sc.durationDays} d · ${sc.relayConfigId ? (index.relayConfigs.find((c) => c.id === sc.relayConfigId)?.name ?? sc.relayConfigId) : "direct only"}`,
        summary: r.summary,
        n: r.connected.length,
        segments: ev.map((e, k) => ({ start: e.step, end: ev[k + 1]?.step ?? r.connected.length, state: e.state })),
      },
      notes,
      error: null,
    };
  }, [index, scenario, compareB, bNow]);
  const openCompare = () => {
    if (!index || !scenario) return;
    setCompareB({ siteId: index.sites.find((x) => x.id !== scenario.siteId)?.id ?? scenario.siteId, startUtc: scenario.startUtc });
  };
  const snapshot = () => {
    const c = document.querySelector<HTMLCanvasElement>(`#panel-${tab} canvas`);
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `lunanav_${siteId}_${tab}_${atUtc ? atUtc.slice(0, 16).replace(/[:T]/g, "-") : "view"}.png`;
    a.click();
  };

  // ---- Story: five chapters, every number filled in from the result ----
  const directEvents = useMemo(() => (analysis.direct && grid ? linkEvents(analysis.direct, grid) : []), [analysis.direct, grid]);
  const firstBlackout = directEvents.find((e) => e.state === "blackout") ?? null;
  const storyRelayId = relays[0]?.id ?? null;
  const storyRelayName = relays[0]?.name ?? "a relay";
  const ds = analysis.direct?.summary;
  const rs = result?.scenario.relayConfigId ? result.summary : null;
  const chapters: Chapter[] = [
    {
      title: `Mission: ${siteMeta?.name ?? "south pole"}`,
      text: siteMeta && scenario
        ? `A lander at ${siteMeta.latDeg.toFixed(4)}°, ${siteMeta.lonEastDeg.toFixed(3)}° E${siteMeta.heightM != null ? `, ${siteMeta.heightM.toFixed(0)} m up` : ""}, near the lunar south pole. Mission: ${scenario.durationDays} days from ${dateOf(scenario.startUtc)} UTC.`
        : "Loading the site…",
    },
    {
      title: "Touchdown",
      text: "The lander sets down. From now on, every ten minutes LunaNav checks two paths home: straight to Earth over the terrain, and through a relay satellite that can see Earth.",
    },
    {
      title: "Earth sets behind the ridge",
      text: ds
        ? `On its own, the lander sees Earth ${ds.dteCoveragePct.toFixed(1)}% of the time. Earth sits low and wobbles with libration, so the terrain hides it: the longest silence is ${ds.longestBlackoutHours.toFixed(1)} h${firstBlackout ? `, from ${firstBlackout.utc.slice(0, 16).replace("T", " ")} UTC` : ""}.`
        : "Computing the direct-to-Earth line of sight…",
    },
    {
      title: "The relay picks up",
      text: rs && ds
        ? `With ${storyRelayName}: a path home ${rs.coveragePct.toFixed(1)}% of the time (+${rs.relayGainPct.toFixed(1)} points), and the longest blackout drops from ${ds.longestBlackoutHours.toFixed(1)} h to ${rs.longestBlackoutHours.toFixed(1)} h.`
        : storyRelayId
          ? "Loading the relay constellation…"
          : "No relay configuration has data for this site.",
    },
    {
      title: "Plan your own",
      text: best
        ? `Now change the site, the dates or the relay. For a ${scenario?.durationDays ?? ""}-day mission here, the best start in the data window is ${best.startUtc.slice(0, 10)} (${best.coveragePct.toFixed(1)}%). Geometric line-of-sight only.`
        : "Now change the site, the dates or the relay. Geometric line-of-sight only.",
    },
  ];
  const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The story switches the relay to tell its tale; the user's own choice comes back when it ends
  const storyRelay = useRef<string | null | undefined>(undefined);
  const endStory = () => {
    setStory(null);
    setDemo(false);
    const back = storyRelay.current;
    storyRelay.current = undefined;
    if (back !== undefined && index && scenario) setScenario(normalizeScenario({ ...scenario, relayConfigId: back }, index));
  };
  const goChapter = (c: number) => {
    if (!index || !scenario) return;
    const withRelay = (id: string | null) => setScenario(normalizeScenario({ ...scenario, relayConfigId: id }, index));
    if (c >= chapters.length) {
      endStory();
      setPanel("scenario");
      if (!reducedMotion()) setPlaying(true);
      return;
    }
    setStory(Math.max(0, c));
    if (c <= 0) {
      withRelay(null);
      setTab("orbit");
      setPlaying(false);
      setStep(0);
    } else if (c === 1) {
      setTab("orbit");
      setLandingKey((k) => k + 1);
    } else if (c === 2) {
      withRelay(null);
      setTab("lander");
      setPlaying(false);
      setStep(firstBlackout?.step ?? 0);
    } else if (c === 3) {
      if (storyRelayId) withRelay(storyRelayId);
      setTab("orbit");
      setStep(firstBlackout?.step ?? 0);
      if (!reducedMotion()) setPlaying(true);
    } else {
      setTab("lander");
    }
  };
  const startStory = () => {
    if (storyRelay.current === undefined) storyRelay.current = scenario?.relayConfigId ?? null;
    goChapter(0);
  };
  // Auto-play (demo video): next chapter every 7 s. The latest goChapter is read from a ref, so replay ticks
  // (a render every 120 ms) don't restart the timer
  const goRef = useRef(goChapter);
  useEffect(() => {
    goRef.current = goChapter;
  });
  useEffect(() => {
    if (!demo || story === null) return;
    const id = setTimeout(() => goRef.current(story + 1), 7000);
    return () => clearTimeout(id);
  }, [demo, story]);

  // Keyboard: N / P next or previous event, 1 / 2 the stage views, Space play (not while typing or on a control)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || t.closest("input, select, textarea, button, [contenteditable]")) return;
      const k = e.key.toLowerCase();
      if (k === "n") {
        const ev = events.find((x) => x.step > step);
        if (ev) setStep(ev.step);
      } else if (k === "p") {
        const ev = events.findLast((x) => x.step < step);
        if (ev) setStep(ev.step);
      } else if (k === "1") setTab("orbit");
      else if (k === "2") setTab("lander");
      else if (k === " " && n > 1) {
        e.preventDefault();
        setPlaying((on) => !on);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [events, step, setStep, n]);
  const dates = index && windowDates(index.window);

  const TOOL =
    "inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-sm border border-border px-2.5 font-mono text-[11px] font-semibold tracking-[0.08em] text-foreground uppercase transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
  const TAB = "min-h-11 cursor-pointer px-4 font-mono text-xs font-semibold tracking-[0.12em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  return (
    <>
      <MissionBar>
        {siteMeta && scenario && (
          <button
            type="button"
            onClick={() => setPanel(panel === "scenario" ? null : "scenario")}
            aria-label="Edit the scenario"
            className="hidden min-h-9 min-w-0 cursor-pointer items-center gap-2 rounded-sm border border-border px-2.5 normal-case tracking-normal text-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:inline-flex"
          >
            <SlidersHorizontal aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-sans text-xs font-medium">
              {siteMeta.name} · {usedRelayName ?? (relayUnpublished ? "direct only (relay not published here)" : "direct only")} · {dateOf(scenario.startUtc)} · {scenario.durationDays} d
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={startStory}
          className="inline-flex min-h-9 shrink-0 cursor-pointer items-center rounded-sm bg-primary px-3 text-primary-foreground hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Play aria-hidden className="mr-1.5 size-4" />
          Story
        </button>
      </MissionBar>
      <div className="flex min-w-0 flex-col lg:h-[calc(100svh-3rem)] lg:flex-row">
        <main className="flex min-w-0 flex-1 flex-col gap-2 p-2 sm:p-3">
          {errors.map((e, i) => (
            <p key={i} role="alert" className="text-sm text-red-400">
              Could not load data: {e}
            </p>
          ))}
          {analysis.error && (
            <p role="alert" className="text-sm text-red-400">
              Could not compute this scenario: {analysis.error}
            </p>
          )}
          {outside && (
            <p role="alert" className="rounded-sm border border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-300">
              Outside the supported data window: data covers {dateOf(outside.supported.startUtc)} to {windowLastDate(outside.supported)} UTC,
              so a scenario can start from {dates?.min} to {dates?.max} and must end by {windowLastDate(outside.supported)}. No numbers are
              shown for these dates.
            </p>
          )}
          {relayUnpublished && (
            <p role="status" className="rounded-sm border border-sky-400/30 bg-sky-400/10 p-3 text-sm text-sky-200">
              Relay data for {index?.relayConfigs.find((c) => c.id === scenario?.relayConfigId)?.name ?? "this configuration"} at this site isn&apos;t
              published yet, so these results are direct-to-Earth only.
            </p>
          )}

          {/* The stage: the 3D simulation, then the four numbers and the clock under it (never on it) */}
          <section aria-label="Mission simulation" className="dark flex min-h-0 min-w-0 flex-col overflow-hidden rounded-sm border border-border bg-card text-foreground lg:flex-1">
            <div role="tablist" aria-label="View" className="flex border-b border-border">
              {(
                [
                  ["orbit", "Orbit view"],
                  ["lander", "At the lander"],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  id={`tab-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`panel-${t}`}
                  onClick={() => setTab(t)}
                  className={`${TAB} border-b-2 ${tab === t ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}
                >
                  {label}
                </button>
              ))}
              <button type="button" onClick={snapshot} aria-label="Save the 3D view as a PNG image" className={`${TOOL} my-auto mr-2 ml-auto`}>
                <Camera aria-hidden className="size-4" />
                <span className="hidden sm:inline">Snapshot</span>
              </button>
            </div>
            {/* Both views stay mounted (a remounted Canvas froze the page); the hidden one draws no frames */}
            <div className="relative h-[440px] sm:h-[520px] lg:h-auto lg:min-h-0 lg:flex-1">
              <div id="panel-orbit" role="tabpanel" aria-labelledby="tab-orbit" className={`absolute inset-0 ${tab === "orbit" ? "" : "invisible"}`}>
                <OrbitView
                  sites={index?.sites.map((x) => ({ id: x.id, name: x.name, latDeg: x.latDeg, lonEastDeg: x.lonEastDeg })) ?? []}
                  selectedId={siteId || null}
                  sky={heroSky}
                  active={tab === "orbit"}
                  landingKey={landingKey}
                />
              </div>
              <div id="panel-lander" role="tabpanel" aria-labelledby="tab-lander" className={`absolute inset-0 ${tab === "lander" ? "" : "invisible"}`}>
                {lander && (
                  <SkyPanel
                    site={lander.site}
                    relay={lander.relay}
                    slice={lander.slice}
                    antennaHeightM={lander.antennaHeightM}
                    minElevationDeg={lander.minElevationDeg}
                    result={lander.fresh ? result : null}
                    replay={replay ?? STILL}
                    active={tab === "lander"}
                  />
                )}
              </div>
            </div>
            {/* The four numbers, the link now and the next change: the rest is one click away in the rail */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border px-3 py-2">
              <LinkChip status={status} />
              {result && (
                <dl className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs">
                  {(
                    [
                      ["Coverage", `${result.summary.coveragePct.toFixed(1)}%`],
                      ["Longest blackout", `${result.summary.longestBlackoutHours.toFixed(1)} h`],
                      ["Blackouts", String(result.summary.blackoutCount)],
                      ["Sunlit", `${result.summary.sunlitPct.toFixed(1)}%`],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-baseline gap-1.5">
                      <dt className="text-[10px] tracking-[0.08em] text-muted-foreground uppercase">{k}</dt>
                      <dd className="font-semibold text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              <span className="font-mono text-xs text-muted-foreground lg:ml-auto">{atUtc ? `${atUtc.slice(0, 16).replace("T", " ")} UTC` : ""}</span>
            </div>
            {/* Mission scrubber: the link state over the whole scenario; one clock for everything */}
            {replay && (
              <div className="border-t border-border px-3 py-2">
                <ReplayBar replay={replay} segments={events.map((e, k) => ({ start: e.step, end: events[k + 1]?.step ?? n, state: e.state }))} />
              </div>
            )}
            <p className="border-t border-border px-3 py-1.5 font-mono text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              <span className="text-[var(--link-direct)]">■ direct</span> <span className="text-[var(--link-relay)]">■ via relay</span>{" "}
              <span className="text-[var(--link-blocked)]">■ blackout</span> · geometric line of sight · Horizons + LOLA
              {relayData ? " · simulated relay orbits, heights shrunk" : ""} · not to scale
              {tab === "lander" ? " · craters, rocks and ice are decoration; the skyline is the site's terrain horizon" : ""}
            </p>
          </section>
        </main>

        {/* Side panels: one open at a time, beside the stage on desktop (it shrinks, nothing covers it), under it on phones */}
        <aside aria-label="Details" className="flex min-w-0 flex-col border-border lg:flex-row lg:border-l">
          {(panel || story !== null) && (
            <div
              id="side-panel"
              className={`flex min-w-0 flex-col gap-4 overflow-y-auto border-border bg-background p-3 [scrollbar-width:thin] max-lg:order-last lg:w-[380px] ${panel && WIDE.includes(panel) ? "lg:w-[min(600px,46vw)]" : ""}`}
            >
              {story !== null && (
                <StoryCard chapters={chapters} at={story} demo={demo} onGo={goChapter} onClose={endStory} onDemo={setDemo} />
              )}
              {panel && (
                <div className="flex items-center justify-between">
                  <h2 className="font-mono text-xs font-semibold tracking-[0.14em] text-foreground uppercase">{PANELS.find(([id]) => id === panel)?.[1]}</h2>
                  <button
                    type="button"
                    onClick={() => setPanel(null)}
                    aria-label="Close the panel"
                    className="-mr-1 grid size-9 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
              )}
              {panel === "scenario" && index && scenario && dates && (
                <>
                  <ControlBar
                    scenario={scenario}
                    sites={index.sites.map(toOption)}
                    relays={relays.map(toOption)}
                    antennaHeightsM={siteMeta?.antennaHeightsM ?? []}
                    dates={dates}
                    maxDays={windowDays(index.window)}
                    onChange={(next) => setScenario(normalizeScenario(next, index))}
                  />
                  <MaskControl valueDeg={scenario.minElevationDeg} onChange={(deg) => setScenario(normalizeScenario({ ...scenario, minElevationDeg: deg }, index))} />
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={copyLink} className={TOOL}>
                      <Link2 aria-hidden className="size-4" />
                      {copied ? "Copied" : "Copy link"}
                    </button>
                    <button type="button" onClick={downloadCsv} disabled={!result} className={TOOL}>
                      <Download aria-hidden className="size-4" />
                      CSV
                    </button>
                  </div>
                </>
              )}
              {panel === "results" && (
                <>
                  <div>
                    <LinkChip status={status} large />
                    {result && <NextChange next={next} />}
                    {talk && (
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        Sun up and a path to Earth: <b className="text-foreground">{talk.hours.toFixed(1)} h</b> ({talk.pct.toFixed(1)}%)
                      </p>
                    )}
                  </div>
                  <MetricCards result={result} uncertainty={analysis.uncertainty} noRelayReason={noRelayReason} />
                  <Comparison
                    rows={analysis.direct ? comparisonRows(analysis.direct, result?.scenario.relayConfigId ? result : null) : null}
                    relayName={selectedRelayName}
                    relayNote={relayUnpublished ? "Relay data for this site isn't published yet" : undefined}
                  />
                  <BodiesTable bodies={bodies} atUtc={atUtc} />
                </>
              )}
              {panel === "timeline" && (
                <>
                  <Timelines result={result} grid={analysis.grid} noRelayReason={noRelayReason && `No relay result: ${noRelayReason}.`} cursor={replay ? step : undefined} onSeek={replay ? setStep : undefined} />
                  {result && <EventsLog events={events} step={step} onJump={setStep} />}
                </>
              )}
              {panel === "plan" && result && index && scenario && (
                <>
                  <WindowCalendar
                    scores={scores}
                    best={best}
                    currentStartUtc={scenario.startUtc}
                    durationDays={scenario.durationDays}
                    onPick={(startUtc) => setScenario(normalizeScenario({ ...scenario, startUtc }, index))}
                  />
                  <MaskCurve points={curve} currentDeg={scenario.minElevationDeg} hasRelay={!!result.scenario.relayConfigId} />
                </>
              )}
              {panel === "network" && result && grid && index && scenario && (
                <>
                  <SatelliteShares shares={shares} totalHours={(result.connected.length * grid.stepSeconds) / 3600} />
                  <PolarMap
                    sites={index.sites.map((x) => ({ id: x.id, name: x.name, latDeg: x.latDeg, lonEastDeg: x.lonEastDeg }))}
                    selectedId={siteId}
                    onSelect={(id) => setScenario(normalizeScenario({ ...scenario, siteId: id }, index))}
                  />
                </>
              )}
              {panel === "compare" && result && index && scenario && dates && siteMeta && (
                compareB ? (
                  <CompareAB
                    a={{
                      label: `${siteMeta.name} · ${dateOf(scenario.startUtc)} · ${scenario.durationDays} d · ${usedRelayName ?? "direct only"}`,
                      summary: result.summary,
                      n: result.connected.length,
                      segments: events.map((e, k) => ({ start: e.step, end: events[k + 1]?.step ?? result.connected.length, state: e.state })),
                    }}
                    b={sideB && !sideB.outside ? sideB.side : null}
                    rows={abRows(result.summary, sideB?.side?.summary ?? null)}
                    notes={sideB?.notes ?? []}
                    bNote={bNow?.error ? `Could not load B: ${bNow.error}` : sideB?.error ? `Could not compute B: ${sideB.error}` : sideB?.outside ? "B is outside the supported data window: no numbers." : "Loading B…"}
                    sites={index.sites.map(toOption)}
                    bSiteId={compareB.siteId}
                    bDate={dateOf(compareB.startUtc)}
                    dates={dates}
                    onSite={(id) => setCompareB({ ...compareB, siteId: id })}
                    onDate={(d) => setCompareB({ ...compareB, startUtc: `${d}T00:00:00Z` })}
                    onClose={() => setCompareB(null)}
                  />
                ) : (
                  <button type="button" onClick={openCompare} className={`${TOOL} min-h-11 w-fit px-4`}>
                    <GitCompareArrows aria-hidden className="size-4" />
                    Compare with another site or date
                  </button>
                )
              )}
              {panel === "about" && (
                <div className="flex flex-col gap-3 text-sm">
                  <p className="text-base leading-snug text-foreground">Pick the south-pole landing site, and the dates, where your lander can talk to Earth.</p>
                  <p className="text-muted-foreground">
                    Every ten minutes: is there a path to Earth, direct or through a relay, and is the Sun up. Geometric line of sight only: no
                    link budget, scheduling or interference. Sun and Earth from JPL Horizons, terrain from LOLA; relays are simulated reference
                    orbits, not deployed satellites.
                  </p>
                  <ol className="flex list-decimal flex-col gap-1 pl-5 text-foreground">
                    <li>Pick a site and dates (Scenario)</li>
                    <li>Watch the link in 3D and scrub the clock</li>
                    <li>Turn on a relay and compare</li>
                  </ol>
                  <p className="font-mono text-xs text-muted-foreground">Keys: Space play · N / P next / previous change · 1 / 2 views</p>
                </div>
              )}
            </div>
          )}
          <nav aria-label="Panels" className="flex shrink-0 gap-1 overflow-x-auto border-y border-border p-1.5 lg:flex-col lg:overflow-visible lg:border-y-0 lg:border-l">
            {PANELS.map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setPanel(panel === id ? null : id)}
                aria-pressed={panel === id}
                aria-controls="side-panel"
                className={`flex min-h-11 min-w-14 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-sm px-1 py-1.5 font-mono text-[9px] font-semibold tracking-[0.06em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${panel === id ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                <Icon aria-hidden className="size-[18px]" />
                {label}
              </button>
            ))}
          </nav>
        </aside>
      </div>
    </>
  );
}
