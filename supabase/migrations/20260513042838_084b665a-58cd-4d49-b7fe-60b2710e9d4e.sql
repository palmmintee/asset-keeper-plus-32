
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'auditor');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- user_roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Master data tables
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.asset_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT '#64748b',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.asset_statuses ENABLE ROW LEVEL SECURITY;

-- Assets
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  status_id UUID REFERENCES public.asset_statuses(id) ON DELETE SET NULL,
  purchase_date DATE,
  warranty_expiry_date DATE,
  image_url TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_assets_category ON public.assets(category_id);
CREATE INDEX idx_assets_location ON public.assets(location_id);
CREATE INDEX idx_assets_status ON public.assets(status_id);

-- Audit logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_assets_updated BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- New user trigger: create profile + assign role (first user = admin, else user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count INT;
  assigned_role app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email);

  SELECT COUNT(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'user';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned_role);
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============== RLS POLICIES ==============

-- profiles
CREATE POLICY "View own profile or admin views all" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete profiles" ON public.profiles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- user_roles
CREATE POLICY "Auth view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- categories / locations / asset_statuses: read all auth, write admin
CREATE POLICY "Auth view categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Auth view locations" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage locations" ON public.locations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Auth view statuses" ON public.asset_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage statuses" ON public.asset_statuses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- assets: all auth read, admin write
CREATE POLICY "Auth view assets" ON public.assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage assets" ON public.assets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- audit logs: all auth read+insert (system writes during actions)
CREATE POLICY "Auth view audit" ON public.audit_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert audit" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Storage bucket for asset images
INSERT INTO storage.buckets (id, name, public) VALUES ('asset-images', 'asset-images', true);
CREATE POLICY "Public read asset images" ON storage.objects FOR SELECT USING (bucket_id = 'asset-images');
CREATE POLICY "Auth upload asset images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'asset-images');
CREATE POLICY "Auth update asset images" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'asset-images');
CREATE POLICY "Auth delete asset images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'asset-images');

-- Seed master data
INSERT INTO public.categories (name, description) VALUES
  ('Notebook', 'คอมพิวเตอร์โน้ตบุ๊ก'),
  ('Desktop', 'คอมพิวเตอร์ตั้งโต๊ะ'),
  ('Monitor', 'จอภาพ'),
  ('Printer', 'เครื่องพิมพ์'),
  ('Network', 'อุปกรณ์เครือข่าย'),
  ('Mobile', 'มือถือ/แท็บเล็ต'),
  ('Accessory', 'อุปกรณ์เสริม');

INSERT INTO public.locations (name, description) VALUES
  ('สำนักงานใหญ่ ชั้น 1', 'แผนกต้อนรับ'),
  ('สำนักงานใหญ่ ชั้น 2', 'ฝ่ายบัญชี'),
  ('สำนักงานใหญ่ ชั้น 3', 'ฝ่าย IT'),
  ('คลังสินค้า', 'พื้นที่จัดเก็บ'),
  ('สาขา 1', '');

INSERT INTO public.asset_statuses (name, color) VALUES
  ('ใช้งาน', '#10b981'),
  ('ว่าง', '#3b82f6'),
  ('ถูกยืม', '#f59e0b'),
  ('ซ่อม', '#f97316'),
  ('เสีย', '#ef4444'),
  ('จำหน่ายแล้ว', '#6b7280');
