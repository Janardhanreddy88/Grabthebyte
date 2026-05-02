import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Process a secure refund via Razorpay Edge Function (Super Admin Only)
export function useProcessRefund() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const { data, error } = await supabase.functions.invoke('process-refund', {
        body: { order_id: orderId }
      });

      if (error) {
        throw new Error(error.message || 'Failed to trigger refund function');
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      // Refresh the Super Admin orders list so the UI instantly updates to "Refunded"
      queryClient.invalidateQueries({ queryKey: ['super-admin-orders'] });
    },
  });
}