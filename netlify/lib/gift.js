// Outils partagés pour les bons cadeaux (fonctions Netlify)
import crypto from "node:crypto";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const SITE_URL = (process.env.URL || "https://laregencemdm.fr").replace(/\/$/, "");
export const VALIDITE_MOIS = 12;
export const MONTANT_MIN = 10;   // €
export const MONTANT_MAX = 500;  // €

export function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  };
}

// ---------- Supabase (clé secrète, côté serveur uniquement) ----------
function sbConfig() {
  const url = process.env.PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Configuration Supabase serveur manquante");
  return { url, key };
}

export async function sb(path, { method = "GET", body, prefer } = {}) {
  const { url, key } = sbConfig();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`Supabase ${res.status} : ${data?.message || text}`);
  return data;
}

// Vérifie qu'un jeton appartient bien à un admin connecté
export async function getAdminUser(authHeader) {
  const token = (authHeader || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { url, key } = sbConfig();
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// ---------- Code & dates ----------
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O/1/I
export function generateCode() {
  const pick = () => ALPHABET[crypto.randomInt(ALPHABET.length)];
  const block = () => Array.from({ length: 4 }, pick).join("");
  return `REG-${block()}-${block()}`;
}

export function expiryDate(from = new Date()) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + VALIDITE_MOIS);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d); // YYYY-MM-DD
}

export function formatDateFR(dateStr) {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric",
  });
}

export function formatEuros(cents) {
  const v = cents / 100;
  return (Number.isInteger(v) ? v.toString() : v.toFixed(2).replace(".", ",")) + " €";
}

export function escapeHtml(s = "") {
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// ---------- PDF ----------
// Les polices standard PDF ne gèrent que l'encodage WinAnsi : on retire le reste (emojis…)
const WINANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function pdfSafe(s = "") {
  return String(s)
    .replace(/[\r\t]/g, " ")
    .split("")
    .filter((c) => c === "\n" || (c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) <= 0xff) || WINANSI_EXTRA.includes(c))
    .join("");
}

function wrap(text, font, size, maxWidth) {
  const lines = [];
  for (const para of pdfSafe(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) <= maxWidth) line = test;
      else { if (line) lines.push(line); line = word; }
    }
    lines.push(line);
  }
  return lines;
}

let logoCache = null;
async function getLogo() {
  if (logoCache) return logoCache;
  try {
    const res = await fetch(`${SITE_URL}/logo.png`);
    if (res.ok) logoCache = new Uint8Array(await res.arrayBuffer());
  } catch {}
  return logoCache;
}

export async function buildVoucherPdf(bon) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Bon cadeau La Régence ${bon.code}`);
  pdf.setAuthor("La Régence");

  const W = 595.28, H = 419.53; // A5 paysage
  const page = pdf.addPage([W, H]);

  const green = rgb(0x25 / 255, 0x47 / 255, 0x1f / 255);
  const copper = rgb(0xa3 / 255, 0x74 / 255, 0x2c / 255);
  const beige = rgb(0xf5 / 255, 0xef / 255, 0xe6 / 255);

  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const serifItalic = await pdf.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await pdf.embedFont(StandardFonts.Helvetica);
  const sansBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Fond + cadre
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: green });
  page.drawRectangle({ x: 16, y: 16, width: W - 32, height: H - 32, borderColor: copper, borderWidth: 2 });
  page.drawRectangle({ x: 22, y: 22, width: W - 44, height: H - 44, borderColor: copper, borderWidth: 0.6 });

  const center = (text, y, font, size, color = beige) => {
    const t = pdfSafe(text);
    page.drawText(t, { x: (W - font.widthOfTextAtSize(t, size)) / 2, y, size, font, color });
  };

  // Logo
  let y = H - 50;
  const logoBytes = await getLogo();
  if (logoBytes) {
    try {
      const logo = await pdf.embedPng(logoBytes);
      const s = 62 / logo.height;
      page.drawImage(logo, { x: (W - logo.width * s) / 2, y: y - 58, width: logo.width * s, height: 62 });
      y -= 72;
    } catch { y -= 10; }
  }

  center("LA RÉGENCE", y - 6, serifBold, 15, copper);
  y -= 40;
  center("BON CADEAU", y, serifBold, 34);
  y -= 12;
  page.drawLine({ start: { x: W / 2 - 90, y }, end: { x: W / 2 + 90, y }, thickness: 1.5, color: copper });
  y -= 42;
  center(formatEuros(bon.montant_cents), y, serifBold, 40, copper);
  y -= 30;

  if (bon.beneficiaire_nom) { center(`Offert à ${bon.beneficiaire_nom}`, y, serif, 15); y -= 19; }
  center(`De la part de ${bon.acheteur_nom}`, y, serifItalic, 12.5);
  y -= 20;

  if (bon.message) {
    const lines = wrap(`« ${bon.message} »`, serifItalic, 11, W - 160).slice(0, 3);
    for (const l of lines) { center(l, y, serifItalic, 11); y -= 14; }
  }

  // Bas : code + validité + adresse
  const boxW = 230, boxH = 26, boxY = 70;
  page.drawRectangle({ x: (W - boxW) / 2, y: boxY, width: boxW, height: boxH, color: beige });
  const codeTxt = `CODE : ${bon.code}`;
  page.drawText(codeTxt, {
    x: (W - sansBold.widthOfTextAtSize(codeTxt, 13)) / 2, y: boxY + 8, size: 13, font: sansBold, color: green,
  });

  center(`Valable jusqu'au ${formatDateFR(bon.expire_le)} · À présenter lors de votre venue`, 52, sans, 7.5);
  center("La Régence · 2 rue Léon Gambetta, 40000 Mont-de-Marsan · 05 58 85 92 72 · laregencemdm.fr", 40, sans, 7.5, copper);

  return pdf.save();
}

// ---------- Emails (Brevo) ----------
async function brevoSend(payload) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new Error("Clé Brevo manquante");
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status} : ${await res.text()}`);
}

const SENDER = { name: "La Régence", email: "laregence.mdm@gmail.com" };

function emailLayout(inner) {
  return `
  <div style="background:#F5EFE6;padding:24px;font-family:Georgia,serif;color:#0F172A">
    <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5dccd">
      <div style="background:#25471f;color:#F5EFE6;text-align:center;padding:22px;border-bottom:3px solid #a3742c">
        <div style="font-size:26px;letter-spacing:3px">LA RÉGENCE</div>
        <div style="font-size:13px;opacity:.85">Restaurant &amp; Brasserie · Mont-de-Marsan</div>
      </div>
      <div style="padding:26px;line-height:1.6;font-size:15px">${inner}</div>
      <div style="background:#F5EFE6;text-align:center;font-size:12px;color:#555;padding:14px">
        2 rue Léon Gambetta, 40000 Mont-de-Marsan · 05 58 85 92 72 ·
        <a href="https://laregencemdm.fr" style="color:#25471f">laregencemdm.fr</a>
      </div>
    </div>
  </div>`;
}

export async function sendVoucherEmails(bon, { notifyAdmin = true, onlyTo } = {}) {
  const pdfBytes = await buildVoucherPdf(bon);
  const attachment = [{ name: `bon-cadeau-la-regence-${bon.code}.pdf`, content: Buffer.from(pdfBytes).toString("base64") }];
  const montant = formatEuros(bon.montant_cents);
  const expire = formatDateFR(bon.expire_le);
  const e = escapeHtml;

  const sends = [];

  // Acheteur
  if (!onlyTo || onlyTo === "acheteur") {
    const pourQui = bon.envoyer_au_beneficiaire && bon.beneficiaire_email
      ? `<p>Nous l'avons également envoyé directement à <strong>${e(bon.beneficiaire_nom || bon.beneficiaire_email)}</strong>.</p>`
      : `<p>Vous pouvez l'imprimer ou le transférer à la personne de votre choix.</p>`;
    sends.push(brevoSend({
      sender: SENDER,
      to: [{ email: bon.acheteur_email, name: bon.acheteur_nom }],
      subject: `Votre bon cadeau La Régence de ${montant}`,
      htmlContent: emailLayout(`
        <p>Bonjour ${e(bon.acheteur_nom)},</p>
        <p>Merci pour votre achat ! Vous trouverez en pièce jointe votre <strong>bon cadeau de ${montant}</strong>
        ${bon.beneficiaire_nom ? `pour <strong>${e(bon.beneficiaire_nom)}</strong>` : ""}.</p>
        ${pourQui}
        <p style="text-align:center;margin:24px 0">
          <span style="display:inline-block;background:#25471f;color:#F5EFE6;padding:10px 18px;border-radius:10px;font-family:Arial,sans-serif;font-weight:bold;letter-spacing:1px">${e(bon.code)}</span>
        </p>
        <p style="font-size:13px;color:#555">Valable jusqu'au ${expire}, à présenter lors de votre venue (imprimé ou sur téléphone).</p>
        <p>À très bientôt,<br/>L'équipe de La Régence</p>`),
      attachment,
    }));
  }

  // Bénéficiaire
  if (bon.envoyer_au_beneficiaire && bon.beneficiaire_email && (!onlyTo || onlyTo === "beneficiaire")) {
    sends.push(brevoSend({
      sender: SENDER,
      to: [{ email: bon.beneficiaire_email, name: bon.beneficiaire_nom || undefined }],
      subject: `${bon.acheteur_nom} vous offre un bon cadeau à La Régence 🎁`,
      htmlContent: emailLayout(`
        <p>Bonjour${bon.beneficiaire_nom ? " " + e(bon.beneficiaire_nom) : ""},</p>
        <p><strong>${e(bon.acheteur_nom)}</strong> vous offre un <strong>bon cadeau de ${montant}</strong> à La Régence !</p>
        ${bon.message ? `<blockquote style="border-left:3px solid #a3742c;margin:18px 0;padding:6px 14px;font-style:italic;color:#333">${e(bon.message).replace(/\n/g, "<br/>")}</blockquote>` : ""}
        <p>Votre bon est en pièce jointe. Présentez-le simplement lors de votre venue (imprimé ou sur téléphone).</p>
        <p style="text-align:center;margin:24px 0">
          <span style="display:inline-block;background:#25471f;color:#F5EFE6;padding:10px 18px;border-radius:10px;font-family:Arial,sans-serif;font-weight:bold;letter-spacing:1px">${e(bon.code)}</span>
        </p>
        <p style="font-size:13px;color:#555">Valable jusqu'au ${expire}. Réservez votre table sur
        <a href="https://laregencemdm.fr/reservation" style="color:#25471f">laregencemdm.fr/reservation</a> ou au 05 58 85 92 72.</p>
        <p>À très bientôt,<br/>L'équipe de La Régence</p>`),
      attachment,
    }));
  }

  // Notification interne
  if (notifyAdmin) {
    sends.push(brevoSend({
      sender: { name: "La Régence Bons cadeaux", email: SENDER.email },
      to: [{ email: process.env.ADMIN_EMAIL || SENDER.email, name: "La Régence" }],
      subject: `🎁 Nouveau bon cadeau vendu — ${montant} (${bon.code})`,
      htmlContent: `
        <h2>Nouveau bon cadeau vendu</h2>
        <p><strong>Code :</strong> ${e(bon.code)}<br/>
        <strong>Montant :</strong> ${montant}<br/>
        <strong>Acheteur :</strong> ${e(bon.acheteur_nom)} (${e(bon.acheteur_email)})<br/>
        <strong>Bénéficiaire :</strong> ${e(bon.beneficiaire_nom || "-")} ${bon.beneficiaire_email ? `(${e(bon.beneficiaire_email)})` : ""}<br/>
        <strong>Valable jusqu'au :</strong> ${expire}</p>
        <p><a href="https://laregencemdm.fr/admin/bons-cadeaux">Voir les bons cadeaux</a></p>`,
    }));
  }

  const results = await Promise.allSettled(sends);
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) throw new Error(failed.map((f) => f.reason?.message).join(" | "));
}
