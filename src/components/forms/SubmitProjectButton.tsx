"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitProjectAction } from "@/app/(dashboard)/projects/actions";

export function SubmitProjectButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await submitProjectAction(projectId);
      setFailed(!result.success);
      setMessage(result.success ? "Projet soumis avec succès." : result.error ?? "La soumission a échoué.");
      if (result.success) router.refresh();
    } catch {
      setFailed(true);
      setMessage("Une erreur inattendue est survenue. Vérifiez le statut du projet avant de réessayer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" onClick={submit} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-50 sm:text-sm">
        {busy ? "Soumission…" : "Soumettre définitivement"}
      </button>
      {message && <p role={failed ? "alert" : "status"} className={`max-w-xs text-right text-xs ${failed ? "text-red-300" : "text-emerald-300"}`}>{message}</p>}
    </div>
  );
}
