
CREATE SEQUENCE IF NOT EXISTS public.disposal_no_seq START 1;

CREATE TABLE public.disposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disposal_no text NOT NULL UNIQUE,
  employee_code text NOT NULL,
  employee_name text NOT NULL,
  department text NOT NULL,
  transfer_document_no text NOT NULL UNIQUE,
  disposal_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.disposal_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disposal_id uuid NOT NULL REFERENCES public.disposals(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('asset','consumable')),
  asset_id uuid,
  consumable_id uuid,
  consumable_name text,
  consumable_type text,
  asset_code text,
  asset_name text,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_disposal_items_disposal_id ON public.disposal_items(disposal_id);
CREATE INDEX idx_disposals_date ON public.disposals(disposal_date DESC);

ALTER TABLE public.disposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disposal_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth view disposals" ON public.disposals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage disposals" ON public.disposals FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "Auth view disposal_items" ON public.disposal_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage disposal_items" ON public.disposal_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ฟังก์ชันออกเลขเอกสาร
CREATE OR REPLACE FUNCTION public.next_disposal_no()
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE n bigint;
BEGIN
  n := nextval('public.disposal_no_seq');
  RETURN 'DSP-' || to_char(now(), 'YYYYMM') || '-' || lpad(n::text, 4, '0');
END;
$$;
