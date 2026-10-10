"use client";

import { useState } from "react";
import { removeTeamMemberAction } from "@/app/(dashboard)/projects/actions";

interface RemoveTeamMemberButtonProps {
  memberId: string;
  projectId: string;
}

export function RemoveTeamMemberButton({ memberId, projectId }: RemoveTeamMemberButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleRemove() {
    if (!window.confirm("Voulez-vous vraiment retirer ce membre de l'équipe ?")) return;
    
    setIsLoading(true);
    try {
      await removeTeamMemberAction(memberId, projectId);
    } catch {
      alert("Erreur lors de la suppression.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={isLoading}
      className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
    >
      {isLoading ? "Suppression..." : "Retirer"}
    </button>
  );
}
