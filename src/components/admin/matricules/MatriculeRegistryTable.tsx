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
          <table className="w-full text-left text-sm">
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
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="transition-colors hover:bg-white/4">
                  {/* Étudiant */}
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-white">{entry.full_name}</div>
                    <div className="text-xs text-white/40">{entry.email}</div>
                  </td>

                  {/* Matricule */}
                  <td className="px-5 py-3.5">
                    <span className="font-mono text-xs font-bold text-[#05F228] bg-[#03A61C]/15 border border-[#03A61C]/30 rounded-md px-2 py-1">
                      {entry.matricule}
                    </span>
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
                    <Badge variant={STATUS_VARIANT[entry.verification_status]}>
                      {STATUS_LABELS[entry.verification_status]}
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
                    <div className="flex items-center justify-end gap-1.5">
                      {entry.verification_status !== "verified" && (
                        <button
                          onClick={() => handleApprove(entry.id)}
                          disabled={isPending}
                          className="rounded-lg bg-[#03A61C]/20 border border-[#03A61C]/30 px-2.5 py-1.5 text-xs font-semibold text-[#05F228] transition hover:bg-[#03A61C] hover:text-white disabled:opacity-50"
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
                          className="rounded-lg bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                          title="Rejeter la demande"
                        >
                          Rejeter
                        </button>
                      )}
                      {!OFFICIAL_MATRICULE_PATTERN.test(entry.matricule.trim()) && (
                        <button
                          onClick={() => handleReminder(entry.id)}
                          disabled={isPending}
                          className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-400/20 disabled:opacity-50"
                          title={`Demander la correction du format ETU-AAAA-NNNN à ${entry.email}`}
                        >
                          Relancer par e-mail
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

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
