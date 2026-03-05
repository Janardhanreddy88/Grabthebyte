import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { useCampus } from "@/context/CampusContext";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

export default function SelectCampus() {
  const navigate = useNavigate();
  const { setCampusByCode, isLoading } = useCampus();
  const { toast } = useToast();
  const [campusCode, setCampusCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const code = campusCode.trim().toUpperCase();
    if (!code) { setError("Please enter a campus code"); return; }
    if (code.length < 2 || code.length > 10) { setError("Campus code must be 2-10 characters"); return; }
    const result = await setCampusByCode(code);
    if (result.success) { toast({ title: "Campus Found!", description: "Redirecting to login..." }); navigate("/auth"); }
    else { setError(result.error || "Campus not found. Please check the code."); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-[300px] h-[300px] rounded-full bg-primary/[0.03] blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-[250px] h-[250px] rounded-full bg-secondary/[0.03] blur-3xl" />
      </div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="relative w-full max-w-[340px]">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3"><Logo size="md" showText={false} /></div>
          <h1 className="font-display text-lg font-bold text-foreground">GrabTheByte</h1>
          <p className="text-xs text-muted-foreground mt-1">Find your campus to get started</p>
        </div>

        <div className="bg-card rounded-2xl shadow-soft border border-border p-4">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-bold text-sm">Enter Campus Code</h2>
              <p className="text-[10px] text-muted-foreground">Ask your canteen admin</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="campus-code" className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Campus Code
              </Label>
              <Input
                id="campus-code" type="text" placeholder="e.g. CMRTC"
                value={campusCode}
                onChange={(e) => { setCampusCode(e.target.value.toUpperCase()); setError(null); }}
                className={`h-11 text-lg font-mono uppercase tracking-[0.2em] text-center rounded-xl border ${error ? "border-destructive" : "border-border focus:border-primary"}`}
                maxLength={10} disabled={isLoading} autoFocus autoComplete="off"
              />
              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-1 text-destructive text-[10px] mt-1">
                  <AlertCircle className="w-3 h-3" /><span>{error}</span>
                </motion.div>
              )}
            </div>
            <Button type="submit" className="w-full h-9 font-bold rounded-xl gap-1.5 text-xs btn-glow" disabled={isLoading || !campusCode.trim()}>
              {isLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Finding...</> : <>Continue <ArrowRight size={14} /></>}
            </Button>
          </form>
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4">
          Don't know your campus code? Contact your canteen administrator.
        </p>
      </motion.div>
    </div>
  );
}