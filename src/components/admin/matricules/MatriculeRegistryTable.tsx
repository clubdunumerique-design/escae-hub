"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { approveMatriculeAction, rejectMatriculeAction, sendMatriculeReminderAction } from "@/lib/matricule/matricule-actions";
import type { StudentMatriculeEntry, MatriculeVerificationStatus } from "@/types";
import { AddMatriculeModal } from "./AddMatriculeModal";

const STATUS_LABELS: Record<MatriculeVerificationStatus, string> = {
  pending: "En attente",
  verified: "Vérifié",
  rejected: "Rejeté",
};

const STATUS_VARIANT: Record<MatriculeVerificationStatus, "default" | "info" | "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning",
  verified: "success",
  rejected: "danger",
};
const OFFICIAL_MATRICULE_PATTERN = /^ETU-\d{4}-\d{4}$/i;

export function MatriculeRegistryTable({
  initialEntries,
}: {
  initialEntries: StudentMatriculeEntry[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState<StudentMatriculeEntry[]>(initialEntries);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionMessage, setActionMessage] = useState<{ success: boolean; text: string } | null>(null);

  // Filtrage local instantané
  const filteredEntries = entries.filter((entry) => {
    const matchesStatus =
      selectedStatus === "all" || entry.verification_status === selectedStatus;
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      entry.matricule.toLowerCase().includes(term) ||
      entry.full_name.toLowerCase().includes(term) ||
      entry.email.toLowerCase().includes(term) ||
      (entry.field_of_study && entry.field_of_study.toLowerCase().includes(term));

    return matchesStatus && matchesSearch;
  });

  function handleApprove(id: string) {
    setActionMessage(null);
    startTransition(async () => {
      const res = await approveMatriculeAction(id);
      if (res.success) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, verification_status: "verified" as MatriculeVerificationStatus } : e
          )
        );
        setActionMessage({ success: true, text: "Matricule validé avec succès." });
        router.refresh();
      } else {
        setActionMessage({ success: false, text: res.error });
      }
    });
  }

  function handleRejectConfirm() {
    if (!rejectingId) return;
    const id = rejectingId;
    const reason = rejectReason;
    setRejectingId(null);
    setRejectReason("");
    setActionMessage(null);

    startTransition(async () => {
      const res = await rejectMatriculeAction(id, reason);
      if (res.success) {
        setEntries((prev) =>
          prev.map((e) =>
            e.id === id
              ? {
                  ...e,
                  verification_status: "rejected" as MatriculeVerificationStatus,
                  rejection_reason: reason,
                }
              : e
          )
        );
        setActionMessage({ success: true, text: "Matricule marqué comme rejeté." });
        router.refresh();
      } else {
        setActionMessage({ success: false, text: res.error });
      }
    });
  }

  function handleReminder(id: string) {
    setActionMessage(null);
    startTransition(async () => {
      const res = await sendMatriculeReminderAction(id);
      setActionMessage({
        success: res.success,
        text: res.success ? "E-mail de correction envoyé." : res.error,
      });
    });
  }

  return (
    <div className="space-y-5">
      {/* ── Barre d'action supérieure ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Recherche */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Rechercher par matricule, nom, email…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition focus:border-sky-500/50"
          />
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        {/* Filtres & Ajout */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1 text-xs">
            {[
              { id: "all", label: "Tous" },
              { id: "pending", label: "En attente" },
              { id: "verified", label: "Vérifiés" },
              { id: "rejected", label: "Rejetés" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${
                  selectedStatus === tab.id
                    ? "bg-[#03A61C] text-white shadow"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-sky-500/20 px-4 py-2.5 text-xs font-semibold text-sky-300 transition hover:bg-sky-500/30 hover:text-white"
          >
            <span>+ Ajouter officiel</span>
          </button>
        </div>
      </div>

      {/* Message d'action */}
      {actionMessage && (
        <div
          className={`rounded-xl px-4 py-2.5 text-xs font-medium ${
            actionMessage.success
              ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* ── Tableau du registre ── */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-white/40 bg-white/2">
                <th className="px-5 py-3.5">Étudiant</th>
                <th className="px-5 py-3.5">Matricule</th>
                <th className="px-5 py-3.5">Filière / Niveau</th>
                <th className="px-5 py-3.5">Date Soumission</th>
                <th className="px-5 py-3.5">Statut</th>
                <th className="px-5 py-3.5">Compte Hub</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredEntries.map((entry) => {
                const formatIsValid = OFFICIAL_MATRICULE_PATTERN.test(entry.matricule.trim());
                return (
                <tr key={entry.id} className={`transition-colors hover:bg-white/[0.045] ${formatIsValid ? "" : "bg-rose-500/[0.035]"}`}>
                  {/* Étudiant */}
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-white">{entry.full_name}</div>
                    <div className="text-xs text-white/40">{entry.email}</div>
                  </td>

                  {/* Matricule */}
                  <td className="px-5 py-3.5">
                    <span className={`inline-block whitespace-nowrap rounded-lg border px-2.5 py-1.5 font-mono text-xs font-bold tracking-wide ${formatIsValid ? "border-[#03A61C]/30 bg-[#03A61C]/15 text-[#05F228]" : "border-rose-400/30 bg-rose-400/10 text-rose-300"}`}>
                      {entry.matricule}
                    </span>
                    {!formatIsValid && (
                      <span className="mt-1.5 flex items-center gap-1.5 text-[10px] font-semibold text-rose-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                        Correction requise · ETU-AAAA-NNNN
                      </span>
                    )}
                  </td>

                  {/* Filière / Niveau */}
                  <td className="px-5 py-3.5 text-xs text-white/70 max-w-[200px]">
                    <div className="truncate font-medium">{entry.field_of_study || "—"}</div>
                    <div className="text-[11px] text-white/40">{entry.academic_level || ""}</div>
                  </td>

                  {/* Date */}
                  <td className="px-5 py-3.5 text-xs text-white/50 whitespace-nowrap">
                    {new Date(entry.submitted_at || entry.created_at).toLocaleDateString("fr-FR")}
                  </td>

                  {/* Statut */}
                  <td className="px-5 py-3.5">
                    <Badge variant={formatIsValid ? STATUS_VARIANT[entry.verification_status] : "danger"}>
                      {formatIsValid ? STATUS_LABELS[entry.verification_status] : "Format invalide"}
                    </Badge>
                    {entry.rejection_reason && (
                      <p className="mt-1 text-[11px] text-red-400 max-w-[160px] truncate" title={entry.rejection_reason}>
                        {entry.rejection_reason}
                      </p>
                    )}
                  </td>

                  {/* Compte Innovation Hub */}
                  <td className="px-5 py-3.5">
                    {entry.claimed_by_user_id ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        Inscrit sur le Hub
                      </span>
                    ) : (
                      <span className="text-xs text-white/30">Non inscrit</span>
                    )}
                  </td>

                  {/* Actions de validation */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {entry.verification_status !== "verified" && formatIsValid && (
                        <button
                          onClick={() => handleApprove(entry.id)}
                          disabled={isPending}
                          className="rounded-lg border border-[#03A61C]/30 bg-[#03A61C]/15 px-3 py-2 text-xs font-semibold text-[#65f274] transition hover:border-[#03A61C]/60 hover:bg-[#03A61C]/30 disabled:opacity-50"
                          title="Valider officiellement ce matricule"
                        >
                          Valider
                        </button>
                      )}

                      {entry.verification_status !== "rejected" && (
                        <button
                          onClick={() => {
                            setRejectingId(entry.id);
                            setRejectReason("");
                          }}
                          disabled={isPending}
                          className="rounded-lg border border-rose-400/25 bg-rose-400/[0.07] px-3 py-2 text-xs font-semibold text-rose-300 transition hover:border-rose-400/50 hover:bg-rose-400/15 disabled:opacity-50"
                          title="Rejeter la demande"
                        >
                          Rejeter
                        </button>
                      )}
                      {!formatIsValid && (
                        <button
                          onClick={() => handleReminder(entry.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-400/[0.08] px-3 py-2 text-xs font-semibold text-amber-200 transition hover:border-amber-400/50 hover:bg-amber-400/15 disabled:opacity-50"
                          title={`Demander la correction du format ETU-AAAA-NNNN à ${entry.email}`}
                        >
                          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 7.5 12 13l9-5.5M5.25 5.25h13.5A2.25 2.25 0 0 1 21 7.5v9a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 16.5v-9a2.25 2.25 0 0 1 2.25-2.25Z" />
                          </svg>
                          Rappel e-mail
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}

              {filteredEntries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-white/40">
                    Aucun matricule trouvé pour cette recherche.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de motif de rejet */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">Motif du rejet</h3>
            <p className="mt-1 text-xs text-white/40">
              Indiquez la raison du rejet (sera notifiée à l&apos;étudiant s&apos;il a un compte).
            </p>

            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex : Matricule introuvable dans la base de scolarité 2025/2026…"
              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white outline-none focus:border-red-500/50 resize-none"
            />

            <div className="mt-4 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRejectingId(null)}
                className="rounded-lg border border-white/10 px-4 py-2 text-xs font-semibold text-white/60 hover:bg-white/5"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleRejectConfirm}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500"
              >
                Confirmer le rejet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'ajout direct */}
      <AddMatriculeModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
