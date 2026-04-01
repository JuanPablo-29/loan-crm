import { Resend } from "resend";
import { config } from "../config.js";
import { buildEmailSignatureHtml } from "../utils/emailSignature.js";

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
};

let resendClient: Resend | null = null;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  if (!resendClient) {
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  try {
    const resend = getResendClient();
    const htmlWithSignature = `${input.html}${buildEmailSignatureHtml()}`;
    const result = await resend.emails.send({
      from: config.emailFrom,
      to: input.to,
      subject: input.subject,
      html: htmlWithSignature,
    });
    if (result.error) {
      throw new Error(`Resend API error: ${result.error.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown email send error";
    console.error("[email] Send failed", { to: input.to, subject: input.subject, message });
    throw new Error(`Email delivery failed: ${message}`);
  }
}
