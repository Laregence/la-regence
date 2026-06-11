const GOOGLE_REVIEW_URL = "https://g.page/r/CWV5SKi0bwPoEBM/review";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Méthode non autorisée" }),
    };
  }

  try {
    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;
    const brevoApiKey = process.env.BREVO_API_KEY;

    if (!supabaseUrl || !supabaseSecretKey || !brevoApiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          error: "Configuration manquante",
        }),
      };
    }

    const targetDate = getYesterdayFranceDate();

    const reservationsResponse = await fetch(
      `${supabaseUrl}/rest/v1/reservations?select=*&statut=eq.acceptee&avis_envoye=eq.false&date_service=eq.${targetDate}&email=not.is.null`,
      {
        headers: {
          apikey: supabaseSecretKey,
          Authorization: `Bearer ${supabaseSecretKey}`,
        },
      }
    );

    const reservations = await reservationsResponse.json();

    if (!reservationsResponse.ok) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Erreur récupération réservations",
          details: reservations,
        }),
      };
    }

    const results = [];

    for (const reservation of reservations) {
      if (!reservation.email) continue;

      const nomClient = `${reservation.prenom || ""} ${reservation.nom || ""}`.trim();
      const prenomOuNom = reservation.prenom || reservation.nom || "";

      const emailPayload = {
        sender: {
          name: "La Régence",
          email: "laregence.mdm@gmail.com",
        },
        to: [
          {
            email: reservation.email,
            name: nomClient || reservation.email,
          },
        ],
        subject: "Merci de votre visite à La Régence",
        htmlContent: buildReviewEmail({
          prenomOuNom,
          googleReviewUrl: GOOGLE_REVIEW_URL,
        }),
      };

      const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      });

      const brevoResult = await brevoResponse.text();

      if (!brevoResponse.ok) {
        results.push({
          id: reservation.id,
          email: reservation.email,
          success: false,
          error: brevoResult,
        });
        continue;
      }

      const updateResponse = await fetch(
        `${supabaseUrl}/rest/v1/reservations?id=eq.${reservation.id}`,
        {
          method: "PATCH",
          headers: {
            apikey: supabaseSecretKey,
            Authorization: `Bearer ${supabaseSecretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            avis_envoye: true,
          }),
        }
      );

      results.push({
        id: reservation.id,
        email: reservation.email,
        success: updateResponse.ok,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        date: targetDate,
        found: reservations.length,
        sent: results.filter((r) => r.success).length,
        results,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "Erreur serveur",
      }),
    };
  }
}

function getYesterdayFranceDate() {
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const partsNow = formatter.formatToParts(now);
  const mapNow = Object.fromEntries(partsNow.map((p) => [p.type, p.value]));

  const parisDate = new Date(
    `${mapNow.year}-${mapNow.month}-${mapNow.day}T12:00:00`
  );

  parisDate.setDate(parisDate.getDate() - 1);

  const y = parisDate.getFullYear();
  const m = String(parisDate.getMonth() + 1).padStart(2, "0");
  const d = String(parisDate.getDate()).padStart(2, "0");

  return `${y}-${m}-${d}`;
}

function buildReviewEmail({ prenomOuNom, googleReviewUrl }) {
  const bonjour = prenomOuNom ? `Bonjour ${prenomOuNom},` : "Bonjour,";

  return `
  <div style="margin:0;padding:0;background:#f5efe6;font-family:Arial,sans-serif;color:#1f2937;">
    <div style="max-width:620px;margin:0 auto;padding:28px 16px;">
      <div style="background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:#25471f;padding:28px;text-align:center;color:#ffffff;">
          <h1 style="margin:0;font-size:30px;letter-spacing:1px;">La Régence</h1>
          <p style="margin:8px 0 0;font-size:15px;">Merci de votre visite</p>
        </div>

        <div style="padding:30px;">
          <p style="font-size:17px;margin-top:0;">${bonjour}</p>

          <p style="font-size:16px;line-height:1.6;">
            Merci d’avoir choisi <strong>La Régence</strong>. Nous espérons que vous avez passé un agréable moment parmi nous.
          </p>

          <p style="font-size:16px;line-height:1.6;">
            Si vous avez apprécié votre expérience, quelques secondes suffisent pour nous laisser un avis Google.
            Votre retour nous aide énormément.
          </p>

          <div style="text-align:center;margin:30px 0;">
            <a href="${googleReviewUrl}"
              style="display:inline-block;background:#25471f;color:#ffffff;text-decoration:none;padding:15px 24px;border-radius:12px;font-weight:bold;font-size:16px;">
              Donner mon avis
            </a>
          </div>

          <p style="font-size:16px;line-height:1.6;">
            Au plaisir de vous accueillir à nouveau.
          </p>

          <p style="font-size:16px;line-height:1.6;margin-bottom:0;">
            L’équipe de La Régence<br/>
            05 58 85 92 72
          </p>
        </div>
      </div>
    </div>
  </div>
  `;
}