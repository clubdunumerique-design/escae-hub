"use client";

import { useState, useTransition } from "react";
import { createAssistedStudentAccountAction } from "@/lib/admin/student-actions";
import type { UniversityOption } from "@/types";

export function CreateStudentAccountForm({ universities }: { universities: UniversityOption[] }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await createAssistedStudentAccountAction(data);
      if (result.success) {
        form.reset();
        setMessage({ ok: true, text: "Compte créé. Un e-mail avec un lien sécurisé a été envoyé à l’étudiant pour confirmer son adresse et choisir son mot de passe." });
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  const field = "w-full rounded-lg border border-white/10 bg-[#171717] px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#03A61C]/60";
  const label = "mb-1 block text-xs font-medium text-white/60";

  return (
    <section className="mb-8 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-5">
      <h2 className="text-lg font-semibold text-white">Créer un compte pour un étudiant</h2>
      <p className="mt-1 max-w-3xl text-sm text-white/50">
        Pour une personne qui n’arrive pas à s’inscrire. Elle recevra un e-mail de confirmation avec un lien pour choisir son propre mot de passe. Le matricule restera non vérifié jusqu’à sa validation.
      </p>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={label}>Prénom
          <input className={field} name="firstName" required minLength={2} maxLength={60} autoComplete="given-name" placeholder="Prénom" />
        </label>
        <label className={label}>Nom
          <input className={field} name="lastName" required minLength={2} maxLength={60} autoComplete="family-name" placeholder="Nom" />
        </label>
        <label className={label}>Adresse e-mail personnelle
          <input className={field} name="email" type="email" required autoComplete="email" placeholder="etudiant@exemple.com" />
        </label>
        <label className={label}>Université
          <select className={field} name="universityId" required defaultValue="">
            <option value="" disabled>Choisir une université</option>
            {universities.map((university) => <option key={university.id} value={university.id}>{university.name}</option>)}
          </select>
        </label>
        <label className={label}>Matricule
          <input className={field} name="studentId" required pattern="ETU-[0-9]{4}-[0-9]{4}" maxLength={13} placeholder="ETU-2026-0024" />
        </label>
        <label className={label}>Département / filière
          <input className={field} name="department" required minLength={2} maxLength={120} placeholder="Ex. Informatique de gestion" />
        </label>
        <div className="flex flex-col justify-end gap-2">
          <button disabled={pending} className="rounded-lg bg-[#03A61C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#05F228] hover:text-black disabled:opacity-50">
            {pending ? "Création et envoi…" : "Créer et envoyer le lien"}
          </button>
        </div>
      </form>
      {message && <p role="status" className={`mt-4 rounded-lg px-4 py-3 text-sm ${message.ok ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border border-red-500/30 bg-red-500/10 text-red-300"}`}>{message.text}</p>}
    </section>
  );
}
