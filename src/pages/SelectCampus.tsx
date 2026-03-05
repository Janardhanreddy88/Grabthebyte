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
    if (result.success) {
      toast({ title: "Campus Found!", description: "Redirecting to login..." });
      navigate("/auth");
    } else {
      setError(result.error || "Campus not found. Please check the code.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-[400px] h-[400px] rounded-full bg-primary/[0.04] blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-[350px] h-[350px] rounded-full bg-secondary/[0.04] blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-[400px]"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" showText={false} />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">GrabTheByte</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Find your campus to get started</p>
        </div>

        {/* Card */}
        <div className="bg-card rounded-3xl shadow-medium border border-border p-6">
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center"
            >
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="font-display font-bold text-base">Enter Campus Code</h2>
              <p className="text-xs text-muted-foreground">Ask your canteen admin</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="campus-code" className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Campus Code
              </Label>
              <Input
                id="campus-code"
                type="text"
                placeholder="e.g. CMRTC"
                value={campusCode}
                onChange={(e) => { setCampusCode(e.target.value.toUpperCase()); setError(null); }}
                className={`h-14 text-xl font-mono uppercase tracking-[0.2em] text-center rounded-2xl border-2 transition-colors ${
                  error ? "border-destructive" : "border-border focus:border-primary"
                }`}
                maxLength={10}
                disabled={isLoading}
                autoFocus
                autoComplete="off"
              />
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-1.5 text-destructive text-xs mt-1"
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{error}</span>
                </motion.div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-12 font-bold rounded-2xl gap-2 text-sm btn-glow"
              disabled={isLoading || !campusCode.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Finding Campus...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight size={16} />
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Don't know your campus code? Contact your canteen administrator.
        </p>
      </motion.div>
    </div>
  );
}