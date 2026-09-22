export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ error: "Méthode non autorisée" }),
    };
  }

  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const placeId = process.env.GOOGLE_PLACE_ID;

    if (!apiKey || !placeId) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          error: "Configuration Google Places manquante",
        }),
      };
    }

    const url = new URL(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`
    );

    url.searchParams.set("languageCode", "fr");
    url.searchParams.set("regionCode", "FR");

    const response = await fetch(url, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "rating,userRatingCount,googleMapsUri,reviews",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Google Places error:", data);

      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          error:
            data?.error?.message ||
            "Impossible de récupérer les avis Google.",
        }),
      };
    }

    const reviews = Array.isArray(data.reviews)
      ? data.reviews.slice(0, 3).map((review) => ({
          rating: review.rating,

          text:
            review.text?.text ||
            review.originalText?.text ||
            "",

          originalText:
            review.originalText?.text ||
            "",

          translated:
            Boolean(review.text?.languageCode) &&
            Boolean(review.originalText?.languageCode) &&
            review.text.languageCode !==
              review.originalText.languageCode,

          author: {
            name:
              review.authorAttribution?.displayName ||
              "Utilisateur Google",

            uri:
              review.authorAttribution?.uri ||
              "",

            photoUri:
              review.authorAttribution?.photoUri ||
              "",
          },

          visitDate:
            review.visitDate ||
            null,

          relativePublishTimeDescription:
            review.relativePublishTimeDescription ||
            "",

          googleMapsUri:
            review.googleMapsUri ||
            "",
        }))
      : [];

    return {
      statusCode: 200,

      headers: {
        "Content-Type": "application/json; charset=utf-8",

        // Le contenu Places n'est volontairement pas mis en cache.
        "Cache-Control": "no-store",
      },

      body: JSON.stringify({
        rating:
          data.rating ||
          null,

        userRatingCount:
          data.userRatingCount ||
          0,

        googleMapsUri:
          data.googleMapsUri ||
          "",

        reviews,
      }),
    };
  } catch (error) {
    console.error("google-reviews:", error);

    return {
      statusCode: 500,

      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },

      body: JSON.stringify({
        error:
          error.message ||
          "Erreur serveur",
      }),
    };
  }
}