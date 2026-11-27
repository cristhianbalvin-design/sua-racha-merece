import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import Perfil from "./Perfil";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), logout: vi.fn(), navigate: vi.fn(), auth: { user: { id: "u1" }, logout: null as unknown, }, empty: {}, sessions: { data: [] as unknown[] } }));
mocks.auth.logout = mocks.logout;
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("@/lib/supabase", () => ({ supabase: { functions: { invoke: mocks.invoke }, from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { email_notifications: true } }) }) }) }), rpc: async () => ({ data: { sorteios: 0 } }) } }));
vi.mock("react-router-dom", async (original) => ({ ...await original<typeof import("react-router-dom")>(), useNavigate: () => mocks.navigate }));
vi.mock("../lib/hooks", () => ({ useBukyProfile: () => mocks.empty, useCity: () => mocks.empty, useSummary: () => mocks.empty, useMySessions: () => mocks.sessions }));
vi.mock("@/lib/sponsorApi", () => ({ useSponsors: () => mocks.empty }));
vi.mock("../components/loja/shared", () => ({ useShopEnabled: () => mocks.empty }));
vi.mock("@/lib/walletApi", () => ({ apiGetMyWallet: async () => ({}), brl: () => "R$ 0" }));
vi.mock("@/components/PlanBadge", () => ({ MyPlanBadge: () => null }));
vi.mock("../components/ui", async (original) => ({ ...await original<typeof import("../components/ui")>(), ProfileAvatar: () => null }));

describe("exclusão de conta", () => {
  it("exige confirmação e limpa a sessão após sucesso", async () => {
    mocks.invoke.mockResolvedValue({ error: null }); mocks.logout.mockResolvedValue(undefined);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><Perfil /></MemoryRouter></QueryClientProvider>);
    fireEvent.click(screen.getByRole("button", { name: "Excluir minha conta" }));
    const buttons = screen.getAllByRole("button", { name: "Excluir minha conta" });
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Digite EXCLUIR/), { target: { value: "EXCLUIR" } });
    fireEvent.click(buttons[1]);
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("delete-account", { body: { confirm: "EXCLUIR" } }));
    await waitFor(() => expect(mocks.logout).toHaveBeenCalled());
    expect(mocks.navigate).toHaveBeenCalledWith("/", { replace: true });
  });
});
