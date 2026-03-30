import { ArrowLeft, MessageCircle, PhoneCall } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/Logo';
import { PageTransition } from '@/components/PageTransition';

export default function HelpSupport() {
  const navigate = useNavigate();
  
  const supportNumber = "917993792683"; 
  const defaultMessage = "Hi GrabTheByte Support! I need some help with my canteen order.";

  const openWhatsApp = () => {
    const encodedMessage = encodeURIComponent(defaultMessage);
    window.open(`https://wa.me/${supportNumber}?text=${encodedMessage}`, '_blank');
  };

  return (
    <PageTransition>
      <div className="min-h-screen bg-background flex flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 safe-top">
          <div className="flex items-center gap-3 px-4 lg:px-6 h-13">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft size={20} />
            </Button>
            <Logo size="sm" />
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 px-4 flex flex-col items-center justify-center text-center safe-bottom">
          <div className="bg-primary/10 p-5 rounded-full mb-5">
            <PhoneCall size={40} className="text-primary" />
          </div>
          
          <h1 className="text-xl font-bold text-foreground mb-2">How can we help you?</h1>
          <p className="text-sm text-muted-foreground mb-8 max-w-xs leading-relaxed">
            Having an issue with your payment or canteen order? Drop us a message on WhatsApp and our team will fix it instantly.
          </p>

          <Button 
            onClick={openWhatsApp}
            className="w-full max-w-sm h-12 text-base font-semibold rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-lg"
          >
            <MessageCircle size={22} className="mr-2" />
            Chat on WhatsApp
          </Button>
          
          <p className="mt-6 text-xs font-medium text-muted-foreground bg-muted py-1.5 px-4 rounded-full">
            Support Hours: 9:00 AM - 4:00 PM
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
