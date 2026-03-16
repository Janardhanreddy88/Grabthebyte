import { Logo } from "@/components/Logo";
import { ArrowLeft, Mail, MapPin, Phone, ChevronDown, ChevronUp, Send, HelpCircle, Ticket, User } from "lucide-react";
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
    { question: "Payment failed but money deducted?", answer: "Don't worry! This is a banking delay. The amount is automatically refunded within 5-7 working days by the payment gateway." },
    { question: "Can I cancel a confirmed order?", answer: "No. Once the restaurant accepts the order, ingredients are processed and we cannot offer cancellations or refunds." },
    { question: "Received wrong or missing items?", answer: "Please visit the specific restaurant counter with your Order ID immediately for a replacement or resolution." },
    { question: "How do I track my order status?", answer: "Go to 'My Orders' and click on your active order. Statuses update from 'Preparing' to 'Ready for Pickup' in real-time." },
    { question: "Where do I pick up my food?", answer: "Head to the specific restaurant counter mentioned in your digital invoice. Show your Order ID to the staff." },
    { question: "Is my payment information secure?", answer: "Yes. We use Cashfree's PCI-DSS compliant gateway. We never store your card or UPI pin details on our servers." },
    { question: "Forgot to pick up my order?", answer: "Orders not picked up within 30 minutes of being marked 'Ready' are disposed of for hygiene reasons and are non-refundable." },
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="flex items-center gap-3 px-3 h-12 max-w-7xl mx-auto">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => navigate(-1)}><ArrowLeft size={18} /></Button>
            <Logo size="sm" />
            <div className="ml-auto flex items-center gap-1.5 text-muted-foreground"><HelpCircle size={16} /><span className="font-semibold text-sm hidden sm:inline">Help Center</span></div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <h2 className="text-base font-bold mb-4">Contact Support</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 text-purple-600"><User size={18} /></div>
                    <div>
                      <h3 className="font-semibold text-sm">Proprietor</h3>
                      <p className="text-sm font-bold text-foreground">BAREDDY JANARDHAN REDDY</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 text-green-600"><Phone size={18} /></div>
                    <div>
                      <h3 className="font-semibold text-sm">Call Us</h3>
                      <a href="tel:+917993137057" className="text-sm font-bold text-foreground">+91 79931 37057</a>
                      <p className="text-xs text-muted-foreground">10:00 AM - 6:00 PM</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-600"><Mail size={18} /></div>
                    <div>
                      <h3 className="font-semibold text-sm">Email</h3>
                      <a href="mailto:support@grabthebyte.com" className="text-sm font-medium text-foreground">support@grabthebyte.com</a>
                      <p className="text-xs text-muted-foreground">Response within 24h</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 text-orange-600"><MapPin size={18} /></div>
                    <div>
                      <h3 className="font-semibold text-sm">Registered Office</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">GrabTheByte, 29-178-32/D6, SBI Colony, Nandyal, Andhra Pradesh - 518501</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <h3 className="font-bold text-base mb-4">Common Questions</h3>
                <div className="space-y-2">
                  {faqs.map((faq, i) => (
                    <div key={i} className="border border-border/50 rounded-xl overflow-hidden bg-background/50">
                      <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between p-3.5 text-left font-medium text-sm hover:bg-muted/50 transition-colors">
                        {faq.question}
                        {openFaq === i ? <ChevronUp size={16} className="text-muted-foreground shrink-0" /> : <ChevronDown size={16} className="text-muted-foreground shrink-0" />}
                      </button>
                      {openFaq === i && <div className="px-3.5 pb-3.5 text-sm text-muted-foreground bg-muted/20 border-t border-border/50">{faq.answer}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="bg-card border border-border rounded-2xl p-5 lg:p-6 shadow-sm h-full flex flex-col">
                <div className="mb-5">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary"><Ticket size={20} /></div>
                    <h2 className="text-lg font-bold">Report a Problem</h2>
                  </div>
                  <p className="text-muted-foreground text-sm pl-[52px]">Raise a ticket and we'll resolve it ASAP.</p>
                </div>

                <div className="space-y-4 flex-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="subject" className="text-xs font-semibold text-muted-foreground">Subject / Order ID</Label>
                      <input id="subject" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Payment Failed #1234"
                        className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold text-muted-foreground">Category</Label>
                      <select value={category} onChange={(e) => setCategory(e.target.value)}
                        className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        <option value="payment">Payment Issue</option>
                        <option value="order">Order Issue</option>
                        <option value="account">Account Issue</option>
                        <option value="general">General Feedback</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs font-semibold text-muted-foreground">Description</Label>
                    <textarea id="description" value={issueText} onChange={(e) => setIssueText(e.target.value)} placeholder="Describe what happened..."
                      className="flex min-h-[160px] w-full rounded-xl border border-input bg-background px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none" />
                  </div>
                </div>

                <div className="mt-5 pt-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground text-center sm:text-left">By submitting, you allow support to access your order details.</p>
                  <Button onClick={handleReportSubmit} disabled={isSubmitting} className="w-full sm:w-auto min-w-[140px] rounded-xl font-bold">
                    {isSubmitting ? "Submitting..." : <span className="flex items-center gap-2">Submit Ticket <Send size={16} /></span>}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <footer className="mt-8 text-center border-t border-border pt-6">
            <p className="text-xs text-muted-foreground">© 2026 GrabTheByte. All rights reserved.</p>
          </footer>
        </main>
      </div>
    </PageTransition>
  );
}
