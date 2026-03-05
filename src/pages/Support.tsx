import { Logo } from "@/components/Logo";
import { ArrowLeft, Mail, MapPin, Phone, ChevronDown, ChevronUp, Send, HelpCircle, Ticket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useCampus } from "@/context/CampusContext";

export default function Support() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { campus } = useCampus();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [issueText, setIssueText] = useState("");
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("payment");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReportSubmit = async () => {
    if (!issueText.trim() || !subject.trim()) { toast({ title: "Missing Info", description: "Fill in subject and description.", variant: "destructive" }); return; }
    if (!user || !campus) { toast({ title: "Login Required", variant: "destructive" }); return; }
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.from('support_tickets').insert({ user_id: user.id, campus_id: campus.id, category, subject: subject.trim(), description: issueText.trim(), ticket_number: 'TEMP' } as any).select('ticket_number').single();
      if (error) throw error;
      setIssueText(""); setSubject("");
      toast({ title: `Ticket ${data.ticket_number} Created`, description: "We'll respond shortly.", className: "bg-green-600 text-white border-none" });
    } catch { toast({ title: "Error", description: "Failed to create ticket.", variant: "destructive" }); }
    finally { setIsSubmitting(false); }
  };

  const faqs = [
    { question: "Payment failed but money deducted?", answer: "Amount is auto-refunded within 5-7 working days by the banking gateway." },
    { question: "Can I cancel a confirmed order?", answer: "No. Once accepted, ingredients are used and we cannot cancel or refund." },
    { question: "Received wrong item?", answer: "Visit the counter with your Order ID for an immediate replacement." },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="flex items-center gap-2 px-4 h-11 max-w-7xl mx-auto">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => navigate(-1)}><ArrowLeft size={14} /></Button>
            <Logo size="sm" />
            <div className="ml-auto flex items-center gap-1 text-muted-foreground"><HelpCircle size={14} /><span className="font-semibold text-[11px] hidden sm:inline">Help Center</span></div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Contact + FAQ */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <h2 className="text-sm font-bold mb-4">Contact Support</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 text-green-600"><Phone size={14} /></div>
                    <div>
                      <h3 className="font-semibold text-xs">Call Us</h3>
                      <a href="tel:+917993137057" className="text-sm font-bold text-foreground">+91 79931 37057</a>
                      <p className="text-[10px] text-muted-foreground">10:00 AM - 6:00 PM</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-600"><Mail size={14} /></div>
                    <div>
                      <h3 className="font-semibold text-xs">Email</h3>
                      <a href="mailto:support@grabthebyte.com" className="text-xs font-medium text-foreground">support@grabthebyte.com</a>
                      <p className="text-[10px] text-muted-foreground">Response within 24h</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 text-orange-600"><MapPin size={14} /></div>
                    <div>
                      <h3 className="font-semibold text-xs">Office</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">GrabTheByte, 29-178-32/D6, SBI Colony, Nandyal, AP - 518501</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
                <h3 className="font-bold text-sm mb-3">Common Questions</h3>
                <div className="space-y-2">
                  {faqs.map((faq, i) => (
                    <div key={i} className="border border-border/50 rounded-lg overflow-hidden bg-background/50">
                      <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-3 text-left font-medium text-xs hover:bg-muted/50 transition-colors">
                        {faq.question}
                        {openFaq === i ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
                      </button>
                      {openFaq === i && <div className="p-3 pt-0 text-xs text-muted-foreground bg-muted/20 border-t border-border/50">{faq.answer}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Report Form */}
            <div className="lg:col-span-7">
              <div className="bg-card border border-border rounded-xl p-4 lg:p-6 shadow-sm h-full flex flex-col">
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Ticket size={16} /></div>
                    <h2 className="text-base font-bold">Report a Problem</h2>
                  </div>
                  <p className="text-muted-foreground text-[11px] pl-10">Raise a ticket and we'll resolve it ASAP.</p>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="subject" className="text-[11px] font-semibold text-muted-foreground">Subject / Order ID</Label>
                      <input id="subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Payment Failed #1234"
                        className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-muted-foreground">Category</Label>
                      <select value={category} onChange={(e) => setCategory(e.target.value)}
                        className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <option value="payment">Payment Issue</option>
                        <option value="order">Order Issue</option>
                        <option value="account">Account Issue</option>
                        <option value="general">General Feedback</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="description" className="text-[11px] font-semibold text-muted-foreground">Description</Label>
                    <textarea id="description" value={issueText} onChange={(e) => setIssueText(e.target.value)} placeholder="Describe what happened..."
                      className="flex min-h-[160px] w-full rounded-xl border border-input bg-background px-3 py-2 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-[10px] text-muted-foreground text-center sm:text-left">By submitting, you allow support to access your order details.</p>
                  <Button onClick={handleReportSubmit} disabled={isSubmitting} size="sm" className="w-full sm:w-auto min-w-[120px] rounded-xl font-bold text-xs">
                    {isSubmitting ? "Submitting..." : <span className="flex items-center gap-1.5">Submit Ticket <Send size={12} /></span>}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-8 text-center border-t border-border pt-6">
            <p className="text-[10px] text-muted-foreground">© 2026 GrabTheByte. All rights reserved.</p>
          </footer>
        </main>
      </div>
    </PageTransition>
  );
}