import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from "@/assets/logo.svg";
import { ArrowLeft, Loader2, Mail, UserX } from "lucide-react";
import { Suspense, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuthActions } from "@convex-dev/auth/react";

interface AuthProps {
  redirectAfterAuth?: string;
}

/**
 * Always route through /dashboard → RoleRouter after OTP verification.
 * Extract query params from returnTo (e.g. from=jeddah&to=sanaa) so they
 * are preserved when RoleRouter redirects to the role-specific page.
 */
function dashboardDestination(searchParams: URLSearchParams): string {
  const returnTo = searchParams.get("returnTo");
  if (returnTo && returnTo.startsWith("/")) {
    try {
      const url = new URL(returnTo, window.location.origin);
      const params = url.searchParams.toString();
      return `/dashboard${params ? `?${params}` : ""}`;
    } catch {
      // Invalid returnTo — just go to /dashboard
    }
  }
  return "/dashboard";
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async () => {
    if (!email.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      await signIn("email-otp", { email: email.trim(), flow: "otp" });
      setStep("otp");
    } catch (err) {
      console.error("Send OTP error:", err);
      setError("فشل إرسال رمز التحقق. تحقق من البريد الإلكتروني.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      await signIn("email-otp", {
        email: email.trim(),
        code: otp.trim(),
      });
      // SECURITY: Always go through /dashboard → RoleRouter
      // which waits for auth + role before routing to the correct page.
      // This prevents owners/admins from being incorrectly routed to /customer.
      // Booking params (from/to) are extracted and preserved.
      navigate(dashboardDestination(searchParams));
    } catch (err) {
      console.error("Verify OTP error:", err);
      setError("رمز التحقق غير صحيح. حاول مرة أخرى.");
      setIsLoading(false);
    }
  };

  // Guest enters the booking flow without creating an account.
  // Navigate directly to the returnTo destination (usually /customer with booking params).
  const handleGuest = () => {
    const returnTo = searchParams.get("returnTo");
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      navigate(returnTo);
    } else {
      navigate("/customer");
    }
  };

  return (
    <div dir="rtl" className="min-h-screen flex flex-col bg-gradient-to-b from-background to-muted/40">
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <Card className="w-full max-w-md border shadow-md">
          <CardHeader className="text-center">
            <div className="flex justify-center">
              <img
                src={logo}
                alt="شعار خطوط زحل"
                width={64}
                height={64}
                className="rounded-lg mb-4 mt-4 cursor-pointer"
                onClick={() => navigate("/")}
              />
            </div>
            <CardTitle className="text-xl">تسجيل الدخول</CardTitle>
            <CardDescription>
              سجّل الدخول للوصول إلى حسابك
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive text-center">
                {error}
              </div>
            )}

            {step === "email" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendOtp()}
                    disabled={isLoading}
                    dir="ltr"
                  />
                </div>
                <Button
                  onClick={handleSendOtp}
                  className="w-full"
                  disabled={isLoading || !email.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="ms-2 size-4 animate-spin" />
                  ) : (
                    <Mail className="ms-2 size-4" />
                  )}
                  {isLoading ? "جارٍ الإرسال..." : "إرسال رمز التحقق"}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="otp">رمز التحقق</Label>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="000000"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                    disabled={isLoading}
                    maxLength={6}
                    dir="ltr"
                    className="text-center tracking-[0.5em] text-lg"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    أُرسل رمز إلى {email}
                  </p>
                </div>
                <Button
                  onClick={handleVerifyOtp}
                  className="w-full"
                  disabled={isLoading || !otp.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="ms-2 size-4 animate-spin" />
                  ) : (
                    <ArrowLeft className="ms-2 size-4" />
                  )}
                  {isLoading ? "جارٍ التحقق..." : "تسجيل الدخول"}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-sm"
                  onClick={() => { setStep("email"); setOtp(""); setError(""); }}
                  disabled={isLoading}
                >
                  تغيير البريد الإلكتروني
                </Button>
              </>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  أو
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleGuest}
              disabled={isLoading}
            >
              <UserX className="ms-2 size-4" />
              الدخول كضيف
            </Button>
          </CardContent>

          <div className="rounded-b-lg border-t bg-muted px-6 py-4 text-center text-xs text-muted-foreground">
            خطوط زحل (SaturnLines) — حجوزات النقل البري من السعودية إلى اليمن
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
