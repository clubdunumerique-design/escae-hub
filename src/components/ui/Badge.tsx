import type { HTMLAttributes } from "react";
import { clsx } from "clsx";

export type BadgeVariant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "neutral";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-brand-100 text-brand-800",
  info: "bg-sky-100 text-sky-800",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-800",
  neutral: "bg-slate-100 text-slate-700",
};

/**
 * Badge d'état compact — utilisé pour afficher les statuts de projets, rôles, etc.
 */
export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
