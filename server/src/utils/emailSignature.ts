/**
 * Table-based HTML email signature (inline CSS) for broad client support.
 *
 * Transitional layout (2026): neutral personal signature only — former employer
 * blocks live in `buildLegacyCompanyEmailSignatureHtml` and are restored by
 * setting `SHOW_LEGACY_COMPANY_BRANDING` to `true` once new company details exist.
 *
 * Application CTA (tracked link in body + optional button image here) is gated by
 * `APPLICATION_LINK_ENABLED=true` in config (see `config.applicationLinkEnabled`).
 */

import { config } from "../config.js";

function trimOrEmpty(v: string | undefined): string {
  return (v ?? "").trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function isSafeHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

const DEFAULT_NAME = "Kari Pastrana";
const DEFAULT_TITLE = "Loan Officer";
const DEFAULT_NMLS = "2745146";

/** Set `true` after new employer branding is wired in env (`COMPANY_*`, disclaimer, optional apply assets). */
const SHOW_LEGACY_COMPANY_BRANDING = false;

// --- Legacy employer defaults (retained for `buildLegacyCompanyEmailSignatureHtml` only; not shown when branding is off) ---
const LEGACY_DEFAULT_COMPANY = "Novus Home Mortgage";
const LEGACY_DEFAULT_ADDRESS = "20225 Water Tower Blvd, Suite 400, Brookfield, WI 53045";
const LEGACY_DEFAULT_COMPANY_WEBSITE = "https://novushomemortgage.com";
const LEGACY_DISCLAIMER =
  "Novus Home Mortgage is a division of Ixonia Bank, NMLS 423065. Member FDIC. Equal Housing Lender.";

/**
 * Neutral signature: loan officer identity + personal NMLS only (no former employer text, links, or address).
 */
function buildNeutralEmailSignatureHtml(): string {
  const nameRaw = trimOrEmpty(process.env.LOAN_OFFICER_NAME);
  const titleRaw = trimOrEmpty(process.env.LOAN_OFFICER_TITLE);
  const nmlsRaw = trimOrEmpty(process.env.LOAN_OFFICER_NMLS);
  const emailRaw = trimOrEmpty(process.env.LOAN_OFFICER_EMAIL);
  const phoneRaw = trimOrEmpty(process.env.LOAN_OFFICER_PHONE);

  const name = nameRaw || DEFAULT_NAME;
  const title = titleRaw || DEFAULT_TITLE;
  const nmls = nmlsRaw || DEFAULT_NMLS;

  const imageUrl = trimOrEmpty(process.env.SIGNATURE_IMAGE_URL);
  const hasHeadshot = imageUrl.length > 0 && isSafeHttpUrl(imageUrl);

  const headshotCell = hasHeadshot
    ? `<td valign="top" style="padding:0 16px 0 0;width:88px;">
  <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" width="80" height="80" style="display:block;width:80px;height:80px;max-width:80px;border-radius:50%;object-fit:cover;border:1px solid #e2ebe5;" />
</td>`
    : "";

  const emailLine = emailRaw
    ? `<tr><td style="padding:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;">
  <a href="mailto:${escapeHtml(emailRaw)}" style="color:#2d5c47;text-decoration:none;">${escapeHtml(emailRaw)}</a>
</td></tr>`
    : "";

  const phoneLine = phoneRaw
    ? `<tr><td style="padding:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;">
  ${escapeHtml(phoneRaw)}
</td></tr>`
    : "";

  return `
<br /><br />
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:8px;max-width:520px;border-top:1px solid #e2ebe5;padding-top:16px;">
  <tr>
    ${headshotCell}<td valign="top" style="padding:0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:0 0 2px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1f1c;font-weight:bold;">
            ${escapeHtml(name)}
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 2px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">
            ${escapeHtml(title)}
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">
            NMLS #${escapeHtml(nmls)}
          </td>
        </tr>
        ${phoneLine}
        ${emailLine}
        <tr>
          <td style="padding:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6a7a72;line-height:1.45;font-style:italic;">
            Updated company information coming soon.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`.trim();
}

/**
 * Former full signature: company block, Equal Housing / bank disclaimer, optional “Apply Now” image button
 * (only if `config.applicationLinkEnabled` and `SIGNATURE_BUTTON_IMAGE_URL` are set).
 * Kept intact for quick restoration alongside `SHOW_LEGACY_COMPANY_BRANDING`.
 */
function buildLegacyCompanyEmailSignatureHtml(): string {
  const nameRaw = trimOrEmpty(process.env.LOAN_OFFICER_NAME);
  const emailRaw = trimOrEmpty(process.env.LOAN_OFFICER_EMAIL);
  const phoneRaw = trimOrEmpty(process.env.LOAN_OFFICER_PHONE);

  const name = nameRaw || DEFAULT_NAME;

  const imageUrl = trimOrEmpty(process.env.SIGNATURE_IMAGE_URL);
  const buttonImageUrl = trimOrEmpty(process.env.SIGNATURE_BUTTON_IMAGE_URL);
  const companyWeb = trimOrEmpty(process.env.COMPANY_WEBSITE) || LEGACY_DEFAULT_COMPANY_WEBSITE;
  const address = trimOrEmpty(process.env.COMPANY_ADDRESS) || LEGACY_DEFAULT_ADDRESS;

  const hasHeadshot = imageUrl.length > 0 && isSafeHttpUrl(imageUrl);
  const hasButtonAsset = buttonImageUrl.length > 0 && isSafeHttpUrl(buttonImageUrl);
  const showApplyButton = config.applicationLinkEnabled && hasButtonAsset;
  const buttonHref = isSafeHttpUrl(companyWeb) ? companyWeb : LEGACY_DEFAULT_COMPANY_WEBSITE;

  const headshotCell = hasHeadshot
    ? `<td valign="top" style="padding:0 16px 0 0;width:88px;">
  <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" width="80" height="80" style="display:block;width:80px;height:80px;max-width:80px;border-radius:50%;object-fit:cover;border:1px solid #e2ebe5;" />
</td>`
    : "";

  const emailLine = emailRaw
    ? `<tr><td style="padding:0 0 4px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;">
  <a href="mailto:${escapeHtml(emailRaw)}" style="color:#2d5c47;text-decoration:none;">${escapeHtml(emailRaw)}</a>
</td></tr>`
    : "";

  const phoneLine = phoneRaw
    ? `<tr><td style="padding:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#333333;">
  M: ${escapeHtml(phoneRaw)}
</td></tr>`
    : "";

  const companyLine = `<tr><td style="padding:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;font-weight:600;">
  ${escapeHtml(LEGACY_DEFAULT_COMPANY)}
</td></tr>`;

  const buttonRow = showApplyButton
    ? `<tr><td style="padding:12px 0 0 0;">
  <a href="${escapeHtml(buttonHref)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
    <img src="${escapeHtml(buttonImageUrl)}" alt="Apply Now" width="200" style="display:block;max-width:200px;height:auto;border:0;outline:none;" />
  </a>
</td></tr>`
    : "";

  const nmlsRaw = trimOrEmpty(process.env.LOAN_OFFICER_NMLS);
  const nmls = nmlsRaw || DEFAULT_NMLS;

  return `
<br /><br />
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:8px;max-width:520px;border-top:1px solid #e2ebe5;padding-top:16px;">
  <tr>
    ${headshotCell}<td valign="top" style="padding:0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
        <tr>
          <td style="padding:0 0 2px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1a1f1c;font-weight:bold;">
            ${escapeHtml(name)}
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 2px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">
            ${escapeHtml(DEFAULT_TITLE)}
          </td>
        </tr>
        <tr>
          <td style="padding:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#555555;">
            NMLS #${escapeHtml(nmls)}
          </td>
        </tr>
        ${phoneLine}
        ${emailLine}
        ${buttonRow}
        ${companyLine}
      </table>
    </td>
  </tr>
</table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:14px;max-width:520px;">
  <tr>
    <td style="padding:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#666666;line-height:1.5;">
      ${escapeHtml(address)}
    </td>
  </tr>
  <tr>
    <td style="padding:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#888888;line-height:1.45;">
      ${escapeHtml(LEGACY_DISCLAIMER)}
    </td>
  </tr>
</table>
`.trim();
}

/**
 * Appends after message body. Uses only inline styles; table layout for clients.
 */
export function buildEmailSignatureHtml(): string {
  if (SHOW_LEGACY_COMPANY_BRANDING) {
    return buildLegacyCompanyEmailSignatureHtml();
  }
  return buildNeutralEmailSignatureHtml();
}
