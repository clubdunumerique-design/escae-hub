import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Veuillez entrer une adresse e-mail valide."),
  password: z.string().min(1, "Le mot de passe est requis."),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  fullName: z.string().min(2, "Le nom complet doit faire au moins 2 caractères."),
  email: z.string().email("Veuillez entrer une adresse e-mail institutionnelle valide."),
  studentId: z.string().max(30).optional(),
  password: z.string().min(8, "Le mot de passe doit faire au moins 8 caractères."),
  confirmPassword: z.string().min(1, "Veuillez confirmer votre mot de passe."),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas.",
  path: ["confirmPassword"],
});

export type RegisterFormData = z.infer<typeof registerSchema>;
