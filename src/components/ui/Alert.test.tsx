import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { screen } from "@testing-library/dom";
import { Alert } from "@/components/ui/Alert";

describe("Alert", () => {
  it("a le rôle alert pour l'accessibilité", () => {
    render(<Alert>Message</Alert>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("affiche le titre si fourni", () => {
    render(<Alert title="Erreur critique">Détail de l&apos;erreur</Alert>);
    expect(screen.getByText("Erreur critique")).toBeInTheDocument();
  });

  it("affiche le contenu enfant", () => {
    render(<Alert>Votre projet a été soumis.</Alert>);
    expect(screen.getByText("Votre projet a été soumis.")).toBeInTheDocument();
  });
});
