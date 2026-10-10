import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { userEvent } from "@testing-library/user-event";
import { Button } from "@/components/ui/Button";

describe("Button", () => {
  it("affiche son contenu textuel", () => {
    render(<Button>Soumettre</Button>);
    expect(screen.getByRole("button", { name: "Soumettre" })).toBeInTheDocument();
  });

  it("est désactivé pendant le chargement", () => {
    render(<Button isLoading>Soumettre</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("est désactivé si disabled=true", () => {
    render(<Button disabled>Soumettre</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("appelle onClick si non désactivé", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Cliquer</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("n'appelle pas onClick si isLoading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button isLoading onClick={onClick}>Cliquer</Button>);
    await user.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
