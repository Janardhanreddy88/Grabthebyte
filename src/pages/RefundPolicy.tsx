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
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border/50 safe-top">
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
              Thank you for using <strong>GrabTheByte</strong>. GrabTheByte is a technology platform that facilitates digital queue management and ordering for independent campus canteens. Because the partner canteens prepare perishable food items on-demand, the following refund and cancellation policies apply:
            </p>

            <ol className="list-decimal pl-6 space-y-4">
              <li>
                <strong className="text-foreground">Cancellation Policy:</strong> 
                <p>
                  Once a payment is successful, the order is immediately transmitted to the partner canteen for preparation. Therefore, <strong>cancellations by users/students are not permitted under any circumstances</strong>. Please review your cart carefully before completing the payment.
                </p>
              </li>
              
              <li>
                <strong className="text-foreground">Refunds for Cancelled Orders:</strong> 
                <p>
                  Refunds are <strong>only provided if an order is explicitly cancelled by the Canteen Admin</strong> (for example, if an item becomes unexpectedly out of stock or the canteen is unable to fulfill the order). If the Admin cancels your order, 100% of the transaction amount will be automatically refunded to your original payment source.
                </p>
              </li>

              <li>
                <strong className="text-foreground">Failed Transactions:</strong> 
                <p>
                  If money was deducted from your bank account but the order was not generated on the platform due to a technical error (network failure, server issue), the amount will be automatically refunded to your source account.
                </p>
              </li>
              
              <li>
                <strong className="text-foreground">Refund Timeline:</strong> 
                <p>
                   All eligible refunds (for Admin cancellations or failed transactions) are processed through our payment gateway (Razorpay) and will be credited to your original method of payment (UPI/Bank Account) within <strong>5-7 working days</strong>.
                </p>
              </li>
              
              <li>
                <strong className="text-foreground">Returns & Food Quality:</strong> 
                <p>
                  GrabTheByte provides the software infrastructure and <strong>does not prepare, handle, or inspect the food</strong>. Since food is a perishable good, returns are not accepted.
                  <br/>
                  If you have concerns regarding the food quality (e.g., stale, foreign objects, or wrong item served), you must report it directly to the Canteen Manager immediately upon pickup. Any physical replacements or resolutions must be handled directly with the canteen staff.
                </p>
              </li>
            </ol>

            <div className="mt-8 p-4 bg-muted/50 rounded-lg border border-border">
              <h3 className="font-semibold text-foreground mb-2">Need Help?</h3>
              <p className="text-xs">
                For any software or payment-related issues, please email us at <strong>support@grabthebyte.com</strong>. For issues relating to food preparation, please contact the respective Canteen Manager directly.
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