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

    if (!supabaseUrl || !supabaseSecretKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Configuration Supabase manquante" }),
      };
    }

    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const response = await fetch(
      `${supabaseUrl}/rest/v1/reservations?select=*&a_traiter=eq.true&rappel_push_envoye=eq.false&created_at=lt.${cutoff}`,
      {
        headers: {
          apikey: supabaseSecretKey,
          Authorization: `Bearer ${supabaseSecretKey}`,
        },
      }
    );

    const reservations = await response.json();

    if (!response.ok) {
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
      const heure = String(reservation.heure || "")
        .slice(0, 5)
        .replace(":", "h");

      const dateLabel = formatDateFr(reservation.date_service);
      const nom = `${reservation.nom || ""} ${reservation.prenom || ""}`.trim();

      const pushResponse = await fetch(
        `${getSiteUrl(event)}/.netlify/functions/send-push-notification`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: "Réservation toujours à traiter",
            body: `${nom || "Client"} — ${reservation.nb_personnes} pers. — ${dateLabel} ${heure}`,
            url: "/admin/reservations",
          }),
        }
      );

      const pushResult = await pushResponse.text();

      if (!pushResponse.ok) {
        results.push({
          id: reservation.id,
          success: false,
          error: pushResult,
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
            rappel_push_envoye: true,
          }),
        }
      );

      results.push({
        id: reservation.id,
        success: updateResponse.ok,
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        found: reservations.length,
        reminded: results.filter((r) => r.success).length,
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

function formatDateFr(dateStr) {
  if (!dateStr) return "";

  const date = new Date(dateStr + "T00:00:00");

  return date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getSiteUrl(event) {
  const host = event.headers.host || "laregencemdm.fr";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}