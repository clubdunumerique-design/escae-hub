import type { HTMLAttributes } from "react";
import { clsx } from "clsx";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Ajoute une ombre et un hover effect */
  hoverable?: boolean;
}

export function Card({ hoverable = false, className, children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={clsx(
        "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm",
        hoverable && "transition-shadow hover:shadow-[0_8px_30px_rgba(3,166,28,0.1)] hover:border-[#03A61C]/30",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={clsx("border-b border-white/10 px-6 py-4", className)}>
      {children}
    </div>
  );
}

export function CardBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...props} className={clsx("px-6 py-4", className)}>
      {children}
    </div>
  );
}

export function CardFooter({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={clsx("border-t border-white/10 px-6 py-4", className)}
    >
      {children}
    </div>
  );
}
