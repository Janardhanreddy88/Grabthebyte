import { useEffect, useState } from "react";
import { Copy, CheckCircle2, Sparkles, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from "@/integrations/supabase/client";
import heroBannerImg from '@/assets/hero-banner.jpg'; 

export function HeroBanner() {
  const [offers, setOffers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // 🦅 Real-time fetch for MULTIPLE active offers
  const fetchActiveOffers = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("offers")
        .select("*")
        .eq("is_active", true)
        .order('created_at', { ascending: false }); // Newest offers first!

      if (data && !error) {
        setOffers(data);
      } else {
        setOffers([]);
      }
    } catch (err) {
      console.error("Error fetching offers");
      setOffers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveOffers();

    // ⚡ REAL-TIME LISTENER: Instantly updates the carousel if you add/remove offers
    const channel = supabase
      .channel('offers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'offers' },
        () => {
          fetchActiveOffers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const copyCode = (code: string) => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  // 1. COMPACT LOADING SKELETON
  if (isLoading) {
    return <div className="w-full h-40 rounded-2xl bg-muted animate-pulse mb-4" />;
  }

  // 2. 🛡️ THE FALLBACK (No active offers at all)
  // We keep the gradient here just for the default fallback image so the text is readable!
  if (offers.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl mb-4 h-40 shadow-sm">
        <div className="absolute inset-0">
          <img src={heroBannerImg} alt="Fresh campus food" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
        </div>
        <div className="relative z-10 p-4 h-full flex flex-col justify-center">
          <div className="flex items-center gap-1.5 mb-1.5">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
              <Clock size={10} />
              <span className="text-[9px] font-bold uppercase tracking-wider">Open Now</span>
            </motion.div>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-white mb-0.5 tracking-tight">Fresh, Fast & Delicious</h2>
          <p className="text-[10px] sm:text-xs text-white/80 max-w-sm flex items-center gap-1">
            <Sparkles size={10} className="text-yellow-400" />Made with love, served with a smile
          </p>
        </div>
      </motion.div>
    );
  }

  // 3. 🌟 ZOMATO-STYLE SWIPEABLE CAROUSEL (REFACTORED FOR PURE IMAGES)
  return (
    <div className="mb-4">
      {/* Native CSS Scroll snapping */}
      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 scroll-smooth [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {offers.map((offer) => (
          <motion.div 
            key={offer.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            onClick={() => copyCode(offer.promo_code)}
            className={`relative flex-none ${offers.length === 1 ? 'w-full' : 'w-[92%] sm:w-[85%]'} h-40 sm:h-44 rounded-2xl overflow-hidden shadow-md cursor-pointer snap-center`}
          >
            {/* 🌟 1. THE FLIPKART-STYLE PURE IMAGE */}
            <img 
              src={offer.background_image_url || heroBannerImg} 
              alt="Promo Banner" 
              className="absolute inset-0 w-full h-full object-cover" 
            />

            {/* 🌟 2. THE ONLY FLOATING UI: The Copy Button */}
            {offer.promo_code && (
              <div className="absolute bottom-3 right-3">
                <div 
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs shadow-xl transition-all ${
                    copiedCode === offer.promo_code 
                      ? 'bg-green-500 text-white' 
                      : 'bg-white/95 backdrop-blur-sm text-black hover:bg-gray-100'
                  }`}
                >
                  <span className="uppercase tracking-wider">
                    {offer.promo_code}
                  </span>
                  <div className="w-px h-3 bg-current opacity-20" />
                  {copiedCode === offer.promo_code ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                </div>
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}