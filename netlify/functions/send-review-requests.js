export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Méthode non autorisée" }),
    };
  }

  try {
    const { type, reservation } = JSON.parse(event.body || "{}");

    if (!type || !reservation) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Données manquantes" }),
      };
    }

    const BREVO_API_KEY = process.env.BREVO_API_KEY;
    console.log("BREVO présent :", !!BREVO_API_KEY);
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "laregence.mdm@gmail.com";

    if (!BREVO_API_KEY) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Clé Brevo manquante" }),
      };
    }

    const emails = buildEmail(type, reservation, ADMIN_EMAIL);

    const responses = [];

    for (const email of emails) {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "api-key": BREVO_API_KEY,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(email),
      });

      const result = await response.text();

      responses.push({
        ok: response.ok,
        status: response.status,
        result,
      });

      if (!response.ok) {
        return {
          statusCode: response.status,
          body: JSON.stringify({
            error: "Erreur Brevo",
            details: result,
          }),
        };
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        responses,
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

function buildEmail(type, reservation, adminEmail) {
  const date = formatDate(reservation.date_service);
  const heure = formatHeure(reservation.heure);
  const nomClient = `${reservation.prenom || ""} ${reservation.nom || ""}`.trim();

  if (type === "new_reservation_admin") {
    return [
      {
        sender: {
          name: "La Régence Réservations",
          email: "laregence.mdm@gmail.com",
        },
        to: [
          {
            email: adminEmail,
            name: "La Régence",
          },
        ],
        subject: `Nouvelle demande de réservation — ${date} ${heure}`,
        htmlContent: `
  <h2>Nouvelle demande de réservation</h2>
  <p><strong>Date :</strong> ${date}</p>
  <p><strong>Heure :</strong> ${heure}</p>
  <p><strong>Service :</strong> ${reservation.service || "-"}</p>
  <p><strong>Nombre de personnes :</strong> ${reservation.nb_personnes || "-"}</p>
  <p><strong>Client :</strong> ${nomClient}</p>
  <p><strong>Téléphone :</strong> ${reservation.telephone || "-"}</p>
  <p><strong>Email :</strong> ${reservation.email || "-"}</p>
  <p><strong>Préférence :</strong> ${labelSalle(reservation.preference_salle)}</p>
  ${
    reservation.commentaire_client
      ? `<p><strong>Commentaire :</strong> ${reservation.commentaire_client}</p>`
      : ""
  }

  <div style="margin-top:30px;text-align:center;">
    <a
      href="https://laregencemdm.fr/admin/reservations"
      style="
        display:inline-block;
        background:#25471f;
        color:#ffffff;
        text-decoration:none;
        padding:14px 24px;
        border-radius:10px;
        font-weight:bold;
      "
    >
      Gérer les réservations
    </a>
  </div>
`,
      },
    ];
  }

  if (type === "accepted_client") {
    return [
      {
        sender: {
          name: "La Régence",
          email: "laregence.mdm@gmail.com",
        },
        to: [
          {
            email: reservation.email,
            name: nomClient,
          },
        ],
        subject: "Votre réservation à La Régence est confirmée",
        htmlContent: emailLayout({
  title: "Votre réservation est confirmée",
  content: `
    <p>Bonjour ${reservation.prenom || reservation.nom || ""},</p>

    <p>Votre réservation à <strong>La Régence</strong> est confirmée.</p>

    <p>
      <strong>Date :</strong> ${date}<br/>
      <strong>Heure :</strong> ${heure}<br/>
      <strong>Nombre de personnes :</strong> ${reservation.nb_personnes}
      <br/>
<strong>Préférence :</strong> ${labelSalle(reservation.preference_salle)}
    </p>
    <p style="background:#F5EFE6;padding:12px;border-radius:8px;">
Votre réservation est enregistrée selon les disponibilités de nos espaces.
Toute demande de salle spécifique reste soumise à disponibilité.
</p>

    <p>Nous avons hâte de vous accueillir.</p>

    <p>À bientôt,<br/>L’équipe de La Régence</p>
  `,
}),
      },
    ];
  }

  if (type === "declined_client") {
    return [
      {
        sender: {
          name: "La Régence",
          email: "laregence.mdm@gmail.com",
        },
        to: [
          {
            email: reservation.email,
            name: nomClient,
          },
        ],
        subject: "Votre demande de réservation à La Régence",
        htmlContent: emailLayout({
  title: "Votre demande de réservation",
  content: `
    <p>Bonjour ${reservation.prenom || reservation.nom || ""},</p>

    <p>Nous sommes désolés, nous ne pouvons pas accepter votre réservation.</p>

    <p>
      <strong>Date :</strong> ${date}<br/>
      <strong>Heure :</strong> ${heure}
    </p>

    ${
      reservation.motif_refus
        ? `<p><strong>Motif :</strong> ${reservation.motif_refus}</p>`
        : ""
    }

    <p>Vous pouvez nous contacter au 05 58 85 92 72 pour une autre demande.</p>

    <p>L’équipe de La Régence</p>
  `,
}),
      },
    ];
  }

  if (type === "move_proposal_client") {
    return [
      {
        sender: {
          name: "La Régence",
          email: "laregence.mdm@gmail.com",
        },
        to: [
          {
            email: reservation.email,
            name: nomClient,
          },
        ],
        subject: "Proposition de modification de votre réservation",
        htmlContent: emailLayout({
  title: "Proposition de modification",
  content: `
    <p>Bonjour ${reservation.prenom || reservation.nom || ""},</p>

    <p>Nous ne pouvons pas accepter votre réservation exactement dans les conditions demandées.</p>

    <p>
      <strong>Votre demande initiale :</strong><br/>
      ${date} à ${heure}<br/>
      ${reservation.nb_personnes} personne(s)
    </p>

    <p>
      <strong>Notre proposition :</strong><br/>
      ${reservation.proposition_deplacement || "-"}
    </p>

    <p>Merci de nous répondre à ce mail ou de nous appeler au 05 58 85 92 72.</p>

    <p>L’équipe de La Régence</p>
  `,
}),
      },
    ];
  }

  return [];
}
function emailLayout({ title, content }) {
  return `
    <div style="margin:0;padding:0;background:#F5EFE6;font-family:Arial,sans-serif;color:#0F172A;">
      <div style="max-width:640px;margin:0 auto;padding:24px;">
        
        <div style="background:#25471f;padding:28px 20px;text-align:center;border-radius:18px 18px 0 0;">
          <img 
            src="https://laregencemdm.fr/logo.png" 
            alt="La Régence" 
            style="width:96px;height:auto;margin-bottom:12px;"
          />
          <div style="font-size:26px;letter-spacing:1px;color:#F5EFE6;font-weight:bold;">
            La Régence
          </div>
        </div>

        <div style="background:#ffffff;padding:28px;border-radius:0 0 18px 18px;">
          <h1 style="margin:0 0 20px;color:#25471f;font-size:24px;">
            ${title}
          </h1>

          <div style="font-size:16px;line-height:1.6;">
            ${content}
          </div>

          <div style="margin-top:28px;text-align:center;">
            <a 
              href="tel:+33558859272"
              style="display:inline-block;background:#25471f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:bold;"
            >
              Appeler La Régence
            </a>
          </div>

          <div style="margin-top:28px;padding-top:20px;border-top:1px solid #ead9c2;color:#475569;font-size:14px;line-height:1.5;">
            <strong>La Régence</strong><br/>
            2 rue Léon Gambetta<br/>
            40000 Mont-de-Marsan<br/>
            05 58 85 92 72
          </div>
        </div>

      </div>
    </div>
  `;
}

function formatDate(dateStr) {
  if (!dateStr) return "-";

  const date = new Date(dateStr + "T00:00:00");

  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatHeure(heure) {
  return String(heure || "").slice(0, 5).replace(":", "h");
}

function labelSalle(value) {
  const labels = {
    peu_importe: "Peu importe",
    salle_bas: "Salle du bas",
    etage: "Étage",
    terrasse: "Terrasse",
  };

  return labels[value] || value || "-";
}