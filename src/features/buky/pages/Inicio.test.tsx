import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { LayerSpecification, LngLatBounds } from "maplibre-gl";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BukyMap from "../components/BukyMap";
import type { BukyRoute, RoutePoint } from "../lib/api";
import type { Position } from "../lib/useGeolocation";
import Inicio from "./Inicio";

const map = vi.hoisted(() => ({
  fitBounds: vi.fn(),
  easeTo: vi.fn(),
  addLayer: vi.fn(),
  setLngLat: vi.fn(),
  load: undefined as (() => void) | undefined,
}));

vi.mock("maplibre-gl", () => {
  // maplibre real não carrega no jsdom (createObjectURL); um LngLatBounds mínimo basta aqui.
  class FakeBounds {
    sw: [number, number];
    ne: [number, number];
    constructor(sw: [number, number], ne: [number, number]) { this.sw = [...sw]; this.ne = [...ne]; }
    extend([lon, lat]: [number, number]) {
      this.sw = [Math.min(this.sw[0], lon), Math.min(this.sw[1], lat)];
      this.ne = [Math.max(this.ne[0], lon), Math.max(this.ne[1], lat)];
      return this;
    }
    toArray() { return [this.sw, this.ne]; }
  }
  return {
    default: {
      LngLatBounds: FakeBounds,
      Map: class {
        fitBounds = map.fitBounds;
        easeTo = map.easeTo;
        addLayer = map.addLayer;
        addControl() {}
        addSource() {}
        setFilter() {}
        setLayoutProperty() {}
        remove() {}
        getZoom() { return 13.4; }
        getStyle() { return { glyphs: true }; }
        getSource() { return { setData() {} }; }
        on(event: string, callback: () => void) {
          if (event === "load") map.load = callback;
        }
      },
      AttributionControl: class {},
      Marker: class {
        addTo() { return this; }
        remove() {}
        setLngLat(coordinates: [number, number]) {
          map.setLngLat(coordinates);
          return this;
        }
      },
    },
  };
});

vi.mock("../lib/mapStyle", () => ({ loadDarkStyle: vi.fn().mockResolvedValue({}) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/platform", () => ({ IS_NATIVE: true }));
vi.mock("@/lib/walletApi", () => ({ apiGetMyWallet: vi.fn() }));
vi.mock("../components/HomeExtras", () => ({ default: () => null }));
vi.mock("../components/loja/shared", () => ({ useShopEnabled: () => ({ data: false }) }));
vi.mock("../training/useTraining", () => ({ training: {} }));
vi.mock("../training/gpsSource", () => ({ getGpsSource: () => ({ kind: "native" }) }));
vi.mock("../lib/useGeolocation", () => ({ useGeolocation: () => ({ pos }) }));
vi.mock("../lib/hooks", () => ({
  useBukyProfile: () => ({}),
  useCity: () => ({}),
  useRoutes: () => ({ data: routes }),
  useSummary: () => ({ data: { balance: 27 } }),
  useMyStatus: () => ({
    data: {
      free_enabled: true,
      sessions_today: 1,
      sessions_max: 2,
      bukys_today: 4,
      bukys_max: 10,
      rules: {},
    },
  }),
  useMyPassedPointsToday: () => ({ data: ["p1"] }),
  useCouponsHere: () => ({ coupons: [], away: false }),
}));

const start = { lat: -22.9, lon: -43.15 };
const point = (id: string, seq: number, lat: number, lon: number): RoutePoint => ({
  id, seq, lat, lon, label: id, radiusM: 50,
});
const firstRoute: BukyRoute = {
  id: "orla",
  name: "Orla de Niterói",
  city_code: 1,
  kind: "official",
  owner_id: null,
  active: true,
  length_m: null,
  path: [start, { lat: -22.95, lon: -43.21 }],
  points: [point("p1", 0, -22.91, -43.16), point("p2", 1, -22.92, -43.17)],
};
const secondRoute: BukyRoute = {
  ...firstRoute,
  id: "inga",
  name: "Ingá",
  path: [],
  points: [point("p3", 0, start.lat, start.lon), point("p4", 1, -22.89, -43.1)],
};
let routes: BukyRoute[];
let pos: Position;
let queryClient: QueryClient;

function view() {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Inicio />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

async function loadMap() {
  await act(async () => {
    await Promise.resolve();
    map.load!();
  });
}

function layer(id: string) {
  return map.addLayer.mock.calls.map(([layer]) => layer as LayerSpecification).find((layer) => layer.id === id);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  map.load = undefined;
  queryClient = new QueryClient();
  routes = [firstRoute, secondRoute];
  pos = { lat: -23, lon: -44, accuracy: 10 };
});

afterEach(cleanup);

describe("Início", () => {
  it("mostra o saldo com link para a bolsa e mantém o resumo diário", () => {
    render(view());
    expect(screen.getByRole("link", { name: "Ver bolsa: 27 Bukys" })).toHaveAttribute("href", "/app/bolsa");
    expect(screen.getByText("Treinos hoje 1/2 · Bukys hoje 4/10")).toBeInTheDocument();
    expect(screen.queryByText("+4 hoje")).toBeNull();
  });

  it("encaixa o traçado disponível ao carregar e mantém a câmera enquanto o GPS atualiza o marcador", async () => {
    routes = [];
    const page = render(view());
    await loadMap();
    expect(map.fitBounds).not.toHaveBeenCalled();

    routes = [firstRoute];
    page.rerender(view());
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    const [bounds, options] = map.fitBounds.mock.calls[0] as [LngLatBounds, unknown];
    expect(bounds.toArray()).toEqual([[-43.21, -22.95], [-43.15, -22.9]]);
    expect(options).toEqual({
      padding: { top: 165, bottom: 210, left: 28, right: 28 },
      maxZoom: 16,
      duration: 0,
    });

    pos = { ...pos, lat: -23.1 };
    page.rerender(view());
    expect(map.setLngLat).toHaveBeenLastCalledWith([-44, -23.1]);
    expect(map.easeTo).not.toHaveBeenCalled();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });

  it("encaixa a rota escolhida pelos seus pontos, mesmo com a mesma latitude inicial e quantidade", async () => {
    render(view());
    await loadMap();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Escolher rota: Orla de Niterói" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Escolher rota" })).getByRole("button", { name: /Ingá/ }));

    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    const [bounds] = map.fitBounds.mock.calls[1] as [LngLatBounds];
    expect(bounds.toArray()).toEqual([[-43.15, -22.9], [-43.1, -22.89]]);
    expect(map.easeTo).not.toHaveBeenCalled();
  });

  it("encaixa uma rota de ponto único com o limite de zoom do Início", async () => {
    routes = [{ ...secondRoute, points: secondRoute.points.slice(0, 1) }];
    render(view());
    await loadMap();

    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    const [bounds, options] = map.fitBounds.mock.calls[0] as [LngLatBounds, unknown];
    expect(bounds.toArray()).toEqual([[-43.15, -22.9], [-43.15, -22.9]]);
    expect(options).toMatchObject({ maxZoom: 16 });
  });

  it("centraliza no atleta no modo Livre e reenquadra a rota ao voltar", async () => {
    const page = render(view());
    await loadMap();
    fireEvent.click(screen.getByRole("button", { name: "Livre" }));
    expect(map.easeTo).toHaveBeenLastCalledWith({ center: [-44, -23], duration: 600 });

    pos = { ...pos, lon: -44.1 };
    page.rerender(view());
    expect(map.easeTo).toHaveBeenLastCalledWith({ center: [-44.1, -23], duration: 600 });
    expect(map.fitBounds).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Rota" }));
    expect(map.fitBounds).toHaveBeenCalledTimes(2);
    expect(map.easeTo).toHaveBeenCalledTimes(2);
  });

  it("usa os pontos compactos do mockup", async () => {
    render(view());
    await loadMap();
    expect(layer("points-core")).toMatchObject({
      paint: {
        "circle-radius": ["match", ["get", "state"], "collected", 5, "visited", 10, 6.5],
        "circle-stroke-color": ["match", ["get", "state"], "collected", "#2f6b26", "#050505"],
        "circle-stroke-width": ["match", ["get", "state"], "collected", 1.5, "pending", 1.4, 0],
      },
    });
    expect(layer("points-glow")).toMatchObject({ layout: { visibility: "none" } });
    expect(layer("points-number")).toMatchObject({ layout: { "text-size": 9, "text-offset": [0, -1.6] } });
  });
});

describe("BukyMap sem as opções do Início", () => {
  it("mantém as camadas e o enquadramento padrão, com recentralização explícita", async () => {
    const page = render(<BukyMap center={start} points={firstRoute.points} fitTo={firstRoute.path} />);
    await loadMap();
    expect(map.fitBounds).toHaveBeenCalledWith(expect.anything(), { padding: 48, maxZoom: 17, duration: 0 });
    expect(layer("points-core")).toMatchObject({
      paint: { "circle-radius": ["match", ["get", "state"], "collected", 9, "visited", 10, 9] },
    });
    expect(layer("points-glow")).toMatchObject({ layout: { visibility: "visible" } });
    expect(layer("points-number")).toMatchObject({ layout: { "text-size": 11, "text-offset": [0, -1.4] } });

    page.rerender(<BukyMap center={start} points={firstRoute.points} fitTo={firstRoute.path} recenterKey={1} />);
    expect(map.easeTo).toHaveBeenCalledWith({ center: [start.lon, start.lat], duration: 600 });
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
  });
});
