import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useImageUpload() {
  const [isUploading, setIsUploading] = useState(false);

  // 🚀 REAL UPLOAD FUNCTION
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    setIsUploading(true);
    
    try {
      // 1. Secure Filename Generation (Stops files from overwriting each other)
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      
      // 2. Upload directly to Supabase
      const { error: uploadError } = await supabase.storage
        .from('menu-images') // Ensure this bucket is created and set to PUBLIC!
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false 
        });

      if (uploadError) throw uploadError;

      // 3. Get the live URL to save in your database
      const { data } = supabase.storage
        .from('menu-images')
        .getPublicUrl(fileName);

      return data.publicUrl;
      
    } catch (error) {
      console.error('Upload failed:', error);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, []);

  // 🗑️ REAL DELETE FUNCTION
  const deleteImage = useCallback(async (urlOrPath: string): Promise<boolean> => {
    try {
      // If the database gives us the full public URL, we just need the filename at the end
      const fileName = urlOrPath.split('/').pop();
      
      if (!fileName) return false;

      // Delete it physically from the Supabase bucket
      const { error } = await supabase.storage
        .from('menu-images')
        .remove([fileName]);

      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Delete failed:', error);
      return false;
    }
  }, []);

  return { uploadImage, deleteImage, isUploading };
}