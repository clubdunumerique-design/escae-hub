"use client";

import { useState } from "react";
import { schedulePresentationAction } from "@/lib/admin/schedule-actions";

interface SchedulePresentationFormProps {
  projectId: string;
  existingSchedule?: {
    scheduled_date: string;
    scheduled_time: string;
    room: string;
    notes: string | null;
  } | null;
}

export function SchedulePresentationForm({
  projectId,
  existingSchedule,
}: SchedulePresentationFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.set("projectId", projectId);

    try {
      const result = await schedulePresentationAction(formData);
      if (result.success) {
        setSuccess(
          existingSchedule
            ? "Planification modifiée avec succès."
            : "Planification enregistrée avec succès."
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
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Date et Heure */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="scheduled_date" className="mb-1 block text-xs font-semibold uppercase text-white/50">
            Date de soutenance <span className="text-[#05F228]">*</span>
          </label>
          <input
            type="date"
            id="scheduled_date"
            name="scheduled_date"
            required
            defaultValue={existingSchedule?.scheduled_date ?? ""}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-[#03A61C]/60 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40"
          />
        </div>
        <div>
          <label htmlFor="scheduled_time" className="mb-1 block text-xs font-semibold uppercase text-white/50">
            Heure <span className="text-[#05F228]">*</span>
          </label>
          <input
            type="time"
            id="scheduled_time"
            name="scheduled_time"
            required
            defaultValue={existingSchedule?.scheduled_time ?? ""}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white focus:border-[#03A61C]/60 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40"
          />
        </div>
      </div>

      {/* Salle */}
      <div>
        <label htmlFor="room" className="mb-1 block text-xs font-semibold uppercase text-white/50">
          Salle <span className="text-[#05F228]">*</span>
        </label>
        <input
          type="text"
          id="room"
          name="room"
          required
          placeholder="Ex: Salle A1, Amphi B..."
          defaultValue={existingSchedule?.room ?? ""}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/20 focus:border-[#03A61C]/60 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="mb-1 block text-xs font-semibold uppercase text-white/50">
          Notes / Instructions (Optionnel)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={existingSchedule?.notes ?? ""}
          placeholder="Instructions spécifiques pour les étudiants ou le jury..."
          className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/20 focus:border-[#03A61C]/60 focus:outline-none focus:ring-1 focus:ring-[#03A61C]/40"
        />
      </div>

      {/* Feedbacks */}
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

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-lg bg-[#03A61C] px-6 py-3 font-bold text-white shadow-[0_0_20px_rgba(3,166,28,0.35)] transition-all hover:bg-[#05F228] disabled:opacity-60"
      >
        {isLoading
          ? "Enregistrement..."
          : existingSchedule
          ? "Modifier la planification"
          : "Planifier la présentation"}
      </button>
    </form>
  );
}
