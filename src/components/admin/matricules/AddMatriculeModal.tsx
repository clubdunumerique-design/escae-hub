"use client";

import { useState, useTransition } from "react";
import { createOfficialMatriculeAction } from "@/lib/matricule/matricule-actions";
import { AcademicProgramFields } from "@/components/matricule/AcademicProgramFields";

const ACADEMIC_LEVELS = [
  "Licence 1 (L1)",
  "Licence 2 (L2)",
  "Licence 3 (L3)",
  "Master 1 (M1)",
  "Master 2 (M2)",
  "Doctorat / Recherche",
];

export function AddMatriculeModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const res = await createOfficialMatriculeAction(formData);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        setError(res.error);
      }
    });
  }

  const inputClass =
    "w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/15";
  const labelClass = "mb-1 block text-xs font-semibold text-white/60";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-gradient-to-br from-[#171a17] to-[#101110] p-5 shadow-2xl shadow-black/50 ring-1 ring-white/[0.03] sm:p-6">
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white">Ajouter un matricule officiel</h3>
            <p className="text-xs text-white/40">Certification directe par l&apos;administration</p>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white p-1"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="modal-firstName" className={labelClass}>Prénom</label>
              <input id="modal-firstName" name="firstName" type="text" required placeholder="Prénom" className={inputClass} />
            </div>
            <div>
              <label htmlFor="modal-lastName" className={labelClass}>Nom</label>
              <input id="modal-lastName" name="lastName" type="text" required placeholder="Nom" className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="modal-matricule" className={labelClass}>Matricule officiel</label>
            <input id="modal-matricule" name="matricule" type="text" required pattern="ETU-[0-9]{4}-[0-9]{4}" maxLength={13} title="Format attendu : ETU-AAAA-NNNN (ex. ETU-2026-0024)" placeholder="Ex : ETU-2026-0024" className={`${inputClass} font-mono uppercase`} />
          </div>

          <div>
            <label htmlFor="modal-email" className={labelClass}>Email de l&apos;étudiant</label>
            <input id="modal-email" name="email" type="email" required placeholder="etudiant@escae.bj" className={inputClass} />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <AcademicProgramFields
              idPrefix="modal-program"
              inputClassName={`${inputClass} bg-[#181818]`}
              labelClassName={labelClass}
            />
            <div>
              <label htmlFor="modal-level" className={labelClass}>Niveau</label>
              <select id="modal-level" name="academicLevel" className={`${inputClass} bg-[#181818]`} defaultValue="">
                <option value="" disabled>Sélectionner</option>
                {ACADEMIC_LEVELS.map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/60 hover:bg-white/5"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-[#03A61C] px-5 py-2 text-xs font-bold text-white shadow hover:bg-[#05F228] hover:text-black disabled:opacity-50"
            >
              {isPending ? "Enregistrement…" : "Enregistrer et Certifier"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
