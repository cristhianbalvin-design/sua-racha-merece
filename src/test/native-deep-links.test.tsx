import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const listener = vi.hoisted(() => ({ callback: null as null | ((event: { url: string }) => void) }));
vi.mock("@/lib/platform", () => ({ IS_NATIVE: true }));
vi.mock("@capacitor/app", () => ({ App: { addListener: vi.fn((_name, callback) => {
  listener.callback = callback;
  return Promise.resolve({ remove: vi.fn() });
}) } }));

import { NativeDeepLinks } from "@/features/buky/components/NativeDeepLinks";

function CurrentPath() {
  const location = useLocation();
  return <span data-testid="path">{location.pathname}</span>;
}

afterEach(cleanup);

describe("appUrlOpen", () => {
  it("navega só para URLs internas de /app", async () => {
    render(<MemoryRouter initialEntries={["/app"]}><NativeDeepLinks /><CurrentPath /></MemoryRouter>);
    await waitFor(() => expect(listener.callback).toBeTypeOf("function"));
    listener.callback!({ url: "https://example.com/app/fotos" });
    listener.callback!({ url: "tresbuk://other/fotos" });
    expect(screen.getByTestId("path")).toHaveTextContent("/app");
    listener.callback!({ url: "tresbuk://app/fotos" });
    await waitFor(() => expect(screen.getByTestId("path")).toHaveTextContent("/app/fotos"));
  });
});
