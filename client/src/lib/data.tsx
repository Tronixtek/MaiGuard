import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, API_BASE } from "./api";
import { useAuth } from "./auth";
import type { Alert, Delivery, Meta, Subscriber, Trend } from "./types";

interface Data {
  meta: Meta | null;
  alerts: Alert[];
  deliveries: Delivery[];
  trends: Trend[];
  subscribers: Subscriber[];
  live: boolean;
  /** Ids of deliveries that arrived over the live stream this session; used to animate them. */
  fresh: Set<string>;
  refresh: () => Promise<void>;
}

const DataContext = createContext<Data | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { voice } = useAuth();
  const [meta, setMeta] = useState<Meta | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [trends, setTrends] = useState<Trend[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [live, setLive] = useState(false);
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const [m, a] = await Promise.all([api.meta(), api.alerts()]);
    townTimeZone = m.timeZone;
    setMeta(m);
    setAlerts(a);
  }, []);

  // Trends, subscribers and deliveries are for trusted voices only.
  const signedIn = Boolean(voice);
  const refreshTrends = useCallback(() => {
    if (signedIn) api.trends().then(setTrends).catch(() => {});
    else setTrends([]);
  }, [signedIn]);
  const refreshSubscribers = useCallback(() => {
    if (signedIn) api.subscribers().then(setSubscribers).catch(() => {});
    else setSubscribers([]);
  }, [signedIn]);
  useEffect(() => {
    refreshTrends();
    refreshSubscribers();
    if (signedIn) api.deliveries().then(setDeliveries).catch(() => {});
    else setDeliveries([]);
  }, [signedIn, refreshTrends, refreshSubscribers]);

  useEffect(() => {
    refresh().catch(() => {});
    const es = new EventSource(`${API_BASE}/api/stream`);
    es.addEventListener("open", () => setLive(true));
    es.addEventListener("error", () => setLive(false));
    es.addEventListener("subscriber", refreshSubscribers);
    es.addEventListener("delivery", (e) => {
      const { delivery } = JSON.parse((e as MessageEvent).data) as { delivery: Delivery };
      setDeliveries((prev) => (prev.some((d) => d.id === delivery.id) ? prev : [delivery, ...prev]));
      setFresh((prev) => new Set(prev).add(delivery.id));
    });
    es.addEventListener("alert", () => {
      api.alerts().then(setAlerts).catch(() => {});
      refreshTrends();
    });
    es.addEventListener("check", refreshTrends);
    es.addEventListener("reset", () => {
      setFresh(new Set());
      refresh().catch(() => {});
      refreshTrends();
      refreshSubscribers();
      if (signedIn) api.deliveries().then(setDeliveries).catch(() => {});
    });
    return () => es.close();
  }, [refresh, refreshTrends, refreshSubscribers, signedIn]);

  const value = useMemo(
    () => ({ meta, alerts, deliveries, trends, subscribers, live, fresh, refresh }),
    [meta, alerts, deliveries, trends, subscribers, live, fresh, refresh],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}

/** Times are shown in the town's clock, matching the SMS bodies, whatever the viewer's timezone. */
let townTimeZone: string | undefined;
export const timeOf = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: townTimeZone }).format(new Date(iso));

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return `${h} h ago`;
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");
