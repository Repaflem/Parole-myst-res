export default {
    async fetch(request, env) {

        const url = new URL(request.url);

        /*
         * ================================
         * TEST DE L'API
         * ================================
         */

        if (url.pathname === "/api/test") {

            return jsonResponse({
                success: true,
                message: "Paroles Mystères API fonctionne !"
            });

        }


        /*
         * ================================
         * RECHERCHE MUSICBRAINZ
         * ================================
         */

        if (url.pathname === "/api/musicbrainz") {

            const artist =
                url.searchParams.get("artist");

            const title =
                url.searchParams.get("title");


            if (!artist || !title) {

                return jsonResponse(
                    {
                        success: false,
                        error: "Artiste et titre requis."
                    },
                    400
                );

            }


            try {

                const query =
                    `artist:"${artist}" AND recording:"${title}"`;

                const musicBrainzUrl =
                    "https://musicbrainz.org/ws/2/recording/" +
                    "?query=" +
                    encodeURIComponent(query) +
                    "&fmt=json" +
                    "&limit=5";


                const response =
                    await fetch(
                        musicBrainzUrl,
                        {
                            headers: {
                                "User-Agent":
                                    "ParolesMysteres/1.0 (Cloudflare Worker)"
                            }
                        }
                    );


                if (!response.ok) {

                    throw new Error(
                        "MusicBrainz HTTP " +
                        response.status
                    );

                }


                const data =
                    await response.json();


                const recordings =
                    (data.recordings || [])
                    .map(recording => {

                        return {

                            id:
                                recording.id,

                            title:
                                recording.title,

                            artist:
                                recording["artist-credit"]?.[0]?.name ||
                                "Artiste inconnu",

                            firstReleaseDate:
                                recording[
                                    "first-release-date"
                                ] || null

                        };

                    });


                return jsonResponse({

                    success: true,

                    query: {
                        artist,
                        title
                    },

                    results:
                        recordings

                });


            } catch (error) {

                console.error(
                    "Erreur MusicBrainz :",
                    error
                );


                return jsonResponse(
                    {
                        success: false,
                        error:
                            "Impossible de contacter MusicBrainz."
                    },
                    500
                );

            }

        }


        /*
         * ================================
         * FICHIERS DU SITE
         * ================================
         */

        return env.ASSETS.fetch(request);

    }
};


/*
 * ================================
 * RÉPONSE JSON
 * ================================
 */

function jsonResponse(
    data,
    status = 200
) {

    return new Response(
        JSON.stringify(
            data,
            null,
            2
        ),
        {
            status,

            headers: {
                "Content-Type":
                    "application/json; charset=UTF-8"
            }
        }
    );

}
