import type { ButtonHTMLAttributes } from "react";
import { clsx } from "clsx";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** Icône à afficher à gauche du texte */
  leftIcon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-800 focus-visible:ring-brand-500 disabled:bg-brand-300",
  secondary:
    "bg-slate-700 text-white hover:bg-slate-800 focus-visible:ring-slate-500 disabled:bg-slate-300",
  outline:
    "border border-brand-600 text-brand-600 hover:bg-brand-50 focus-visible:ring-brand-500 disabled:border-brand-300 disabled:text-brand-300",
  ghost:
    "text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-400 disabled:text-slate-300",
  danger:
    "bg-red-700 text-white hover:bg-red-800 focus-visible:ring-red-500 disabled:bg-red-300",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

/**
 * Bouton réutilisable avec variantes, tailles et état de chargement.
 * Désactivé automatiquement pendant le chargement.
 */
export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  leftIcon,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {isLoading ? (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        leftIcon
      )}
      {children}
    </button>
  );
}
