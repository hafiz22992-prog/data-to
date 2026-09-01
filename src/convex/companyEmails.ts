"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { sendEmail } from "../lib/resend-email";

/**
 * إرسال بريد دعوة لشركة النقل — يحتوي على رابط صفحة الشركة على المنصة.
 */
export const sendCompanyInvitation = action({
  args: {
    email: v.string(),
    companyName: v.string(),
    companyUrl: v.string(),
  },
  handler: async (ctx, { email, companyName, companyUrl }) => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      throw new Error("Recipient email is required and must be valid.");
    }
    if (!companyName.trim()) {
      throw new Error("Company name is required.");
    }
    if (!companyUrl.trim()) {
      throw new Error("Company URL is required.");
    }

    // Validate VLY_INTEGRATION_KEY
    const apiKey = process.env.VLY_INTEGRATION_KEY;
    if (!apiKey) {
      console.log("[DIAG] VLY_INTEGRATION_KEY exists: false");
      throw new Error(
        "VLY_INTEGRATION_KEY is not configured. Please add it in Convex Settings → Environment Variables.",
      );
    }

    const recipientDomain = trimmedEmail.split("@")[1] ?? "unknown";
    console.log("[DIAG] sendCompanyInvitation called");
    console.log("[DIAG] VLY_INTEGRATION_KEY exists: true, length: " + String(apiKey.length));
    console.log("[DIAG] Recipient domain: " + recipientDomain);
    console.log("[DIAG] Company URL: " + companyUrl);
    console.log("[DIAG] Company name: " + companyName);

    const subject = `مرحبًا بك في منصة خطوط زحل — رابط شركتك`;

    const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: 'Tajawal', Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .header { background: #112d70; padding: 32px 24px; text-align: center; }
    .header h1 { color: #fff; font-size: 22px; margin: 0 0 8px; }
    .header p { color: #93c5fd; font-size: 14px; margin: 0; }
    .body { padding: 32px 24px; }
    .body h2 { font-size: 18px; color: #112d70; margin: 0 0 16px; }
    .body p { font-size: 15px; line-height: 1.7; color: #475569; margin: 0 0 12px; }
    .url-box { background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin: 16px 0; text-align: center; }
    .url-box a { color: #112d70; font-size: 14px; word-break: break-all; text-decoration: none; font-weight: 600; }
    .cta { display: block; width: fit-content; margin: 24px auto; padding: 14px 40px; background: #112d70; color: #fff !important; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; }
    .footer { padding: 20px 24px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🪐 خطوط زحل — SaturnLines</h1>
      <p>منصة حجوزات النقل البري</p>
    </div>
    <div class="body">
      <h2>مرحبًا بك في منصة خطوط زحل</h2>
      <p>
        تم إنشاء صفحة خاصة لشركتكم <strong>${companyName}</strong> على منصة خطوط زحل.
      </p>
      <p>
        هذا الرابط هو صفحة شركتكم الخاصة على المنصة — يمكنك مشاركته مع عملائكم لعرض رحلاتكم والحجوزات المتاحة.
      </p>
      <p>
        <strong>للدخول لأول مرة:</strong> افتح الرابط أدناه وسجّل الدخول بنفس البريد الإلكتروني المرفق. سيتم تعيين حسابك تلقائياً كمسؤول للشركة.
      </p>
      <div class="url-box">
        <a href="${companyUrl}">${companyUrl}</a>
      </div>
      <a href="${companyUrl}" class="cta">فتح صفحة الشركة</a>
      <p style="font-size:13px;color:#94a3b8;text-align:center; margin-top: 24px;">
        إذا لم تطلب هذا البريد، يمكنك تجاهل هذه الرسالة.
      </p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} خطوط زحل — SaturnLines. جميع الحقوق محفوظة.
    </div>
  </div>
</body>
</html>`;

    const text = `
مرحبًا بك في منصة خطوط زحل

تم إنشاء صفحة خاصة لشركتكم ${companyName} على منصة خطوط زحل.

هذا الرابط هو صفحة شركتكم الخاصة على المنصة — يمكنك مشاركته مع عملائكم:

${companyUrl}

للدخول لأول مرة: افتح الرابط وسجّل الدخول بنفس البريد الإلكتروني المرفق.

إذا لم تطلب هذا البريد، يمكنك تجاهل هذه الرسالة.
    `.trim();

    // Send via VLY Integrations
    const result = await sendEmail({
      to: trimmedEmail,
      subject,
      html,
      text,
    });

    if (result.success) {
      console.log("[EMAIL] SUCCESS - Email sent. ID: " + String(result.id));
      return { sent: true, email: trimmedEmail, id: result.id };
    } else {
      console.error("[EMAIL] FAILED - error: " + String(result.error));
      console.error("[EMAIL] FAILED - raw: " + JSON.stringify(result.raw ?? null));
      throw new Error(`Email Error: ${result.error}`);
    }
  },
});

/**
 * تشخيص حالة VLY — يتحقق من وجود المفتاح فقط.
 */
export const checkEmailStatus = action({
  args: {},
  handler: async () => {
    const apiKey = process.env.VLY_INTEGRATION_KEY;
    return {
      exists: !!apiKey,
      keyLength: apiKey?.length ?? 0,
    };
  },
});
