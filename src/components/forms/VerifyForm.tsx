"use client";

import { useState, useRef, useEffect } from "react";
import { verifyOtpAction, resendOtpAction } from "@/app/(auth)/actions";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const OTP_LENGTH = 8;

export function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer pour le renvoi du code
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // Focus sur la première case au chargement
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  const handleChange = (index: number, value: string) => {
    // Nettoyer les caractères non numériques
    const sanitized = value.replace(/\D/g, "");
    if (!sanitized) {
      const nextDigits = [...digits];
      nextDigits[index] = "";
      setDigits(nextDigits);
      return;
    }

    if (sanitized.length > 1) {
      handlePasteDigits(sanitized);
      return;
    }

    const nextDigits = [...digits];
    nextDigits[index] = sanitized[0];
    setDigits(nextDigits);

    // Passer au champ suivant
    if (index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else {
      // Si on remplit le dernier chiffre, auto-soumettre
      const fullToken = nextDigits.join("");
      if (fullToken.length === OTP_LENGTH) {
        submitOtp(fullToken);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePasteDigits = (pastedText: string) => {
    const rawDigits = pastedText.replace(/\D/g, "").slice(0, OTP_LENGTH).split("");
    if (rawDigits.length === 0) return;

    const nextDigits = Array(OTP_LENGTH).fill("");
    rawDigits.forEach((digit, i) => {
      nextDigits[i] = digit;
    });
    setDigits(nextDigits);

    const targetIndex = Math.min(rawDigits.length, OTP_LENGTH - 1);
    inputRefs.current[targetIndex]?.focus();

    if (rawDigits.length === OTP_LENGTH) {
      submitOtp(nextDigits.join(""));
    }
  };

  async function submitOtp(tokenToVerify: string) {
    if (!email) {
      setError("Adresse email introuvable dans l'URL.");
      return;
    }
    if (tokenToVerify.length !== OTP_LENGTH) {
      setError(`Veuillez saisir les ${OTP_LENGTH} chiffres du code.`);
      return;
    }

    setError(null);
    setInfoMessage(null);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("email", email);
    formData.append("token", tokenToVerify);

    try {
      const response = await verifyOtpAction(formData);
      if (response.success) {
        router.push("/dashboard");
      } else {
        setError(response.error);
      }
    } catch {
      setError("Une erreur inattendue est survenue.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    submitOtp(digits.join(""));
  }

  async function handleResend() {
    if (cooldown > 0 || isResending || !email) return;

    setIsResending(true);
    setError(null);
    setInfoMessage(null);

    try {
      const res = await resendOtpAction(email);
      if (res.success) {
        setInfoMessage(`Un nouveau code à ${OTP_LENGTH} chiffres a été envoyé par email.`);
        setCooldown(60);
      } else {
        setError(res.error);
      }
    } catch {
      setError("Impossible de renvoyer le code pour le moment.");
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Adresse email cible */}
      {email ? (
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 backdrop-blur-md">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#03A61C]/20 text-[#05F228]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
            <span className="truncate text-xs font-medium text-white/90" title={email}>
              {email}
            </span>
          </div>
          <Link
            href="/auth/register"
            className="shrink-0 text-[11px] font-semibold text-[#05F228] transition-colors hover:text-white hover:underline"
          >
            Modifier
          </Link>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-center text-xs text-amber-300">
          Aucun email détecté. Veuillez recommencer depuis la page d'inscription.
        </div>
      )}

      {/* Messages d'erreur ou d'information */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">
          <svg className="h-4 w-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {infoMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-[#03A61C]/40 bg-[#03A61C]/10 px-4 py-3 text-xs text-[#05F228]">
          <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>{infoMessage}</span>
        </div>
      )}

      {/* Formulaire de saisie des 8 chiffres */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div>
          <label className="mb-3 block text-center text-xs font-semibold uppercase tracking-wider text-white/50">
            Code de confirmation (8 chiffres)
          </label>

          {/* Grille de 8 cases divisée en 2 groupes de 4 avec séparateur central */}
          <div className="flex w-full items-center justify-between gap-1 sm:gap-2">
            {/* Premier groupe de 4 */}
            <div className="flex flex-1 items-center justify-between gap-1 sm:gap-1.5">
              {digits.slice(0, 4).map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={(e) => {
                    e.preventDefault();
                    handlePasteDigits(e.clipboardData.getData("text"));
                  }}
                  disabled={isLoading}
                  className="h-11 w-full min-w-0 max-w-[42px] rounded-lg border border-white/10 bg-white/5 text-center font-mono text-lg font-extrabold text-white shadow-inner backdrop-blur-md transition-all focus:border-[#05F228] focus:bg-[#03A61C]/10 focus:outline-none focus:ring-1 focus:ring-[#05F228]/40 disabled:opacity-50 sm:h-14 sm:max-w-[48px] sm:rounded-xl sm:text-2xl"
                />
              ))}
            </div>

            {/* Séparateur visuel */}
            <div className="flex items-center px-0.5 text-white/20 sm:px-1">
              <span className="h-0.5 w-2 rounded-full bg-white/30 sm:w-3" />
            </div>

            {/* Deuxième groupe de 4 */}
            <div className="flex flex-1 items-center justify-between gap-1 sm:gap-1.5">
              {digits.slice(4, 8).map((digit, idx) => {
                const index = idx + 4;
                return (
                  <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={(e) => {
                      e.preventDefault();
                      handlePasteDigits(e.clipboardData.getData("text"));
                    }}
                    disabled={isLoading}
                    className="h-11 w-full min-w-0 max-w-[42px] rounded-lg border border-white/10 bg-white/5 text-center font-mono text-lg font-extrabold text-white shadow-inner backdrop-blur-md transition-all focus:border-[#05F228] focus:bg-[#03A61C]/10 focus:outline-none focus:ring-1 focus:ring-[#05F228]/40 disabled:opacity-50 sm:h-14 sm:max-w-[48px] sm:rounded-xl sm:text-2xl"
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Bouton de validation */}
        <button
          type="submit"
          disabled={isLoading || digits.join("").length !== OTP_LENGTH || !email}
          className="group relative flex w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-r from-[#03A61C] to-[#05F228] px-4 py-3.5 text-sm font-bold text-black shadow-[0_0_25px_rgba(5,242,40,0.35)] transition-all hover:shadow-[0_0_35px_rgba(5,242,40,0.55)] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 animate-spin text-black" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Vérification en cours...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span>Valider et accéder au Hub</span>
              <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </div>
          )}
        </button>
      </form>

      {/* Action Renvoyer le code */}
      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <p className="text-xs text-white/50">
          Vous n'avez pas reçu le code ?
        </p>
        <button
          type="button"
          onClick={handleResend}
          disabled={cooldown > 0 || isResending || !email}
          className="text-xs font-semibold text-[#05F228] transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-white/30"
        >
          {isResending
            ? "Envoi en cours..."
            : cooldown > 0
            ? `Renvoyer un nouveau code (${cooldown}s)`
            : "Renvoyer un code"}
        </button>
      </div>

      {/* Note de sécurité & Aide spam */}
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-center">
        <p className="text-[11px] text-white/40">
          💡 <span className="text-white/60">Astuce :</span> Vérifiez aussi votre dossier <strong>Spams</strong> ou <strong>Courrier indésirable</strong>. Le code est valable pendant 10 minutes.
        </p>
      </div>
    </div>
  );
}
