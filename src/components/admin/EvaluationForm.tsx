"use client";

import { useState } from "react";
import { submitEvaluationAction } from "@/lib/admin/evaluation-actions";

// ── Critères d'évaluation ─────────────────────────────────────────────────────
const CRITERIA = [
  {
    key: "innovation_score",
    label: "Innovation",
    description: "Originalité de l'idée, apport de nouveauté dans son domaine.",
    icon: "💡",
  },
  {
    key: "feasibility_score",
    label: "Faisabilité",
    description: "Réalisabilité technique, disponibilité des ressources et compétences.",
    icon: "⚙️",
  },
  {
    key: "impact_score",
    label: "Impact",
    description: "Potentiel d'impact social, économique ou environnemental au Bénin.",
    icon: "🌍",
  },
] as const;

type ScoreKey = "innovation_score" | "feasibility_score" | "impact_score";

interface ScoreInputProps {
  criteriaKey: ScoreKey;
  label: string;
  description: string;
  icon: string;
  value: number;
  onChange: (key: ScoreKey, value: number) => void;
}

function ScoreInput({ criteriaKey, label, description, icon, value, onChange }: ScoreInputProps) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <h4 className="font-semibold text-white">{label}</h4>
          <p className="text-xs text-white/40">{description}</p>
        </div>
        <div className="ml-auto text-right">
          <span className="text-3xl font-extrabold text-[#05F228]">{value}</span>
          <span className="text-white/40">/10</span>
        </div>
      </div>
      {/* Slider */}
      <input
        type="range"
        name={criteriaKey}
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(criteriaKey, Number(e.target.value))}
        className="w-full accent-[#03A61C] cursor-pointer"
      />
      {/* Graduations visuelles */}
      <div className="mt-1 flex justify-between text-[10px] text-white/20">
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i}>{i}</span>
        ))}
      </div>
    </div>
  );
}

interface EvaluationFormProps {
  projectId: string;
  existingEvaluation?: {
    innovation_score: number;
    feasibility_score: number;
    impact_score: number;
    comments: string;
  } | null;
}

export function EvaluationForm({ projectId, existingEvaluation }: EvaluationFormProps) {
  const [scores, setScores] = useState<Record<ScoreKey, number>>({
    innovation_score: existingEvaluation?.innovation_score ?? 5,
    feasibility_score: existingEvaluation?.feasibility_score ?? 5,
    impact_score: existingEvaluation?.impact_score ?? 5,
  });
  const [comments, setComments] = useState(existingEvaluation?.comments ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const totalScore =
    scores.innovation_score + scores.feasibility_score + scores.impact_score;
  const average = (totalScore / 3).toFixed(1);

  function handleScoreChange(key: ScoreKey, value: number) {
    setScores((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("projectId", projectId);

    try {
      const result = await submitEvaluationAction(formData);
      if (result.success) {
        setSuccess(
          existingEvaluation
            ? "Évaluation mise à jour avec succès."
            : "Évaluation soumise avec succès."
        );
      } else {
        setError(result.error ?? "Erreur inconnue.");
      }
    } catch {
      setError("Erreur réseau inattendue.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <input type="hidden" name="projectId" value={projectId} />

      {/* Score global */}
      <div className="flex items-center justify-between rounded-xl border border-[#03A61C]/30 bg-[#03A61C]/10 px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-[#79F281]">
            Score global (moyenne)
          </p>
          <p className="mt-1 text-xs text-white/40">
            Somme des 3 critères divisée par 3
          </p>
        </div>
        <div className="text-right">
          <span className="text-5xl font-extrabold text-[#05F228]">{average}</span>
          <span className="text-lg text-white/40">/10</span>
        </div>
      </div>

      {/* Sliders de notation */}
      {CRITERIA.map((c) => (
        <ScoreInput
          key={c.key}
          criteriaKey={c.key}
          label={c.label}
          description={c.description}
          icon={c.icon}
          value={scores[c.key]}
          onChange={handleScoreChange}
        />
      ))}

      {/* Commentaires */}
      <div>
        <label
          htmlFor="eval-comments"
          className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50"
        >
          Commentaires détaillés{" "}
          <span className="text-[#05F228]">*</span>
        </label>
        <textarea
          id="eval-comments"
          name="comments"
          required
          rows={6}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Justifiez votre notation. Mentionnez les points forts, les faiblesses et vos recommandations pour le projet..."
          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#03A61C]/60 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40"
        />
        <p className="mt-1 text-xs text-white/30">
          {comments.length} / 20 caractères minimum
        </p>
      </div>

      {/* Feedback */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-[#03A61C]/30 bg-[#03A61C]/10 px-4 py-3 text-sm text-[#05F228]">
          ✓ {success}
        </div>
      )}

      {/* Bouton */}
      <button
        type="submit"
        id="submit-evaluation"
        disabled={isLoading}
        className="w-full rounded-lg bg-[#03A61C] px-6 py-3 font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.35)] transition-all hover:bg-[#05F228] hover:shadow-[0_0_30px_rgba(5,242,40,0.45)] disabled:opacity-60"
      >
        {isLoading
          ? "Envoi en cours..."
          : existingEvaluation
          ? "Mettre à jour l'évaluation"
          : "Soumettre l'évaluation"}
      </button>
    </form>
  );
}
