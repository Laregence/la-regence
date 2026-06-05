import { createClient } from "@supabase/supabase-js";

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
        body: JSON.stringify({
          error: "Configuration Supabase serveur manquante",
        }),
      };
    }

    const supabase = createClient(supabaseUrl, supabaseSecretKey);

    const dateService = reservation.date_service;
    const service = reservation.service;

    if (!dateService || !service) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Date ou service manquant.",
        }),
      };
    }

    const { data: exception } = await supabase
      .from("reservation_exceptions")
      .select("*")
      .eq("date_service", dateService)
      .maybeSingle();

    const requestedDate = new Date(`${dateService}T00:00:00`);
    const dayOfWeek = requestedDate.getDay(); // 0 = dimanche

    const isSunday = dayOfWeek === 0;

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

    const { data, error } = await supabase
      .from("reservations")
      .insert(cleanedReservation)
      .select()
      .single();

    if (error) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: error.message,
        }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        reservation: data,
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
  const nowFrance = getFranceParts();
  return nowFrance.date === dateService;
}

function isAfterMidiCutoffInFrance() {
  const nowFrance = getFranceParts();

  if (nowFrance.hour > 13) return true;
  if (nowFrance.hour === 13 && nowFrance.minute >= 30) return true;

  return false;
}
function isAfterSoirCutoffInFrance() {
  const nowFrance = getFranceParts();

  if (nowFrance.hour > 21) return true;
  if (nowFrance.hour === 21 && nowFrance.minute >= 30) return true;

  return false;
}