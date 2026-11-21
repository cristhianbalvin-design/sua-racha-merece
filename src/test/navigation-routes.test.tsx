import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { legacyRedirects } from "@/lib/legacyRedirects";
import { NativeOnly } from "@/features/buky/components/NativeOnly";

afterEach(cleanup);

function Location() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

describe("redirecionamentos antigos", () => {
  it.each(legacyRedirects)("%s leva a %s", (from, to) => {
    const initial = from.replace(":id", "123");
    render(<MemoryRouter initialEntries={[initial]}><Routes>
      {legacyRedirects.map(([oldPath, destination]) => <Route key={oldPath} path={oldPath} element={<Navigate to={destination} replace />} />)}
      <Route path="/app/*" element={<Location />} />
    </Routes></MemoryRouter>);
    expect(screen.getByTestId("location")).toHaveTextContent(to);
  });
});

describe("telas exclusivas do aplicativo", () => {
  it("mostra OpenInApp na web", () => {
    render(<NativeOnly path="/app/treino" native={false}><p>Treino nativo</p></NativeOnly>);
    expect(screen.getByRole("button", { name: "Abrir no app" })).toBeInTheDocument();
    expect(screen.queryByText("Treino nativo")).not.toBeInTheDocument();
  });
  it("mostra o treino no nativo", () => {
    render(<NativeOnly path="/app/treino" native><p>Treino nativo</p></NativeOnly>);
    expect(screen.getByText("Treino nativo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abrir no app" })).not.toBeInTheDocument();
  });
});
