import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCampus } from '@/context/CampusContext';

export interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export function useCategories() {
  const { campus } = useCampus();

  return useQuery({
    queryKey: ['categories', campus?.id],
    queryFn: async (): Promise<CategoryItem[]> => {
      if (!campus?.id) return [];

      const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon, sort_order, is_active')
        .eq('campus_id', campus.id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []).map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon || '🍽️',
        sort_order: c.sort_order ?? 0,
        is_active: c.is_active,
      }));
    },
    enabled: !!campus?.id,
  });
}

export function useAllCategories() {
  const { campus } = useCampus();

  return useQuery({
    queryKey: ['all-categories', campus?.id],
    queryFn: async (): Promise<CategoryItem[]> => {
      if (!campus?.id) return [];

      const { data, error } = await supabase
        .from('categories')
        .select('id, name, icon, sort_order, is_active')
        .eq('campus_id', campus.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      return (data || []).map(c => ({
        id: c.id,
        name: c.name,
        icon: c.icon || '🍽️',
        sort_order: c.sort_order ?? 0,
        is_active: c.is_active,
      }));
    },
    enabled: !!campus?.id,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { campus } = useCampus();

  return useMutation({
    mutationFn: async (input: { name: string; icon: string }) => {
      if (!campus?.id) throw new Error('No campus selected');

      // Get max sort_order
      const { data: existing } = await supabase
        .from('categories')
        .select('sort_order')
        .eq('campus_id', campus.id)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextOrder = (existing?.[0]?.sort_order ?? -1) + 1;

      const { data, error } = await supabase
        .from('categories')
        .insert([{
          campus_id: campus.id,
          name: input.name,
          icon: input.icon,
          sort_order: nextOrder,
          is_active: true,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['all-categories'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { id: string; name?: string; icon?: string; is_active?: boolean; sort_order?: number }) => {
      const { id, ...rest } = input;
      const { data, error } = await supabase
        .from('categories')
        .update(rest)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['all-categories'] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['all-categories'] });
    },
  });
}
