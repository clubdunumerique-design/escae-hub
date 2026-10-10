-- Migration: 20241010050000_notifications_schema
-- Description: Table pour le système de notifications in-app

CREATE TABLE public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'status_change', 'new_evaluation', 'presentation_scheduled', etc.
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link_url TEXT, -- Lien optionnel (ex: /projects/123)
    read_at TIMESTAMPTZ, -- Si null, la notification est non lue
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Un utilisateur ne peut voir que ses propres notifications
CREATE POLICY "Utilisateur voit ses notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- L'utilisateur peut modifier ses propres notifications (pour les marquer comme lues)
CREATE POLICY "Utilisateur modifie ses notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

-- Pas de policy d'insert directe client-side (les notifications seront inserees via des server actions avec service role ou via les triggers cote serveur)
