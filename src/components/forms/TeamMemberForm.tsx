"use client";

import { useState } from "react";
import { addTeamMemberAction } from "@/app/(dashboard)/projects/actions";
import { Button } from "@/components/ui/Button";

interface TeamMemberFormProps {
  projectId: string;
}

export function TeamMemberForm({ projectId }: TeamMemberFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    formData.append("projectId", projectId);

    try {
      const response = await addTeamMemberAction(formData);
      if (response.success) {
        setSuccess("Membre ajouté avec succès.");
        (event.target as HTMLFormElement).reset();
      } else {
        setError(response.error);
      }
    } catch {
      setError("Erreur inattendue.");
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 backdrop-blur-sm transition-all focus:border-[#03A61C]/60 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40";
  const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-wider text-white/50";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-white/10 bg-white/5 p-6">
      <h3 className="mb-4 text-lg font-bold text-white">Ajouter un membre</h3>
      
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-[#03A61C]/30 bg-[#03A61C]/10 px-4 py-3 text-sm text-[#05F228]">
          {success}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="name" className={labelClass}>
            Nom complet <span className="text-[#05F228]">*</span>
          </label>
          <input
            id="name" name="name" type="text" required
            placeholder="Ex: Jean Dupont"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="role_in_project" className={labelClass}>
            Rôle dans le projet <span className="text-[#05F228]">*</span>
          </label>
          <input
            id="role_in_project" name="role_in_project" type="text" required
            placeholder="Ex: Développeur, Designer..."
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="user_id" className={labelClass}>
          ID Utilisateur (Optionnel - pour lier un compte existant)
        </label>
        <input
          id="user_id" name="user_id" type="text"
          placeholder="Ex: 550e8400-e29b-41d4-a716-446655440000"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-white/30">Laissez vide si le membre n'a pas encore de compte ESCAE-BÉNIN Hub.</p>
      </div>

      <div className="pt-2">
        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Ajout..." : "Ajouter le membre"}
        </Button>
      </div>
    </form>
  );
}
