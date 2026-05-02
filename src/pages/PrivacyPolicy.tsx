import { Logo } from "@/components/Logo";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/PageTransition";

export default function PrivacyPolicy() {
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
          <h1 className="text-2xl font-bold mb-6">Privacy Policy</h1>

          <div className="prose prose-sm dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <section>
              <h2 className="text-lg font-semibold text-foreground">Introduction</h2>
              <p>
                This Privacy Policy describes how <strong>GrabTheByte</strong> ("we", "our", "us") collects, uses, shares, and protects your personal data through our Campus Food Ordering Platform. By using GrabTheByte, you agree to the terms of this Privacy Policy. If you do not agree, please do not use our platform.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">1. Information We Collect</h2>
              <p>
                We collect the following types of information to provide our canteen services:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Personal Information:</strong> Name, Email Address, Phone Number, and Campus Roll Number (for student verification).</li>
                <li><strong>Order History:</strong> Details of food items ordered, time of order, and canteen preferences.</li>
                <li><strong>Device Information:</strong> IP address and device type to ensure security and prevent fraud.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">2. Payment Data & Security</h2>
              <p>
                <strong>Important:</strong> GrabTheByte does <strong>NOT</strong> store your Credit/Debit card numbers, UPI PINs, or Net Banking passwords.
              </p>
              <p>
                All payments are processed securely through our authorized payment gateway partner, <strong>Razorpay Software Private Limited</strong>. When you make a payment, you are redirected to Razorpay's secure server. Your payment data is governed by Razorpay's privacy policy and security standards (PCI-DSS compliant).
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">3. How We Use Your Information</h2>
              <p>
                We use your data solely for:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li>Processing your food orders and communicating order status (e.g., "Order Ready" notifications).</li>
                <li>Verifying your identity as a student of the campus.</li>
                <li>Resolving complaints or refund requests.</li>
                <li>Complying with legal obligations and fraud prevention.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">4. Data Sharing</h2>
              <p>
                We do not sell your personal data to third-party advertisers. We may share limited data with:
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Canteen Vendors:</strong> To prepare your specific order (e.g., sharing your Order ID and Item List).</li>
                <li><strong>Razorpay:</strong> To process your transaction and handle refunds.</li>
                <li><strong>Law Enforcement:</strong> If required by Indian law or court order.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">5. Cookies and Local Storage</h2>
              <p>
                To enhance your experience, our application uses strictly necessary cookies and local device storage. This allows us to keep you logged into your account securely and remember the items in your cart if you accidentally close the app. By using our services, you consent to the use of these essential functional tracking technologies.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">6. Marketing and Communications</h2>
              <p>
                We may use your registered email address or phone number to send operational updates (such as order confirmations and receipts). Occasionally, we may send promotional messages regarding discounts, new canteen additions, or campus events. You have the right to opt out of promotional communications at any time by contacting support.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">7. Age of Consent</h2>
              <p>
                Our services are intended for use by college students and faculty. By using GrabTheByte, you represent that you are at least 18 years of age, or if you are a minor, that you are using the platform under the supervision and with the explicit consent of a parent or legal guardian.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">8. Data Retention</h2>
              <p>
                We retain your order history and profile information as long as you are a registered user of GrabTheByte. You may request the deletion of your account by contacting our Grievance Officer. Upon deletion, we may retain transaction logs for financial auditing purposes as required by Indian tax laws.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">9. Your Rights</h2>
              <p>
                You have the right to access, correct, or delete your personal data stored with us. You can update your profile directly within the app or contact support for assistance.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground">10. Grievance Officer</h2>
              <p>
                In accordance with the Information Technology Act 2000 and rules made there under, the name and contact details of the Grievance Officer are provided below:
              </p>
              <div className="bg-muted/50 rounded-lg p-4 space-y-2 mt-2 border border-border">
                <p><strong>Name:</strong> Mr. Bareddy Janardhan Reddy</p>
                <p><strong>Designation:</strong> Founder</p>
                <p><strong>Company:</strong> GrabTheByte</p>
                <p><strong>Address:</strong> Flat No. 1-36, Bhojanam, Near Govt School, Bandi Atmakur, Nandyal, Andhra Pradesh - 518533</p>
                <p><strong>Email:</strong> support@grabthebyte.com</p>
                <p><strong>Operating Hours:</strong> Mon - Fri (10:00 AM - 6:00 PM)</p>
              </div>
            </section>
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