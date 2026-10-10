"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProjectAction } from "@/app/(dashboard)/projects/actions";
import { projectSchema } from "@/lib/validations/project";

export function ProjectForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);
    const formData = new FormData(event.currentTarget);
    const parsed = projectSchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      objectives: formData.get("objectives"),
      problem: formData.get("problem"),
      solution: formData.get("solution"),
      feasibility: formData.get("feasibility"),
      impact: formData.get("impact"),
      budget: formData.get("budget"),
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0].message);
      setIsLoading(false);
      return;
    }
    try {
      const response = await createProjectAction(formData);
      if (response.success) {
        if (response.data) router.push(`/projects/${response.data.id}`);
      } else {
        setError(response.error);
      }
    } catch {
      setError("Une erreur inattendue est survenue.");
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#03A61C]/60 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40";
  const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      <div>
        <label htmlFor="title" className={labelClass}>
          Titre du projet <span className="text-[#05F228]">*</span>
        </label>
        <input
          id="title" name="title" type="text" required
          placeholder="Ex: Système d'irrigation automatisé"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs text-white/30">Entre 5 et 150 caractères.</p>
      </div>
      <div>
        <label htmlFor="description" className={labelClass}>
          Description générale <span className="text-[#05F228]">*</span>
        </label>
        <textarea
          id="description" name="description" required rows={5}
          placeholder="Décrivez brièvement votre projet, le problème qu'il résout..."
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="objectives" className={labelClass}>
          Objectifs spécifiques <span className="text-white/20">(Optionnel)</span>
        </label>
        <textarea
          id="objectives" name="objectives" rows={3}
          placeholder="Liste de vos objectifs..."
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="problem" className={labelClass}>
          Problème à résoudre <span className="text-white/20">(Optionnel)</span>
        </label>
        <textarea
          id="problem" name="problem" rows={4}
          placeholder="Quel est le problème spécifique que votre projet cherche à résoudre ?"
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="solution" className={labelClass}>
          Solution proposée <span className="text-white/20">(Optionnel)</span>
        </label>
        <textarea
          id="solution" name="solution" rows={4}
          placeholder="Décrivez comment votre projet résout le problème identifié."
          className={inputClass}
        />
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <label htmlFor="feasibility" className={labelClass}>
            Faisabilité technique <span className="text-white/20">(Optionnel)</span>
          </label>
          <textarea
            id="feasibility" name="feasibility" rows={3}
            placeholder="Avez-vous les compétences et ressources nécessaires ?"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="impact" className={labelClass}>
            Impact attendu <span className="text-white/20">(Optionnel)</span>
          </label>
          <textarea
            id="impact" name="impact" rows={3}
            placeholder="Impact social, économique, ou environnemental."
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="budget" className={labelClass}>
          Budget estimé (FCFA) <span className="text-white/20">(Optionnel)</span>
        </label>
        <input
          id="budget" name="budget" type="number" min="0" step="1"
          placeholder="Ex: 500000"
          className={inputClass}
        />
      </div>
      <div className="flex justify-end gap-3 border-t border-white/10 pt-6">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isLoading}
          className="rounded-lg border border-white/15 px-5 py-2.5 text-sm font-medium text-white/60 transition-all hover:border-white/30 hover:text-white disabled:opacity-50"
        >
          Annuler
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-[#03A61C] px-5 py-2.5 text-sm font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.3)] transition-all hover:bg-[#05F228] hover:shadow-[0_0_30px_rgba(5,242,40,0.4)] disabled:opacity-60"
        >
          {isLoading ? "Création..." : "Créer le brouillon"}
        </button>
      </div>
    </form>
  );
}
