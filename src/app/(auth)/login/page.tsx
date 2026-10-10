import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { LoginForm } from "@/components/forms/LoginForm";

export const metadata: Metadata = {
  title: "Connexion",
};

export default function LoginPage() {
  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <h1 className="text-2xl font-bold text-white">Bon retour</h1>
        <p className="mt-2 text-sm text-white/60">
          Connectez-vous pour accéder à votre espace projet.
        </p>
      </CardHeader>
      <CardBody>
        <LoginForm />
        <div className="mt-6 text-center text-sm text-white/60">
          Pas encore de compte ?{" "}
          <Link href="/auth/register" className="font-semibold text-[#05F228] hover:underline">
            Inscrivez-vous ici
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
