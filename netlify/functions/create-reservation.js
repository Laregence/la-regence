export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Méthode non autorisée" }),
    };
  }

  try {
    const reservation = JSON.parse(event.body || "{}");

    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Configuration Supabase serveur manquante" }),
      };
    }

    const dateService = reservation.date_service;
    const service = reservation.service;
const settingsRes = await fetch(
  `${supabaseUrl}/rest/v1/reservation_settings?key=eq.online_booking&select=*`,
  {
    headers: {
      apikey: supabaseSecretKey,
      Authorization: `Bearer ${supabaseSecretKey}`,
    },
  }
);

const settingsData = await settingsRes.json();
const bookingSettings = settingsData?.[0]?.value;

if (bookingSettings?.enabled === false) {
  return {
    statusCode: 400,
    body: JSON.stringify({
      error:
        bookingSettings.message ||
        "La réservation en ligne est actuellement en maintenance. Veuillez nous appeler au 05 58 85 92 72 pour toute réservation. Merci.",
    }),
  };
}

    const exceptionRes = await fetch(
      `${supabaseUrl}/rest/v1/reservation_exceptions?date_service=eq.${dateService}&select=*`,
      {
        headers: {
          apikey: supabaseSecretKey,
          Authorization: `Bearer ${supabaseSecretKey}`,
        },
      }
    );

    const exceptions = await exceptionRes.json();
    const exception = exceptions?.[0];

    const requestedDate = new Date(`${dateService}T00:00:00`);
    const isSunday = requestedDate.getDay() === 0;

    let midiOuvert = !isSunday;
    let soirOuvert = !isSunday;

    if (exception) {
      midiOuvert = exception.midi_ouvert;
      soirOuvert = exception.soir_ouvert;
    }

    if (service === "midi" && !midiOuvert) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: exception?.raison || "Les réservations du midi sont fermées ce jour-là.",
        }),
      };
    }

    if (service === "soir" && !soirOuvert) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: exception?.raison || "Les réservations du soir sont fermées ce jour-là.",
        }),
      };
    }

    if (service === "midi" && isTodayInFrance(dateService) && isAfterMidiCutoffInFrance()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Les réservations pour ce midi sont désormais fermées. Merci de nous appeler au 05 58 85 92 72.",
        }),
      };
    }

    if (service === "soir" && isTodayInFrance(dateService) && isAfterSoirCutoffInFrance()) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Les réservations pour ce soir sont désormais fermées. Merci de nous appeler au 05 58 85 92 72.",
        }),
      };
      if (isTodayInFrance(dateService) && isPastSlotInFrance(reservation.heure)) {
      return {
      statusCode: 400,
      body: JSON.stringify({
        error: "Ce créneau horaire n’est plus disponible. Merci de choisir un horaire plus tardif.",
      }),
  };
}
    }

    const cleanedReservation = {
      date_service: dateService,
      service,
      heure: reservation.heure,
      nb_personnes: Number(reservation.nb_personnes),
      nom: String(reservation.nom || "").trim(),
      prenom: String(reservation.prenom || "").trim(),
      telephone: String(reservation.telephone || "").trim(),
      email: String(reservation.email || "").trim(),
      preference_salle: reservation.preference_salle || "peu_importe",
      commentaire_client: String(reservation.commentaire_client || "").trim(),
      origine: "site",
      statut: "nouvelle",
      a_traiter: true,
    };

    const insertRes = await fetch(`${supabaseUrl}/rest/v1/reservations?select=*`, {
      method: "POST",
      headers: {
        apikey: supabaseSecretKey,
        Authorization: `Bearer ${supabaseSecretKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(cleanedReservation),
    });

    const insertData = await insertRes.json();

    if (!insertRes.ok) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: insertData.message || "Erreur Supabase",
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        reservation: insertData[0],
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

function getFranceParts(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    date: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

function isTodayInFrance(dateService) {
  return getFranceParts().date === dateService;
}

function isAfterMidiCutoffInFrance() {
  const nowFrance = getFranceParts();
  return nowFrance.hour > 13 || (nowFrance.hour === 13 && nowFrance.minute >= 30);
}

function isAfterSoirCutoffInFrance() {
  const nowFrance = getFranceParts();
  return nowFrance.hour > 21 || (nowFrance.hour === 21 && nowFrance.minute >= 30);
}
function isPastSlotInFrance(heure) {
  if (!heure) return true;

  const nowFrance = getFranceParts();

  const [hour, minute] = String(heure)
    .slice(0, 5)
    .split(":")
    .map(Number);

  if (hour < nowFrance.hour) return true;
  if (hour === nowFrance.hour && minute <= nowFrance.minute) return true;

  return false;
}