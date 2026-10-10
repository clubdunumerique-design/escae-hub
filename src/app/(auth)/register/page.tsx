import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { RegisterForm } from "@/components/forms/RegisterForm";

export const metadata: Metadata = {
  title: "Inscription",
};

export default function RegisterPage() {
  return (
    <Card className="shadow-lg">
      <CardHeader className="text-center">
        <h1 className="text-2xl font-bold text-white">Créer un compte</h1>
        <p className="mt-2 text-sm text-white/60">
          Inscrivez-vous pour soumettre votre projet d&apos;innovation.
        </p>
      </CardHeader>
      <CardBody>
        <RegisterForm />
        <div className="mt-6 text-center text-sm text-white/60">
          Vous avez déjà un compte ?{" "}
          <Link href="/auth/login" className="font-semibold text-[#05F228] hover:underline">
            Connectez-vous
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
