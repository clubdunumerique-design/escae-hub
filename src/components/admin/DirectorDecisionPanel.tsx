"use client";

import { useState } from "react";
import { submitDirectorDecisionAction } from "@/lib/admin/director-actions";

type Decision = "accepted_for_presentation" | "rejected" | "under_re_examination";

const DECISIONS: {
  value: Decision;
  label: string;
  description: string;
  icon: string;
  colorClass: string;
  activeClass: string;
}[] = [
  {
    value: "accepted_for_presentation",
    label: "Accepter pour présentation",
    description: "Le projet est validé et sera planifié pour une soutenance.",
    icon: "✅",
    colorClass: "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20",
    activeClass: "border-emerald-400 bg-emerald-500/30 ring-2 ring-emerald-500/50",
  },
  {
    value: "under_re_examination",
    label: "Demander un réexamen",
    description: "Le projet nécessite des modifications avant une nouvelle évaluation.",
    icon: "🔄",
    colorClass: "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20",
    activeClass: "border-amber-400 bg-amber-500/30 ring-2 ring-amber-500/50",
  },
  {
    value: "rejected",
    label: "Rejeter définitivement",
    description: "Le projet ne répond pas aux critères requis. Décision irrévocable.",
    icon: "❌",
    colorClass: "border-red-500/40 bg-red-500/10 hover:bg-red-500/20",
    activeClass: "border-red-400 bg-red-500/30 ring-2 ring-red-500/50",
  },
];

interface DirectorDecisionPanelProps {
  projectId: string;
}

export function DirectorDecisionPanel({ projectId }: DirectorDecisionPanelProps) {
  const [selected, setSelected] = useState<Decision | null>(null);
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selected) {
      setError("Veuillez sélectionner une décision.");
      return;
    }
    if (
      selected === "rejected" &&
      !window.confirm(
        "⚠️ Confirmer le rejet définitif de ce projet ? Cette action est irréversible."
      )
    ) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("projectId", projectId);
    formData.set("decision", selected);

    try {
      const result = await submitDirectorDecisionAction(formData);
      if (result.success) {
        setSuccess("Décision enregistrée avec succès.");
      } else {
        setError(result.error ?? "Erreur inconnue.");
      }
    } catch {
      setError("Erreur réseau inattendue.");
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-[#03A61C]/40 bg-[#03A61C]/10 px-6 py-8 text-center">
        <div className="mb-3 text-4xl">✅</div>
        <p className="font-semibold text-[#05F228]">{success}</p>
        <p className="mt-1 text-sm text-white/40">
          Le statut du projet a été mis à jour et l'historique enregistré.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="projectId" value={projectId} />

      {/* Sélection de la décision */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
          Choisir la décision
        </p>
        {DECISIONS.map((d) => (
          <button
            key={d.value}
            type="button"
            id={`decision-${d.value}`}
            onClick={() => setSelected(d.value)}
            className={`w-full rounded-xl border px-5 py-4 text-left transition-all ${
              selected === d.value ? d.activeClass : d.colorClass
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl leading-none">{d.icon}</span>
              <div>
                <p className="font-semibold text-white">{d.label}</p>
                <p className="mt-0.5 text-xs text-white/50">{d.description}</p>
              </div>
              <div className="ml-auto flex-shrink-0 pt-0.5">
                <div
                  className={`h-5 w-5 rounded-full border-2 ${
                    selected === d.value
                      ? "border-white bg-white"
                      : "border-white/30 bg-transparent"
                  } transition-all`}
                />
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Commentaire obligatoire */}
      <div>
        <label
          htmlFor="director-comment"
          className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50"
        >
          Commentaire officiel{" "}
          <span className="text-[#05F228]">*</span>
        </label>
        <textarea
          id="director-comment"
          name="comment"
          required
          rows={5}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Motivez officiellement votre décision. Ce commentaire sera archivé dans l'historique du projet..."
          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#03A61C]/60 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40"
        />
        <p className="mt-1 text-xs text-white/30">{comment.length} / 10 caractères minimum</p>
      </div>

      {/* Feedback */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Bouton de soumission */}
      <button
        type="submit"
        id="submit-director-decision"
        disabled={isLoading || !selected}
        className={`w-full rounded-lg px-6 py-3 font-bold text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
          selected === "rejected"
            ? "bg-red-600 hover:bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
            : selected === "under_re_examination"
            ? "bg-amber-600 hover:bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            : "bg-[#03A61C] hover:bg-[#05F228] shadow-[0_0_20px_rgba(3,166,28,0.35)]"
        }`}
      >
        {isLoading
          ? "Enregistrement..."
          : selected
          ? `Confirmer : ${DECISIONS.find((d) => d.value === selected)?.label}`
          : "Sélectionner une décision"}
      </button>
    </form>
  );
}
