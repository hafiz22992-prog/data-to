import { createVlyIntegrations } from "@vly-ai/integrations";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  from?: string;
}

export interface EmailSendResult {
  success: boolean;
  error?: string;
  id?: string;
  /** Raw data returned by VLY SDK for diagnostic logging */
  raw?: Record<string, unknown>;
}

export async function sendEmail(params: SendEmailParams): Promise<EmailSendResult> {
  try {
    const apiKey = process.env.VLY_INTEGRATION_KEY;
    if (!apiKey) {
      console.log("[DIAG] VLY_INTEGRATION_KEY exists: false");
      return {
        success: false,
        error:
          "VLY_INTEGRATION_KEY is not configured. Please add it in Convex Settings → Environment Variables.",
      };
    }

    console.log("[DIAG] VLY_INTEGRATION_KEY exists: true, length: " + String(apiKey.length));
    console.log("[DIAG] Recipient domain: " + String(params.to.split("@")[1] ?? "unknown"));
    console.log("[DIAG] Sender: " + String(params.from ?? "(VLY default)"));

    const vly = createVlyIntegrations({
      deploymentToken: apiKey,
      debug: process.env.NODE_ENV === "development",
    });

    const sendOptions: {
      to: string;
      subject: string;
      html: string;
      text: string;
      from?: string;
    } = {
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    };
    if (params.from) {
      sendOptions.from = params.from;
    }

    const result = await vly.email.send(sendOptions);

    // Log every field of the result as explicit strings
    console.log("[DIAG] SDK success: " + String(result.success));
    console.log("[DIAG] SDK error: " + String(result.error ?? "(none)"));
    console.log("[DIAG] SDK id: " + String(result.data?.id ?? "(none)"));
    console.log("[DIAG] SDK data: " + JSON.stringify(result.data ?? null));
    console.log("[DIAG] SDK full result keys: " + JSON.stringify(Object.keys(result)));
    console.log("[DIAG] Result: " + (result.success ? "SUCCESS" : "FAILED"));

    if (result.success) {
      return {
        success: true,
        id: result.data?.id,
        raw: result.data as Record<string, unknown> | undefined,
      };
    }

    return {
      success: false,
      error: result.error || "Unknown VLY email error",
      raw: result as unknown as Record<string, unknown>,
    };
  } catch (err) {
    console.log("[DIAG] SDK exception: " + String(err instanceof Error ? err.message : err));
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
