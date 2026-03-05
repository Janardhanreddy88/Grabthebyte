import { Logo } from "@/components/Logo";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";

export default function RefundPolicy() {
  const navigate = useNavigate();

  return (
    <PageTransition>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50">
          <div className="flex items-center gap-3 px-4 lg:px-6 h-14">
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

        {/* Content */}
        <main className="max-w-3xl mx-auto px-4 py-8">
          <h1 className="text-2xl font-bold mb-6">Refund and Cancellation Policy</h1>

          <div className="prose prose-sm dark:prose-invert max-w-none space-y-4 text-muted-foreground">
            <p>
              Thank you for ordering with <strong>GrabTheByte</strong>. Since we deal in perishable food items prepared on-demand, strictly the following refund and cancellation policies apply:
            </p>

            <ol className="list-decimal pl-6 space-y-4">
              <li>
                <strong className="text-foreground">Cancellation Policy:</strong> 
                <p>
                  You can cancel your order ONLY if the status is <strong>"Pending"</strong> (i.e., the canteen has not yet accepted or started preparing your food). 
                  <br/>
                  Once the order status changes to <strong>"Preparing"</strong> or <strong>"Ready"</strong>, the order cannot be cancelled as ingredients have already been used.
                </p>
              </li>
              
              <li>
                <strong className="text-foreground">Refunds for Cancelled Orders:</strong> 
                <p>
                  If you successfully cancel an order while it is still in the "Pending" stage, 100% of the amount will be refunded to your original payment source.
                </p>
              </li>

              <li>
                <strong className="text-foreground">Failed Transactions:</strong> 
                <p>
                  If money was deducted from your bank account but the order was not generated due to a technical error (network failure, server issue), the amount will be automatically refunded to your source account.
                </p>
              </li>
              
              <li>
                <strong className="text-foreground">Refund Timeline:</strong> 
                <p>
                   All refunds (for cancellations or failed transactions) will be processed and credited to your original method of payment (UPI/Bank Account) within <strong>5-7 working days</strong>.
                </p>
              </li>
              
              <li>
                <strong className="text-foreground">Returns & Replacements:</strong> 
                <p>
                  Since food is a perishable good, <strong>we do not accept returns</strong> once the food has been handed over to you.
                  <br/>
                  If you find the food to be stale, foreign objects are found, or the wrong item was served, please report it to the canteen counter immediately (within 15 minutes of pickup) for a replacement or resolution.
                </p>
              </li>
            </ol>

            <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Need Help?</h3>
              <p className="text-xs">
                For any payment-related issues, please email us at <strong>support@grabthebyte.com</strong> or contact the Canteen Manager directly.
              </p>
            </div>
          </div>

          {/* Footer */}
          <footer className="mt-12 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              © {new Date().getFullYear()} GrabTheByte. All rights reserved.
            </p>
          </footer>
        </main>
      </div>
    </PageTransition>
  );
}