import webpush from "web-push";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Méthode non autorisée" }),
    };
  }

  try {
    const payload = JSON.parse(event.body || "{}");

    const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    const subscriptionsResponse = await fetch(
      `${supabaseUrl}/rest/v1/push_subscriptions?select=*`,
      {
        headers: {
          apikey: supabaseSecretKey,
          Authorization: `Bearer ${supabaseSecretKey}`,
        },
      }
    );

    const subscriptions = await subscriptionsResponse.json();

    const notificationPayload = JSON.stringify({
      title: payload.title || "Nouvelle réservation",
      body: payload.body || "Une nouvelle demande est à traiter.",
      url: payload.url || "/admin/reservations",
    });

    const results = await Promise.allSettled(
      subscriptions.map((row) =>
        webpush.sendNotification(row.subscription, notificationPayload)
      )
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        sent: results.filter((r) => r.status === "fulfilled").length,
        failed: results.filter((r) => r.status === "rejected").length,
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message || "Erreur push",
      }),
    };
  }
}