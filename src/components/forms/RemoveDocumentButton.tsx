"use client";

import { useState } from "react";
import { deleteDocumentAction } from "@/app/(dashboard)/projects/actions";

interface RemoveDocumentButtonProps {
  documentId: string;
  projectId: string;
}

export function RemoveDocumentButton({ documentId, projectId }: RemoveDocumentButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  async function handleRemove() {
    if (!window.confirm("Voulez-vous vraiment supprimer ce document ?")) return;
    
    setIsLoading(true);
    try {
      const res = await deleteDocumentAction(documentId, projectId);
      if (!res.success) {
        alert(res.error || "Erreur lors de la suppression.");
      }
    } catch {
      alert("Erreur réseau.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <button
      onClick={handleRemove}
      disabled={isLoading}
      className="ml-4 rounded-lg bg-red-500/10 px-2 py-1 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50"
    >
      {isLoading ? "..." : "Supprimer"}
    </button>
  );
}
