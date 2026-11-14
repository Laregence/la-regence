// Reçoit les notifications de Stripe : quand un bon est payé,
// on lui attribue un code, puis on envoie le PDF par email.
import crypto from "node:crypto";
import { json, sb, generateCode, expiryDate, sendVoucherEmails } from "../lib/gift.js";

function verifyStripeSignature(payload, header, secret, toleranceSec = 300) {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=")).map(([k, ...v]) => [k, v.join("=")])
  );
  const signatures = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  const t = Number(parts.t);
  if (!t || !signatures.length) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${t}.${payload}`, "utf8").digest("hex");
  return signatures.some((sig) => {
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Méthode non autorisée" });

  const payload = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : event.body || "";
  const signature = event.headers["stripe-signature"] || event.headers["Stripe-Signature"];

  if (!verifyStripeSignature(payload, signature, process.env.STRIPE_WEBHOOK_SECRET)) {
    console.warn("stripe-webhook : signature invalide");
    return json(400, { error: "Signature invalide" });
  }

  const stripeEvent = JSON.parse(payload);
  const handled = ["checkout.session.completed", "checkout.session.async_payment_succeeded"];
  if (!handled.includes(stripeEvent.type)) return json(200, { ignored: stripeEvent.type });

  const session = stripeEvent.data.object;
  if (session.payment_status !== "paid") return json(200, { pending: true });

  const bonId = session.metadata?.bon_id || session.client_reference_id;
  if (!bonId) return json(200, { ignored: "pas de bon_id" });

  let bon;
  try {
    // Ne traite le bon qu'une seule fois (Stripe peut renvoyer le même événement)
    for (let attempt = 0; attempt < 3 && !bon; attempt++) {
      try {
        const rows = await sb(`bons_cadeaux?id=eq.${bonId}&statut=eq.en_attente`, {
          method: "PATCH",
          prefer: "return=representation",
          body: {
            statut: "paye",
            code: generateCode(),
            paye_le: new Date().toISOString(),
            expire_le: expiryDate(),
            stripe_payment_intent: session.payment_intent || null,
          },
        });
        if (!rows?.length) return json(200, { already: true });
        bon = rows[0];
      } catch (e) {
        // Code déjà pris (très improbable) : on réessaie avec un autre
        if (!String(e.message).includes("duplicate")) throw e;
      }
    }
    if (!bon) throw new Error("Impossible de générer un code unique");
  } catch (error) {
    console.error("stripe-webhook (base) :", error);
    return json(500, { error: "Erreur base de données" }); // Stripe réessaiera
  }

  try {
    await sendVoucherEmails(bon);
  } catch (error) {
    // Le bon est bien payé et enregistré : on ne fait pas échouer le webhook.
    // L'email pourra être renvoyé depuis /admin/bons-cadeaux.
    console.error("stripe-webhook (email) :", error);
  }

  return json(200, { ok: true, code: bon.code });
}
