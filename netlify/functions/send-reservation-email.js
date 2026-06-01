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
        htmlContent: `
          <p>Bonjour ${reservation.prenom || reservation.nom || ""},</p>
          <p>Votre réservation à La Régence est confirmée.</p>
          <p><strong>Date :</strong> ${date}</p>
          <p><strong>Heure :</strong> ${heure}</p>
          <p><strong>Nombre de personnes :</strong> ${reservation.nb_personnes}</p>
          <p>À bientôt,<br>L’équipe de La Régence</p>
        `,
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
        htmlContent: `
          <p>Bonjour ${reservation.prenom || reservation.nom || ""},</p>
          <p>Nous sommes désolés, nous ne pouvons pas accepter votre réservation.</p>
          <p><strong>Date :</strong> ${date}</p>
          <p><strong>Heure :</strong> ${heure}</p>
          ${
            reservation.motif_refus
              ? `<p><strong>Motif :</strong> ${reservation.motif_refus}</p>`
              : ""
          }
          <p>Vous pouvez nous contacter au 05 58 85 92 72.</p>
          <p>L’équipe de La Régence</p>
        `,
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
        htmlContent: `
          <p>Bonjour ${reservation.prenom || reservation.nom || ""},</p>
          <p>Nous ne pouvons pas accepter votre réservation exactement dans les conditions demandées.</p>
          <p><strong>Votre demande initiale :</strong> ${date} à ${heure}, ${reservation.nb_personnes} personne(s)</p>
          <p><strong>Notre proposition :</strong> ${reservation.proposition_deplacement || "-"}</p>
          <p>Merci de nous répondre à ce mail ou de nous appeler au 05 58 85 92 72.</p>
          <p>L’équipe de La Régence</p>
        `,
      },
    ];
  }

  return [];
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