-- In-app project feedback shared by the student owner and authorized staff.
-- This migration is local preparation only; production has not been changed.

CREATE TABLE public.project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 3000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX project_messages_project_created_idx
  ON public.project_messages (project_id, created_at);

ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.project_messages FROM anon, authenticated;
GRANT SELECT, INSERT ON public.project_messages TO authenticated;

CREATE OR REPLACE FUNCTION public.set_project_message_author_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SELECT full_name INTO NEW.author_name
  FROM public.profiles
  WHERE id = auth.uid();
  IF NEW.author_name IS NULL THEN
    RAISE EXCEPTION 'A valid author profile is required.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_message_author_name() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_set_project_message_author_name
  BEFORE INSERT ON public.project_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_project_message_author_name();

CREATE POLICY "Project participants read messages"
  ON public.project_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects pr
      JOIN public.profiles owner ON owner.id = pr.owner_id
      WHERE pr.id = project_id
        AND (
          owner.id = auth.uid()
          OR public.has_role('director')
          OR (public.has_role('admin') AND public.has_university_access(owner.university_id))
        )
    )
  );

CREATE POLICY "Project participants send messages"
  ON public.project_messages FOR INSERT TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.projects pr
      JOIN public.profiles owner ON owner.id = pr.owner_id
      WHERE pr.id = project_id
        AND (
          owner.id = auth.uid()
          OR public.has_role('director')
          OR (public.has_role('admin') AND public.has_university_access(owner.university_id))
        )
    )
  );

-- Staff replies create an in-app notification for the project owner.
CREATE OR REPLACE FUNCTION public.notify_project_owner_of_staff_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id UUID;
BEGIN
  SELECT pr.owner_id INTO v_owner_id
  FROM public.projects pr
  WHERE pr.id = NEW.project_id;

  IF v_owner_id IS NOT NULL
     AND NEW.author_id <> v_owner_id
     AND (public.has_role('admin') OR public.has_role('director')) THEN
    INSERT INTO public.notifications (user_id, type, title, message, link_url)
    VALUES (
      v_owner_id,
      'project_feedback',
      'Nouveau retour sur votre projet',
      left(NEW.body, 180),
      '/projects/' || NEW.project_id::TEXT
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_project_owner_of_staff_message() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_notify_project_owner_of_staff_message
  AFTER INSERT ON public.project_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_project_owner_of_staff_message();
