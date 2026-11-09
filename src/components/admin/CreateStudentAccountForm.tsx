"use client";

import { useState, useTransition } from "react";
import { AcademicProgramFields } from "@/components/matricule/AcademicProgramFields";
import { ESCAE_ACADEMIC_LEVELS } from "@/config/academic-programs";
import { createAssistedStudentAccountAction, searchStudentMatriculeForAssistedAccountAction } from "@/lib/admin/student-actions";
import type { UniversityOption } from "@/types";

type RegistrySuggestion = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  matricule: string;
  field_of_study: string | null;
  academic_level: string | null;
  verification_status: string;
};

export function CreateStudentAccountForm({ universities }: { universities: UniversityOption[] }) {
  const [pending, startTransition] = useTransition();
  const [searchPending, startSearchTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [universityId, setUniversityId] = useState("");
  const [registrySearch, setRegistrySearch] = useState("");
  const [suggestions, setSuggestions] = useState<RegistrySuggestion[]>([]);
  const [selectedRegistry, setSelectedRegistry] = useState<RegistrySuggestion | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [matricule, setMatricule] = useState("");
  const [program, setProgram] = useState("");
  const [academicLevel, setAcademicLevel] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    const form = event.currentTarget;
    const data = new FormData(form);
    startTransition(async () => {
      const result = await createAssistedStudentAccountAction(data);
      if (result.success) {
        form.reset();
        setFirstName("");
        setLastName("");
        setEmail("");
        setMatricule("");
        setProgram("");
        setAcademicLevel("");
        setSelectedRegistry(null);
        setSuggestions([]);
        setMessage({ ok: true, text: "Compte créé. Un e-mail avec un lien sécurisé a été envoyé à l’étudiant pour confirmer son adresse et choisir son mot de passe." });
      } else {
        setMessage({ ok: false, text: result.error });
      }
    });
  }

  function searchRegistry() {
    setMessage(null);
    setSuggestions([]);
    setSelectedRegistry(null);
    startSearchTransition(async () => {
      const result = await searchStudentMatriculeForAssistedAccountAction(universityId, registrySearch);
      if (!result.success) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setSuggestions(result.data);
      if (result.data.length === 0) {
        setMessage({ ok: true, text: "Aucune fiche trouvée. Vous pouvez continuer en saisissant les informations ci-dessous." });
      }
    });
  }

  function selectRegistry(entry: RegistrySuggestion) {
    setSelectedRegistry(entry);
    setFirstName(entry.first_name);
    setLastName(entry.last_name);
    setEmail(entry.email);
    setMatricule(entry.matricule);
    setProgram(entry.field_of_study ?? "");
    setAcademicLevel(ESCAE_ACADEMIC_LEVELS.find((level) => level === entry.academic_level) ?? "");
    setSuggestions([]);
    setMessage({
      ok: true,
      text: entry.verification_status === "verified"
        ? "Fiche déjà vérifiée : ses informations sont préremplies. Le compte sera rapproché après confirmation du lien e-mail."
        : `Fiche ${entry.verification_status === "rejected" ? "rejetée" : "en attente"} : les informations sont préremplies, mais le compte ne sera pas marqué vérifié.`,
    });
  }

  const field = "w-full rounded-lg border border-white/10 bg-[#171717] px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#03A61C]/60";
  const label = "mb-1 block text-xs font-medium text-white/60";

  return (
    <section className="mb-8 rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-5">
      <h2 className="text-lg font-semibold text-white">Créer un compte pour un étudiant</h2>
      <p className="mt-1 max-w-3xl text-sm text-white/50">
        Recherchez d’abord une fiche déjà soumise avec son e-mail ou son matricule. Si elle existe, choisissez-la pour préremplir le formulaire; sinon, saisissez les informations et sélectionnez la filière et le niveau.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <label className={label}>Université à rechercher
          <select className={field} value={universityId} onChange={(event) => { setUniversityId(event.target.value); setSuggestions([]); setSelectedRegistry(null); }} required>
            <option value="" disabled>Choisir une université</option>
            {universities.map((university) => <option key={university.id} value={university.id}>{university.name}</option>)}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <label className={`${label} flex-1`}>E-mail ou matricule déjà soumis
            <input className={field} value={registrySearch} onChange={(event) => setRegistrySearch(event.target.value)} placeholder="ETU-2026-0024 ou nom@mail.com" />
          </label>
          <button type="button" onClick={searchRegistry} disabled={!universityId || registrySearch.trim().length < 3 || searchPending} className="mb-0.5 h-[42px] shrink-0 rounded-lg border border-sky-400/30 bg-sky-400/10 px-4 text-sm font-semibold text-sky-200 disabled:opacity-40">
            {searchPending ? "Recherche…" : "Rechercher"}
          </button>
        </div>
      </div>
      {suggestions.length > 0 && (
        <div className="mt-3 space-y-2" aria-label="Fiches de matricule trouvées">
          {suggestions.map((entry) => (
            <button key={entry.id} type="button" onClick={() => selectRegistry(entry)} className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-left hover:border-sky-400/40 hover:bg-white/5">
              <span><strong className="text-white">{entry.full_name}</strong><span className="ml-2 font-mono text-xs text-sky-200">{entry.matricule}</span><span className="block text-xs text-white/45">{entry.email}{entry.field_of_study ? ` · ${entry.field_of_study}` : ""}</span></span>
              <span className={`rounded-full px-2.5 py-1 text-xs ${entry.verification_status === "verified" ? "bg-emerald-500/10 text-emerald-300" : entry.verification_status === "rejected" ? "bg-red-500/10 text-red-300" : "bg-amber-500/10 text-amber-300"}`}>
                {entry.verification_status === "verified" ? "Vérifiée" : entry.verification_status === "rejected" ? "Rejetée" : "En attente"} · choisir
              </span>
            </button>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className={label}>Prénom
          <input className={field} name="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} required minLength={2} maxLength={60} autoComplete="given-name" placeholder="Prénom" />
        </label>
        <label className={label}>Nom
          <input className={field} name="lastName" value={lastName} onChange={(event) => setLastName(event.target.value)} required minLength={2} maxLength={60} autoComplete="family-name" placeholder="Nom" />
        </label>
        <label className={label}>Adresse e-mail personnelle
          <input className={field} name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="etudiant@exemple.com" />
        </label>
        <label className={label}>Université
          <select className={field} name="universityId" required value={universityId} onChange={(event) => { setUniversityId(event.target.value); setSuggestions([]); setSelectedRegistry(null); }}>
            <option value="" disabled>Choisir une université</option>
            {universities.map((university) => <option key={university.id} value={university.id}>{university.name}</option>)}
          </select>
        </label>
        <label className={label}>Matricule
          <input className={field} name="studentId" value={matricule} onChange={(event) => setMatricule(event.target.value)} required pattern="ETU-[0-9]{4}-[0-9]{4}" maxLength={13} placeholder="ETU-2026-0024" />
        </label>
        <div className="sm:col-span-2 lg:col-span-3">
          <AcademicProgramFields idPrefix="assisted-student" programFieldName="department" initialProgram={program} onProgramChange={setProgram} inputClassName={field} labelClassName={label} />
        </div>
        <label className={label}>Niveau d&apos;études
          <select className={field} name="academicLevel" value={academicLevel} onChange={(event) => setAcademicLevel(event.target.value)} required>
            <option value="" disabled>Choisir le niveau</option>
            {ESCAE_ACADEMIC_LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
          </select>
        </label>
        <div className="flex flex-col justify-end gap-2">
          <button disabled={pending} className="rounded-lg bg-[#03A61C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#05F228] hover:text-black disabled:opacity-50">
            {pending ? "Création et envoi…" : "Créer et envoyer le lien"}
          </button>
        </div>
      </form>
      {selectedRegistry && <p className="mt-3 text-xs text-white/40">Fiche sélectionnée : {selectedRegistry.full_name} — {selectedRegistry.matricule}</p>}
      {message && <p role="status" className={`mt-4 rounded-lg px-4 py-3 text-sm ${message.ok ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border border-red-500/30 bg-red-500/10 text-red-300"}`}>{message.text}</p>}
    </section>
  );
}
