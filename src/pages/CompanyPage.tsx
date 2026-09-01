import { useParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bus, MapPin, Phone, Mail, Globe, ArrowLeft, ExternalLink, Loader2 } from "lucide-react";
import { Link } from "react-router";

/**
 * صفحة عامة للشركة — يظهر عند فتح رابط الدعوة: /company/:slug
 * تعرض معلومات الشركة ورابط الدخول لحساب الشركة.
 */
export default function CompanyPage() {
  const { slug } = useParams<{ slug: string }>();
  const company = useQuery(api.companies.getPublic, slug ? { slug } : "skip");

  if (!slug) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground" dir="rtl">
        <p className="text-muted-foreground">معرف الشركة غير صحيح</p>
      </div>
    );
  }

  if (company === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground" dir="rtl">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground" dir="rtl">
        <div className="max-w-md text-center p-8">
          <div className="flex size-16 mx-auto items-center justify-center rounded-full bg-muted">
            <Bus className="size-8 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-xl font-bold">الشركة غير موجودة</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            لا توجد شركة مسجلة بهذا المعرّف على المنصة
          </p>
          <Button asChild className="mt-6">
            <Link to="/">العودة للرئيسية</Link>
          </Button>
        </div>
      </div>
    );
  }

  const companyColor = company.color || "#0f766e";

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="size-4" />
            خطوط زحل
          </Link>
          <Badge variant="secondary">صفحة الشركة</Badge>
        </div>
      </header>

      {/* Company Info */}
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-2xl border bg-card overflow-hidden">
          {/* Company Header */}
          <div className="p-8 text-center" style={{ backgroundColor: `${companyColor}10` }}>
            <div
              className="mx-auto flex size-20 items-center justify-center rounded-2xl text-white text-3xl font-bold"
              style={{ backgroundColor: companyColor }}
            >
              {company.name.charAt(0)}
            </div>
            <h1 className="mt-4 text-2xl font-extrabold">{company.name}</h1>
            {company.base && (
              <p className="mt-1 text-sm text-muted-foreground flex items-center justify-center gap-1">
                <MapPin className="size-3.5" />
                المقر: {company.base}
              </p>
            )}
            {company.status === "active" ? (
              <Badge className="mt-3 bg-emerald-100 text-emerald-700 border-emerald-200">نشطة</Badge>
            ) : (
              <Badge className="mt-3 bg-red-100 text-red-700 border-red-200">غير نشطة</Badge>
            )}
          </div>

          {/* Company Details */}
          <div className="p-6 space-y-6">
            {company.routes && (
              <div>
                <h3 className="text-sm font-bold text-muted-foreground mb-2">المسارات</h3>
                <p className="text-sm leading-6">{company.routes}</p>
              </div>
            )}

            {/* Contact Info */}
            {(company.address || (company.contactPhones && company.contactPhones.length > 0) || company.mapUrl) && (
              <div>
                <h3 className="text-sm font-bold text-muted-foreground mb-3">معلومات التواصل</h3>
                <div className="space-y-2">
                  {company.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="size-4 mt-0.5 text-muted-foreground shrink-0" />
                      <span>{company.address}</span>
                    </div>
                  )}
                  {company.contactPhones?.filter(p => p.active).map((phone) => (
                    <div key={phone.number} className="flex items-center gap-2 text-sm">
                      <Phone className="size-4 text-muted-foreground shrink-0" />
                      <span dir="ltr">{phone.number}</span>
                      {phone.label && <span className="text-muted-foreground text-xs">({phone.label})</span>}
                    </div>
                  ))}
                  {company.emails.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="size-4 text-muted-foreground shrink-0" />
                      <span dir="ltr">{company.emails[0]}</span>
                    </div>
                  )}
                  {company.mapUrl && (
                    <a
                      href={company.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <Globe className="size-4 shrink-0" />
                      عرض الموقع على الخريطة
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground text-center mb-4">
                للدخول إلى لوحة تحكم الشركة أو الحجز، سجّل الدخول باستخدام البريد الإلكتروني المرتبط بشركتك.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild className="gap-2">
                  <Link to="/company/auth">
                    دخول حساب الشركة
                    <ArrowLeft className="size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="gap-2">
                  <Link to="/">
                    العودة للرئيسية
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
