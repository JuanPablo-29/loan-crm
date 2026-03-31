import nodemailer from "nodemailer";
import { config } from "../config.js";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (config.smtp.disabled) return null;
  if (!config.smtp.host || !config.smtp.user) return null;
  if (!transporter) {
    const secure = config.smtp.secure ?? config.smtp.port === 465;
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure,
      requireTLS: config.smtp.requireTls,
      ...(config.smtp.forceIpv4 ? { family: 4 as const } : {}),
      connectionTimeout: config.smtp.connectionTimeoutMs,
      greetingTimeout: config.smtp.greetingTimeoutMs,
      socketTimeout: config.smtp.socketTimeoutMs,
      auth: { user: config.smtp.user, pass: config.smtp.pass },
    });
  }
  return transporter;
}

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendMail(input: SendMailInput): Promise<{ ok: boolean; reason?: string }> {
  const t = getTransporter();
  if (!t) {
    console.warn("[mail] SMTP not configured — logging only:", input.subject);
    return { ok: true, reason: "no_smtp_logged" };
  }

  try {
    await t.sendMail({
      from: config.smtp.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
    return { ok: true };
  } catch (err) {
    const e = err as { code?: string; message?: string };
    console.error("[mail] SMTP send failed", {
      code: e.code ?? "UNKNOWN",
      message: e.message ?? "Unknown error",
      host: config.smtp.host,
      port: config.smtp.port,
    });
    return { ok: false, reason: `smtp_${(e.code ?? "error").toLowerCase()}` };
  }
}
