"use client";

import { useEffect, useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { ProjectPDF } from "./ProjectPDF";

interface DownloadPdfButtonProps {
  project: any;
  teamMembers: any[];
  className?: string;
  variant?: "outline" | "solid";
}

export function DownloadPdfButton({ project, teamMembers, className = "", variant: _variant = "solid" }: DownloadPdfButtonProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Fallback UI pendant le SSR
    return (
      <button disabled className={`opacity-50 cursor-not-allowed ${className}`}>
        Génération PDF...
      </button>
    );
  }

  return (
    <PDFDownloadLink
      document={<ProjectPDF project={project} teamMembers={teamMembers} />}
      fileName={`projet-${project.title.replace(/\s+/g, '-').toLowerCase()}.pdf`}
      className={className}
    >
      {({ loading }) =>
        loading ? (
          <span>Préparation du PDF...</span>
        ) : (
          <span>📄 Exporter en PDF</span>
        )
      }
    </PDFDownloadLink>
  );
}
