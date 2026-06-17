import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ArrowRight, Loader2, AlertCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useCampus } from "@/context/CampusContext";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client"; // Check this path!

interface CampusData {
  name: string;
  code: string;
}

export default function SelectCampus() {
  const navigate = useNavigate();
  const { setCampusByCode, isLoading } = useCampus();
  const { toast } = useToast();
  
  const [campusCode, setCampusCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  const [campuses, setCampuses] = useState<CampusData[]>([]);
  const [isLoadingCampuses, setIsLoadingCampuses] = useState(true);

  // Fetch live campus data from Supabase
  useEffect(() => {
    const fetchCampuses = async () => {
      try {
        const { data, error } = await supabase
          .from('campuses')
          .select('name, code')
          .order('name'); 
          
        if (error) throw error;
        setCampuses(data || []);
      } catch (err) {
        console.error("Error fetching campuses:", err);
        toast({ 
          title: "Error", 
          description: "Failed to load campus list. Please refresh.", 
          variant: "destructive" 
        });
      } finally {
        setIsLoadingCampuses(false);
      }
    };

    fetchCampuses();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!campusCode) { 
      setError("Please select a campus"); 
      return; 
    }
    
    // The value passed here is ALREADY just the code (e.g., "CMRTC")
    const result = await setCampusByCode(campusCode);
    if (result.success) { 
      toast({ title: "Campus Selected!", description: "Redirecting to login..." }); 
      navigate("/auth"); 
    } else { 
      setError(result.error || "Campus not found. Please try again."); 
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-5 bg-background relative overflow-hidden safe-top safe-bottom">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-[300px] h-[300px] rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-[250px] h-[250px] rounded-full bg-secondary/[0.03] blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><Logo size="lg" showText={false} /></div>
          <h1 className="font-display text-2xl font-bold text-foreground">GrabTheByte</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Find your campus to get started</p>
        </div>

        <div className="bg-card rounded-2xl shadow-soft border border-border p-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base">Select Your Campus</h2>
              <p className="text-xs text-muted-foreground">Choose from the dropdown below</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="campus-select" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Campus List
              </Label>
              
              <div className="relative">
                <select
                  id="campus-select"
                  value={campusCode}
                  onChange={(e) => { setCampusCode(e.target.value); setError(null); }}
                  disabled={isLoading || isLoadingCampuses}
                  className={`w-full h-12 px-4 text-sm font-medium rounded-xl border bg-background appearance-none cursor-pointer ${
                    error ? "border-destructive" : "border-border focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <option value="" disabled>
                    {isLoadingCampuses ? "Loading campuses..." : "Select your campus"}
                  </option>
                  
                  {campuses.map((campus) => (
                    <option key={campus.code} value={campus.code}>
                      {/* 🧠 THE CTO HACK: Show just the code if selected, otherwise show Name - Code */}
                      {campusCode === campus.code 
                        ? campus.code 
                        : `${campus.name} - ${campus.code}`}
                    </option>
                  ))}
                </select>
                
                <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                  {isLoadingCampuses ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </div>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1.5 text-destructive text-xs mt-1">
                  <AlertCircle className="w-3.5 h-3.5" /><span>{error}</span>
                </motion.div>
              )}
            </div>
            
            <Button type="submit" className="w-full font-bold rounded-xl gap-2 text-sm btn-glow" disabled={isLoading || isLoadingCampuses || !campusCode}>
              {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Connecting...</> : <>Continue <ArrowRight size={16} /></>}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-5">
          Can't find your campus? Contact your canteen administrator.
        </p>
      </motion.div>
    </div>
  );
}