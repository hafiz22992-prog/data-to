import { Toaster } from "@/components/ui/sonner";
import { RequireAuth } from "@/components/RequireAuth";
import { RoleRouter, OwnerGate, CompanyGate } from "@/components/RoleGate";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import React, { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const OwnerDashboard = lazy(() => import("./pages/OwnerDashboard.tsx"));
const CompanyDashboard = lazy(() => import("./pages/CompanyDashboard.tsx"));
const CustomerHome = lazy(() => import("./pages/CustomerHome.tsx"));
const OwnerLogin = lazy(() => import("./pages/OwnerLogin.tsx"));
const CompanyLogin = lazy(() => import("./pages/CompanyLogin.tsx"));
const CompanyPage = lazy(() => import("./pages/CompanyPage.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));
const Callback = lazy(() => import("./pages/Callback.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}

/** Hard guard so runtime errors never leave the page as a blank screen. */
class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string; stack: string }
> {
  state = { hasError: false, message: "", stack: "" };
  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error.message || "Unknown runtime error",
      stack: error.stack || "",
    };
  }
  componentDidCatch(err: Error) {
    console.error("[RootErrorBoundary] Runtime crash:", err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-lg text-center">
            <p className="text-sm font-semibold">حدث خطأ غير متوقع</p>
            <p className="mt-2 text-xs text-muted-foreground break-words">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground cursor-pointer"
            >
              العودة للصفحة الرئيسية
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Per-route error boundary — catches crashes inside a single route. */
class RouteErrorBoundary extends React.Component<
  { children: React.ReactNode; routeName: string },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || "خطأ غير معروف" };
  }
  componentDidCatch(err: Error) {
    console.error(`[RouteErrorBoundary] ${this.props.routeName} crashed:`, err);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6" dir="rtl">
          <div className="max-w-md text-center rounded-xl border bg-card p-8">
            <p className="text-lg font-bold text-destructive">حدث خطأ</p>
            <p className="mt-2 text-sm text-muted-foreground">{this.state.message}</p>
            <button
              type="button"
              onClick={() => { window.location.href = "/"; }}
              className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground cursor-pointer"
            >
              العودة للصفحة الرئيسية
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootErrorBoundary>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <Suspense fallback={<RouteLoading />}>
            <Routes>
              {/* ===== صفحات عامة ===== */}
              <Route path="/" element={<Landing />} />
              <Route path="/callback" element={<Callback />} />

              {/* ===== صفحة حجز المسافر (عامة — بدون مصادقة) ===== */}
              <Route
                path="/customer"
                element={
                  <RouteErrorBoundary routeName="/customer">
                    <CustomerHome />
                  </RouteErrorBoundary>
                }
              />

              {/* ===== تسجيل دخول المسافر بالبريد + OTP ===== */}
              <Route path="/auth" element={<AuthPage redirectAfterAuth="/dashboard" />} />

              {/* ===== تسجيل دخول الشركة بالبريد + كلمة المرور ===== */}
              <Route
                path="/company/auth"
                element={
                  <RouteErrorBoundary routeName="/company/auth">
                    <CompanyLogin />
                  </RouteErrorBoundary>
                }
              />

              {/* ===== صفحة الشركة العامة (بدون مصادقة) ===== */}
              <Route
                path="/company/:slug"
                element={
                  <RouteErrorBoundary routeName="/company/:slug">
                    <CompanyPage />
                  </RouteErrorBoundary>
                }
              />

              {/* ===== لوحة تحكم الشركة ( محمية ) ===== */}
              <Route
                path="/company"
                element={
                  <RouteErrorBoundary routeName="/company">
                    <RequireAuth>
                      <CompanyGate>
                        <CompanyDashboard />
                      </CompanyGate>
                    </RequireAuth>
                  </RouteErrorBoundary>
                }
              />

              {/* ===== تسجيل دخول المالك بالبريد + كلمة المرور ===== */}
              <Route
                path="/owner/auth"
                element={
                  <RouteErrorBoundary routeName="/owner/auth">
                    <OwnerLogin />
                  </RouteErrorBoundary>
                }
              />

              {/* ===== لوحة تحكم المالك ( محمية ) ===== */}
              <Route
                path="/owner"
                element={
                  <RouteErrorBoundary routeName="/owner">
                    <RequireAuth>
                      <OwnerGate>
                        <OwnerDashboard />
                      </OwnerGate>
                    </RequireAuth>
                  </RouteErrorBoundary>
                }
              />

              {/* ===== مسار RoleRouter للتحويل بعد المصادقة ===== */}
              <Route
                path="/dashboard"
                element={
                  <RouteErrorBoundary routeName="/dashboard">
                    <RequireAuth>
                      <RoleRouter />
                    </RequireAuth>
                  </RouteErrorBoundary>
                }
              />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </RootErrorBoundary>
  </StrictMode>,
);
