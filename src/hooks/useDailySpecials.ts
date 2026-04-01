import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCampus } from '@/context/CampusContext';

export interface DailySpecial {
  id: string;
  title: string;
  description: string | null;
  discount_text: string | null;
  badge_text: string | null;
  image_url: string | null;
  menu_item_id: string | null;
}

export function useDailySpecials() {
  const { campus } = useCampus();
  const [specials, setSpecials] = useState<DailySpecial[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!campus?.id) {
      setSpecials([]);
      setIsLoading(false);
      return;
    }

    const fetch = async () => {
      setIsLoading(true);
      const now = new Date().toISOString();
      const { data } = await supabase
        .from('daily_specials')
        .select('id, title, description, discount_text, badge_text, image_url, menu_item_id')
        .eq('campus_id', campus.id)
        .eq('is_active', true)
        .or(`expires_at.is.null,expires_at.gte.${now}`)
        .order('sort_order');

      setSpecials((data as DailySpecial[]) || []);
      setIsLoading(false);
    };

    fetch();
  }, [campus?.id]);

  return { specials, isLoading };
}
