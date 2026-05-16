CREATE TABLE public.consumables (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_type text NOT NULL,
  equipment_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.consumables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view consumables" ON public.consumables
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin manage consumables" ON public.consumables
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER consumables_set_updated_at
  BEFORE UPDATE ON public.consumables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
