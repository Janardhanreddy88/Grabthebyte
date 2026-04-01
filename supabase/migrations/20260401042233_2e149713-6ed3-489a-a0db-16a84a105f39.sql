
CREATE TABLE public.daily_specials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campus_id UUID NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  discount_text TEXT,
  badge_text TEXT DEFAULT 'Special',
  image_url TEXT,
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_specials ENABLE ROW LEVEL SECURITY;

-- Anyone can view active specials
CREATE POLICY "Anyone can view active specials"
  ON public.daily_specials FOR SELECT
  TO public
  USING (is_active = true);

-- Campus admins can manage their specials
CREATE POLICY "Campus admins can manage specials"
  ON public.daily_specials FOR ALL
  TO authenticated
  USING (campus_id = get_user_campus_id(auth.uid()) AND is_campus_admin(auth.uid()));
