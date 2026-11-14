// Crée un bon cadeau "en attente" puis une session de paiement Stripe Checkout
import { json, sb, SITE_URL, MONTANT_MIN, MONTANT_MAX, formatEuros } from "../lib/gift.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v, max) => String(v ?? "").trim().slice(0, max);

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Méthode non autorisée" });

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!STRIPE_SECRET_KEY) return json(500, { error: "Paiement en ligne non configuré." });

  let input;
  try { input = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Requête invalide" }); }

  // Pot de miel anti-robots
  if (input.website) return json(400, { error: "Requête invalide" });

  const montant = Number(input.montant);
  const acheteur_nom = clean(input.acheteur_nom, 80);
  const acheteur_email = clean(input.acheteur_email, 120).toLowerCase();
  const beneficiaire_nom = clean(input.beneficiaire_nom, 80) || null;
  const beneficiaire_email = clean(input.beneficiaire_email, 120).toLowerCase() || null;
  const message = clean(input.message, 300) || null;
  const envoyer_au_beneficiaire = !!input.envoyer_au_beneficiaire;

  if (!Number.isInteger(montant) || montant < MONTANT_MIN || montant > MONTANT_MAX) {
    return json(400, { error: `Le montant doit être un nombre entier entre ${MONTANT_MIN} € et ${MONTANT_MAX} €.` });
  }
  if (!acheteur_nom) return json(400, { error: "Indiquez votre nom." });
  if (!EMAIL_RE.test(acheteur_email)) return json(400, { error: "Votre adresse email est invalide." });
  if (envoyer_au_beneficiaire && (!beneficiaire_email || !EMAIL_RE.test(beneficiaire_email))) {
    return json(400, { error: "L'adresse email du bénéficiaire est invalide." });
  }

  let etape = "base";
  try {
    const [bon] = await sb("bons_cadeaux", {
      method: "POST",
      prefer: "return=representation",
      body: {
        montant_cents: montant * 100,
        solde_cents: montant * 100,
        acheteur_nom, acheteur_email,
        beneficiaire_nom,
        beneficiaire_email: envoyer_au_beneficiaire ? beneficiaire_email : null,
        message, envoyer_au_beneficiaire,
      },
    });

    const params = new URLSearchParams({
      mode: "payment",
      locale: "fr",
      customer_email: acheteur_email,
      client_reference_id: bon.id,
      "metadata[bon_id]": bon.id,
      "payment_intent_data[metadata][bon_id]": bon.id,
      "payment_intent_data[description]": `Bon cadeau La Régence ${formatEuros(bon.montant_cents)}`,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][unit_amount]": String(bon.montant_cents),
      "line_items[0][price_data][product_data][name]": `Bon cadeau La Régence — ${formatEuros(bon.montant_cents)}`,
      "line_items[0][price_data][product_data][description]":
        beneficiaire_nom ? `Pour ${beneficiaire_nom} · valable 12 mois` : "Valable 12 mois",
      success_url: `${SITE_URL}/bon-cadeau/merci/`,
      cancel_url: `${SITE_URL}/bon-cadeau/?annule=1`,
    });

    etape = "stripe";
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });
    const session = await res.json();
    if (!res.ok) throw new Error(session?.error?.message || "Erreur Stripe");

    etape = "base-session";
    await sb(`bons_cadeaux?id=eq.${bon.id}`, {
      method: "PATCH",
      body: { stripe_session_id: session.id },
    });

    return json(200, { url: session.url });
  } catch (error) {
    console.error(`create-gift-checkout (${etape}) :`, error);
    return json(500, {
      error: "Le paiement n'a pas pu être lancé. Réessayez ou appelez-nous au 05 58 85 92 72.",
      // Diagnostic : étape en échec + message Stripe (jamais de clé ni de donnée client)
      etape,
      detail: etape === "stripe" ? String(error.message).replace(/sk_(live|test)_\w+/g, "sk_***") : undefined,
    });
  }
}
