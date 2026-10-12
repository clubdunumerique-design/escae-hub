import Link from "next/link";

interface FooterSignatureProps {
  className?: string;
  variant?: "compact" | "full";
}

export function FooterSignature({ className = "", variant = "full" }: FooterSignatureProps) {
  const whatsappUrl =
    "https://wa.me/2290129228536?text=Bonjour%20R%C3%A9potinard%2C%20je%20vous%20contacte%20concernant%20la%20plateforme%20ESCAE%20Innovation%20Hub.";

  if (variant === "compact") {
    return (
      <div
        className={`flex items-center justify-center gap-1.5 text-[10px] text-white/20 transition-opacity hover:text-white/40 ${className}`}
      >
        <span>Dev :</span>
        <span className="text-white/30 font-medium">Répotinard AKOTEGNON</span>
        <span>·</span>
        <Link
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="WhatsApp : +229 01 29 22 85 36"
          className="inline-flex items-center gap-1 text-white/30 transition-colors hover:text-[#05F228]"
        >
          <WhatsAppIcon className="h-2.5 w-2.5" />
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-white/25 sm:justify-between ${className}`}
    >
      <p className="text-white/20">
        ESCAE-BÉNIN Innovation Hub · Tous droits réservés
      </p>
      <div className="flex items-center gap-1.5">
        <span>Développé par</span>
        <span className="text-white/40 font-medium">Répotinard AKOTEGNON</span>
        <span>·</span>
        <Link
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          title="Contact WhatsApp : +229 01 29 22 85 36"
          className="inline-flex items-center gap-1 text-white/30 transition-colors hover:text-[#05F228]"
        >
          <WhatsAppIcon className="h-3 w-3" />
          <span className="text-[10px] underline decoration-white/10 hover:decoration-[#05F228]">WhatsApp</span>
        </Link>
      </div>
    </div>
  );
}

function WhatsAppIcon({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91C2.13 13.66 2.59 15.36 3.45 16.86L2.05 22L7.3 20.62C8.75 21.41 10.38 21.83 12.04 21.83C17.5 21.83 21.95 17.38 21.95 11.92C21.95 9.27 20.92 6.78 19.05 4.91C17.18 3.03 14.69 2 12.04 2M12.05 3.67C14.25 3.67 16.31 4.53 17.87 6.09C19.42 7.65 20.28 9.72 20.28 11.92C20.28 16.46 16.58 20.15 12.04 20.15C10.56 20.15 9.11 19.76 7.85 19L7.55 18.83L4.43 19.65L5.26 16.61L5.06 16.29C4.24 14.99 3.8 13.47 3.8 11.91C3.81 7.37 7.5 3.67 12.05 3.67M9.53 7.34C9.36 7.34 9.09 7.4 8.87 7.65C8.65 7.89 8.02 8.48 8.02 9.7C8.02 10.92 8.91 12.09 9.03 12.26C9.16 12.42 10.74 14.85 13.17 15.9C13.75 16.15 14.2 16.3 14.55 16.41C15.13 16.6 15.67 16.57 16.08 16.51C16.55 16.44 17.51 15.93 17.71 15.36C17.91 14.79 17.91 14.3 17.85 14.2C17.79 14.1 17.63 14.04 17.39 13.92C17.14 13.8 15.93 13.2 15.7 13.12C15.48 13.04 15.31 13 15.15 13.24C14.99 13.48 14.52 14.04 14.37 14.2C14.23 14.37 14.08 14.39 13.84 14.27C13.6 14.15 12.56 13.81 11.34 12.72C10.39 11.87 9.75 10.82 9.63 10.61C9.51 10.4 9.61 10.28 9.74 10.15C9.85 10.04 9.98 9.87 10.1 9.72C10.23 9.58 10.27 9.47 10.35 9.31C10.43 9.15 10.39 9.01 10.33 8.89C10.27 8.77 9.78 7.57 9.58 7.08C9.38 6.61 9.18 6.67 9.03 6.66C8.89 6.66 8.71 6.65 8.54 6.65" />
    </svg>
  );
}
