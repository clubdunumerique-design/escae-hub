"use client";

import type { FormEvent, ReactNode } from "react";
import { logoutAction } from "@/app/(auth)/actions";

export function LogoutForm({
  label = "Déconnexion",
  children,
  className,
}: {
  label?: string;
  children?: ReactNode;
  className: string;
}) {
  function confirmLogout(event: FormEvent<HTMLFormElement>) {
    if (!window.confirm("Voulez-vous vraiment vous déconnecter ? Cliquez sur OK pour confirmer.")) {
      event.preventDefault();
    }
  }

  return (
    <form action={logoutAction} onSubmit={confirmLogout}>
      <button type="submit" className={className}>
        {children ?? label}
      </button>
    </form>
  );
}
