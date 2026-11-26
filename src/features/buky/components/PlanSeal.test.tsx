import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import PlanSeal from "./PlanSeal";

afterEach(cleanup);

describe("PlanSeal", () => {
  it.each([
    [true, "PREMIUM", "3buk Premium · ver plano"],
    [false, "FREEMIUM", "3buk Freemium · seja Premium"],
  ])("mostra o plano e direciona ao saldo", (premium, label, accessibleName) => {
    render(<MemoryRouter><PlanSeal premium={premium} /></MemoryRouter>);
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: accessibleName })).toHaveAttribute("href", "/app/perfil/saldo");
  });
});
