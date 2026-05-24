import { useEffect, useState } from "react";
import { Copy, CheckCircle2, Sparkles, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from "@/integrations/supabase/client";
import heroBannerImg from '@/assets/hero-banner.jpg'; 

export function HeroBanner() {
  const [banners, setBanners] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // 🦅 Real-time fetch for BOTH Offers and Ad Banners
  const fetchAllBanners = async () => {
    try {
      // 1. Fetch Financial Offers
      const { data: offers } = await (supabase as any)
        .from("offers")
        .select("*")
        .eq("is_active", true);

      // 🦅 THE FIX: Filter out offers that don't have an uploaded image.
      // This makes them "Secret Offers" that work at checkout but stay hidden here!
      const visibleOffers = (offers || []).filter((o: any) => 
        o.background_image_url && o.background_image_url.trim() !== ''
      );

      // 2. Fetch Visual Ad Banners
      const { data: ads } = await (supabase as any)
        .from("ad_banners")
        .select("*")
        .eq("is_active", true);

      // 3. Merge and sort by creation date
      const combined = [
        ...visibleOffers,
        ...(ads || []).map((ad: any) => ({
          ...ad,
          // Map ad fields to look like an offer for the UI
          promo_code: null, 
          background_image_url: ad.image_url,
          is_ad: true
        }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setBanners(combined);
    } catch (err) {
      console.error("Error fetching banners", err);
      setBanners([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllBanners();

    // Listen to both tables
    const offersChannel = supabase.channel('offers-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, fetchAllBanners).subscribe();
    const adsChannel = supabase.channel('ads-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'ad_banners' }, fetchAllBanners).subscribe();

    return () => {
      supabase.removeChannel(offersChannel);
      supabase.removeChannel(adsChannel);
    };
  }, []);

  const copyCode = (code: string) => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  if (isLoading) {
    return <div className="w-full max-w-4xl mx-auto aspect-[16/9] sm:aspect-[21/9] rounded-2xl bg-muted animate-pulse mb-4" />;
  }

  // 🦅 Default Fallback: If there are NO visible banners or ads, show the clean default image with NO PROMO CODES
  if (banners.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl mb-4 w-full max-w-4xl mx-auto aspect-[16/9] sm:aspect-[21/9] shadow-sm">
        <div className="absolute inset-0">
          <img src={heroBannerImg} alt="Fresh campus food" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        </div>
        <div className="relative z-10 p-4 sm:p-8 h-full flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-1.5 sm:mb-3">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground w-max">
              <Clock size={12} />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Open Now</span>
            </motion.div>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mb-1">Fresh, Fast & Delicious</h2>
          <p className="text-xs sm:text-sm text-white/80 max-w-sm flex items-center gap-1.5">
            <Sparkles size={14} className="text-yellow-400" /> Made with love, served with a smile
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="mb-4">
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {banners.map((banner) => (
          <motion.div 
            key={banner.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            onClick={() => banner.promo_code && copyCode(banner.promo_code)}
            className={`relative flex-none ${banners.length === 1 ? 'w-full max-w-4xl mx-auto' : 'w-[92%] sm:w-[85%] md:w-[70%] max-w-[800px]'} aspect-[16/9] sm:aspect-[21/9] rounded-2xl overflow-hidden shadow-md snap-center ${banner.promo_code ? 'cursor-pointer' : ''}`}
          >
            <img 
              src={banner.background_image_url} 
              alt="Banner" 
              className="absolute inset-0 w-full h-full object-contain md:object-fill object-center bg-white" 
            />

            {banner.promo_code && (
              <div className="absolute bottom-3 right-3 sm:bottom-5 sm:right-5">
                <div 
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs shadow-xl transition-all ${
                    copiedCode === banner.promo_code 
                      ? 'bg-green-500 text-white shadow-green-500/25' 
                      : 'bg-white/95 backdrop-blur-sm text-black hover:bg-gray-100'
                  }`}
                >
                  <span className="uppercase tracking-wider">{banner.promo_code}</span>
                  <div className="w-px h-3 bg-current opacity-20" />
                  {copiedCode === banner.promo_code ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}