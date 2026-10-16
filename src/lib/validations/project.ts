import { z } from "zod";

export const projectSchema = z.object({
  title: z.string().trim().min(5, "Le titre doit faire au moins 5 caractères.").max(150, "Le titre est trop long."),
  description: z.string().trim().min(20, "La description doit faire au moins 20 caractères.").max(10000, "La description ne peut pas dépasser 10 000 caractères."),
  objectives: z.string().trim().max(5000, "Les objectifs ne peuvent pas dépasser 5 000 caractères.").optional(),
  problem: z.string().trim().max(5000).optional().or(z.literal('')),
  solution: z.string().trim().max(5000).optional().or(z.literal('')),
  feasibility: z.string().trim().max(5000).optional(),
  impact: z.string().trim().max(5000).optional(),
  budget: z.preprocess(
    (value) => value === "" || value === null ? undefined : value,
    z.coerce.number().finite().min(0, "Le budget doit être positif ou nul.").max(1_000_000_000_000).optional(),
  ),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

export const teamMemberSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(2, "Le nom doit faire au moins 2 caractères.").max(100),
  role_in_project: z.string().min(2, "Le rôle doit faire au moins 2 caractères.").max(100),
  user_id: z.string().uuid().optional().or(z.literal("")),
});

export type TeamMemberFormData = z.infer<typeof teamMemberSchema>;
