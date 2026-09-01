import { useEffect } from "react";
import { useNavigate } from "react-router";

/**
 * WorkOS AuthKit callback route.
 * After WorkOS authentication, the user is redirected here with auth params.
 * The AuthKitProvider handles the token exchange automatically.
 * We just need to redirect to the dashboard.
 */
export default function Callback() {
  const navigate = useNavigate();

  useEffect(() => {
    // AuthKit handles the token exchange via the AuthKitProvider.
    // Once the token is set, we redirect to the dashboard.
    // A small delay ensures the token is fully set before navigation.
    const timer = setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 500);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-pulse text-muted-foreground">
          جارٍ تسجيل الدخول...
        </div>
      </div>
    </div>
  );
}
