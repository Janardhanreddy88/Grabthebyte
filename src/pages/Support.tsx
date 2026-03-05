import { Logo } from "@/components/Logo";
import { ArrowLeft, Mail, MapPin, Phone, MessageCircle, ChevronDown, ChevronUp, Send, HelpCircle, Ticket } from "lucide-react";
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

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleReportSubmit = async () => {
    if (!issueText.trim() || !subject.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in both the subject and description.",
        variant: "destructive"
      });
      return;
    }

    if (!user || !campus) {
      toast({
        title: "Login Required",
        description: "Please login to submit a support ticket.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: user.id,
          campus_id: campus.id,
          category: category,
          subject: subject.trim(),
          description: issueText.trim(),
          ticket_number: 'TEMP' // Will be replaced by trigger
        } as any)
        .select('ticket_number')
        .single();

      if (error) throw error;

      setIssueText(""); 
      setSubject("");
      toast({
        title: `Ticket ${data.ticket_number} Created`,
        description: "We have received your issue. Support team will respond shortly.",
        className: "bg-green-600 text-white border-none"
      });
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast({
        title: "Error",
        description: "Failed to create ticket. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const faqs = [
    {
      question: "My payment failed but money was deducted?",
      answer: "If the order was not generated, the amount is automatically refunded to your source account within 5-7 working days by the banking gateway."
    },
    {
      question: "Can I cancel a 'Preparing' order?",
      answer: "No. Once the canteen accepts the order and starts cooking, ingredients are used, so we cannot cancel or refund it."
    },
    {
      question: "I received the wrong item.",
      answer: "Please visit the canteen counter immediately with your Order ID. They will replace it on the spot."
    }
  ];

  return (
    <PageTransition>
      <div className="min-h-screen bg-gray-50/50 dark:bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
          <div className="flex items-center gap-3 px-4 lg:px-8 h-16 max-w-7xl mx-auto w-full">
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted" onClick={() => navigate(-1)}>
              <ArrowLeft size={20} />
            </Button>
            <Logo size="sm" />
            <div className="ml-auto flex items-center gap-2 text-muted-foreground">
              <HelpCircle size={18} />
              <span className="font-semibold text-sm hidden sm:inline-block">Help Center</span>
            </div>
          </div>
        </header>

        {/* Main Content Grid */}
        <main className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* LEFT COLUMN: Contact Info & FAQ (Spans 5 columns) */}
            <div className="lg:col-span-5 space-y-6">
              
              {/* Contact Card */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                   <MessageCircle size={100} />
                </div>
                
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                  Contact Support
                </h2>

                <div className="space-y-6 relative z-10">
                  {/* Phone */}
                  <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 text-green-600">
                      <Phone size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Call Us</h3>
                      <a href="tel:+917993137057" className="text-lg font-bold text-foreground hover:text-primary transition-colors tracking-wide">
                        +91 79931 37057
                      </a>
                      <p className="text-xs text-muted-foreground mt-0.5">Available 10:00 AM - 6:00 PM</p>
                    </div>
                  </div>

                  {/* Email */}
                  <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-600">
                      <Mail size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Email Support</h3>
                      <a href="mailto:support@grabthebyte.com" className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                        support@grabthebyte.com
                      </a>
                      <p className="text-xs text-muted-foreground mt-0.5">Response within 24 hours</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="flex items-start gap-4 p-3 rounded-xl hover:bg-muted/50 transition-colors">
                    <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 text-orange-600">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Registered Office</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">
                        GrabTheByte<br/>
                        29-178-32/D6, SBI Colony<br/>
                        Nandyal, Andhra Pradesh - 518501
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* FAQ Section */}
              <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
                <h3 className="font-bold text-lg mb-4">Common Questions</h3>
                <div className="space-y-3">
                  {faqs.map((faq, index) => (
                    <div key={index} className="border border-border/50 rounded-lg overflow-hidden bg-background/50">
                      <button 
                        onClick={() => toggleFaq(index)}
                        className="w-full flex items-center justify-between p-4 text-left font-medium text-sm hover:bg-muted/50 transition-colors"
                      >
                        {faq.question}
                        {openFaq === index ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                      </button>
                      {openFaq === index && (
                        <div className="p-4 pt-0 text-sm text-muted-foreground bg-muted/20 border-t border-border/50 leading-relaxed">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Report Form (Spans 7 columns) */}
            <div className="lg:col-span-7">
               <div className="bg-card border border-border rounded-2xl p-6 lg:p-8 shadow-sm h-full flex flex-col">
                  <div className="mb-6">
                    <div className="flex items-center gap-3 mb-2">
                       <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                          <Ticket size={22} />
                       </div>
                       <h2 className="text-2xl font-bold">Report a Problem</h2>
                    </div>
                    <p className="text-muted-foreground text-sm pl-12">
                      Facing issues with an order or payment? Raise a ticket and we will resolve it ASAP.
                    </p>
                  </div>

                  <div className="space-y-6 flex-1">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                           <Label htmlFor="subject">Subject / Order ID</Label>
                           <input
                              id="subject"
                              type="text"
                              value={subject}
                              onChange={(e) => setSubject(e.target.value)}
                              placeholder="e.g. Payment Failed Order #1234"
                              className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                           />
                        </div>
                         <div className="space-y-2">
                           <Label>Category</Label>
                           <select 
                             value={category}
                             onChange={(e) => setCategory(e.target.value)}
                             className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                           >
                              <option value="payment">Payment Issue</option>
                              <option value="order">Order Issue</option>
                              <option value="account">Account Issue</option>
                              <option value="general">General Feedback</option>
                           </select>
                         </div>
                     </div>

                     <div className="space-y-2">
                        <Label htmlFor="description">Detailed Description</Label>
                        <textarea
                           id="description"
                           value={issueText}
                           onChange={(e) => setIssueText(e.target.value)}
                           placeholder="Please describe what happened..."
                           className="flex min-h-[200px] w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none leading-relaxed"
                        />
                     </div>
                  </div>

                  <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                     <p className="text-xs text-muted-foreground text-center sm:text-left">
                        By submitting, you agree to allow our support team to access your order details.
                     </p>
                     <Button 
                       onClick={handleReportSubmit} 
                       disabled={isSubmitting}
                       size="lg"
                       className="w-full sm:w-auto min-w-[160px] rounded-xl font-bold shadow-lg shadow-primary/20"
                     >
                       {isSubmitting ? "Submitting..." : (
                         <span className="flex items-center gap-2">
                           Submit Ticket <Send size={16} />
                         </span>
                       )}
                     </Button>
                  </div>
               </div>
            </div>

          </div>

          <footer className="mt-12 text-center border-t border-border pt-8">
            <p className="text-sm text-muted-foreground">© 2026 GrabTheByte. All rights reserved.</p>
          </footer>
        </main>
      </div>
    </PageTransition>
  );
}