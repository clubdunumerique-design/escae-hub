import { z } from "zod";

export const projectSchema = z.object({
  title: z.string().min(5, "Le titre doit faire au moins 5 caractères.").max(150, "Le titre est trop long."),
  description: z.string().min(20, "La description doit faire au moins 20 caractères."),
  objectives: z.string().optional(),
  problem: z.string().min(10, "Veuillez détailler le problème à résoudre.").optional().or(z.literal('')),
  solution: z.string().min(10, "Veuillez détailler votre solution.").optional().or(z.literal('')),
  feasibility: z.string().optional(),
  impact: z.string().optional(),
  budget: z.coerce.number().min(0, "Le budget doit être positif ou nul").optional(),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

export const teamMemberSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2, "Le nom doit faire au moins 2 caractères.").max(100),
  role_in_project: z.string().min(2, "Le rôle doit faire au moins 2 caractères.").max(100),
  user_id: z.string().uuid().optional().or(z.literal("")),
});

export type TeamMemberFormData = z.infer<typeof teamMemberSchema>;
