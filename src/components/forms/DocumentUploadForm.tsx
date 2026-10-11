"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { saveDocumentMetadataAction } from "@/app/(dashboard)/projects/actions";
import { STORAGE_CONFIG } from "@/config/app.config";

interface DocumentUploadFormProps {
  projectId: string;
  isDraft: boolean;
}

export function DocumentUploadForm({ projectId, isDraft }: DocumentUploadFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createSupabaseBrowserClient();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validation (max 10MB)
    if (file.size > STORAGE_CONFIG.maxFileSizeBytes) {
      setError("Le fichier ne doit pas dépasser 10 Mo.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // 1. Upload vers Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
      const storagePath = `${projectId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_CONFIG.projectDocumentsBucket)
        .upload(storagePath, file);

      if (uploadError) {
        throw new Error("Erreur lors de l'envoi du fichier vers le stockage.");
      }

      // 2. Sauvegarder les métadonnées en base via Server Action
      const response = await saveDocumentMetadataAction({
        projectId,
        name: file.name,
        storagePath,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
      });

      if (!response.success) {
        // Rollback: on tente de supprimer le fichier du storage si la BDD a échoué
        await supabase.storage.from(STORAGE_CONFIG.projectDocumentsBucket).remove([storagePath]);
        throw new Error(response.error ?? "Erreur lors de l'enregistrement.");
      }

      // Succès
      if (e.target) {
        e.target.value = ""; // Reset input
      }
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue.");
    } finally {
      setIsUploading(false);
    }
  };

  if (!isDraft) {
    return null; // On ne peut pas uploader si ce n'est pas un brouillon
  }

  return (
    <div className="mt-4 border-t border-white/10 pt-4">
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}
      
      <div className="flex items-center gap-4">
        <label
          htmlFor="file-upload"
          className={`cursor-pointer rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/10 ${
            isUploading ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {isUploading ? "Envoi en cours..." : "Ajouter un fichier"}
        </label>
        <input
          id="file-upload"
          type="file"
          className="hidden"
          onChange={handleFileChange}
          disabled={isUploading}
        />
        <span className="text-xs text-white/30">Max 10 Mo (PDF, DOCX, ZIP...)</span>
      </div>
    </div>
  );
}
