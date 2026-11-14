// Actions admin sur un bon cadeau : télécharger le PDF ou renvoyer l'email.
// Réservé aux admins connectés (jeton Supabase vérifié).
import { json, sb, getAdminUser, buildVoucherPdf, sendVoucherEmails, sendUsageEmail } from "../lib/gift.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Méthode non autorisée" });

  const user = await getAdminUser(event.headers.authorization || event.headers.Authorization);
  if (!user) return json(401, { error: "Non autorisé" });

  let input;
  try { input = JSON.parse(event.body || "{}"); }
  catch { return json(400, { error: "Requête invalide" }); }

  const { id, action } = input;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return json(400, { error: "Bon invalide" });

  try {
    const [bon] = await sb(`bons_cadeaux?id=eq.${id}&select=*`);
    if (!bon) return json(404, { error: "Bon introuvable" });
    if (!bon.code) return json(400, { error: "Ce bon n'a pas encore été payé." });

    if (action === "pdf") {
      const bytes = await buildVoucherPdf(bon);
      return json(200, { filename: `bon-cadeau-${bon.code}.pdf`, base64: Buffer.from(bytes).toString("base64") });
    }

    if (action === "resend") {
      await sendVoucherEmails(bon, { notifyAdmin: false });
      return json(200, { ok: true });
    }

    if (action === "usage_email") {
      const uid = input.utilisation_id;
      if (!uid || !/^[0-9a-f-]{36}$/i.test(uid)) return json(400, { error: "Utilisation invalide" });
      const [usage] = await sb(`bons_cadeaux_utilisations?id=eq.${uid}&bon_id=eq.${bon.id}&select=*`);
      if (!usage) return json(404, { error: "Utilisation introuvable" });
      await sendUsageEmail(bon, usage);
      return json(200, { ok: true });
    }

    return json(400, { error: "Action inconnue" });
  } catch (error) {
    console.error("admin-gift-voucher :", error);
    return json(500, { error: error.message || "Erreur serveur" });
  }
}
