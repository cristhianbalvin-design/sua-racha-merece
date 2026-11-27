import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase", () => ({ supabase: {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LocationDisclosure from "./LocationDisclosure";
import { LOCATION_DISCLOSURE_KEY, requestLocationDisclosure } from "../training/locationDisclosure";

afterEach(() => { cleanup(); localStorage.clear(); });
describe("divulgação de localização", () => {
  it("pede aceite antes de prosseguir e o memoriza", async () => {
    render(<MemoryRouter><LocationDisclosure /></MemoryRouter>);
    let result!: Promise<boolean>;
    act(() => { result = requestLocationDisclosure(); });
    expect(screen.getByText("Aceitar e continuar")).toBeTruthy();
    expect(screen.getByText(/segundo plano ou a tela apagada/)).toBeTruthy();
    fireEvent.click(screen.getByText("Aceitar e continuar"));
    expect(await result).toBe(true);
    expect(localStorage.getItem(LOCATION_DISCLOSURE_KEY)).toBe("accepted");
    expect(await requestLocationDisclosure()).toBe(true);
  });
  it("recusa sem persistir aceite", async () => {
    render(<MemoryRouter><LocationDisclosure /></MemoryRouter>);
    let result!: Promise<boolean>;
    act(() => { result = requestLocationDisclosure(); });
    expect(screen.getByText("Agora não")).toBeTruthy();
    fireEvent.click(screen.getByText("Agora não"));
    expect(await result).toBe(false);
    expect(localStorage.getItem(LOCATION_DISCLOSURE_KEY)).toBeNull();
  });
  it("trata armazenamento indisponível", async () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("denied"); });
    const { hasLocationConsent } = await import("../training/locationDisclosure");
    expect(hasLocationConsent()).toBe(false);
    spy.mockRestore();
  });
});
