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
import { ArrowLeft, Loader2, Bus } from "lucide-react";
import { Suspense, useState } from "react";
import { useNavigate } from "react-router";
import { useAuthActions } from "@convex-dev/auth/react";

function CompanyLoginInner() {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"login" | "register">("login");

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      await signIn("password", {
        email: email.trim(),
        password: password.trim(),
        flow: "signIn",
      });
      // SECURITY: Always go through /dashboard → RoleRouter which waits for
      // both auth + role before routing. Navigating directly to /company causes
      // a race condition where the role query hasn't loaded yet.
      navigate("/dashboard");
    } catch (err) {
      console.error("Company login error:", err);
      setError("البريد الإلكتروني أو كلمة المرور غير صحيحة. حاول مرة أخرى.");
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email.trim() || !password.trim()) return;
    setIsLoading(true);
    setError("");
    try {
      await signIn("password", {
        email: email.trim(),
        password: password.trim(),
        flow: "signUp",
      });
      // SECURITY: Always go through /dashboard → RoleRouter
      navigate("/dashboard");
    } catch (err) {
      console.error("Company register error:", err);
      setError("فشل إنشاء الحساب. تحقق من البيانات وحاول مرة أخرى.");
      setIsLoading(false);
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
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <Bus className="size-4" />
              </div>
              <CardTitle className="text-xl">لوحة شركة النقل</CardTitle>
            </div>
            <CardDescription>
              سجّل الدخول ببريد الشركة وكلمة المرور
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive text-center">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني للشركة</Label>
              <Input
                id="email"
                type="email"
                placeholder="company@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (step === "login" ? handleLogin() : handleRegister())}
                disabled={isLoading}
                dir="ltr"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (step === "login" ? handleLogin() : handleRegister())}
                disabled={isLoading}
                dir="ltr"
              />
            </div>

            {step === "login" ? (
              <Button
                onClick={handleLogin}
                className="w-full"
                disabled={isLoading || !email.trim() || !password.trim()}
              >
                {isLoading ? (
                  <Loader2 className="ms-2 size-4 animate-spin" />
                ) : (
                  <ArrowLeft className="ms-2 size-4" />
                )}
                {isLoading ? "جارٍ الدخول..." : "تسجيل الدخول"}
              </Button>
            ) : (
              <Button
                onClick={handleRegister}
                className="w-full"
                disabled={isLoading || !email.trim() || !password.trim()}
              >
                {isLoading ? (
                  <Loader2 className="ms-2 size-4 animate-spin" />
                ) : (
                  <ArrowLeft className="ms-2 size-4" />
                )}
                {isLoading ? "جارٍ الإنشاء..." : "إنشاء حساب شركة"}
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">أو</span>
              </div>
            </div>

            <Button
              variant="ghost"
              className="w-full text-sm"
              onClick={() => {
                setStep(step === "login" ? "register" : "login");
                setError("");
              }}
              disabled={isLoading}
            >
              {step === "login"
                ? "ليس لديك حساب؟ أنشئ حساب شركة"
                : "لديك حساب سجّل الدخول"}
            </Button>
          </CardContent>

          <div className="rounded-b-lg border-t bg-muted px-6 py-4 text-center text-xs text-muted-foreground">
            خطوط زحل — لوحة إدارة شركة النقل
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function CompanyLogin() {
  return (
    <Suspense>
      <CompanyLoginInner />
    </Suspense>
  );
}
