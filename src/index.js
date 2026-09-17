export default {
    async fetch(request, env) {

        const url = new URL(request.url);

        /*
         * ================================
         * TEST
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
         * MUSICBRAINZ
         * ================================
         */

        if (url.pathname === "/api/musicbrainz") {

            return await searchMusicBrainz(url);

        }


        /*
         * ================================
         * LRCLIB
         * ================================
         */

        if (url.pathname === "/api/lyrics") {

            return await getLyrics(url);

        }


        /*
         * ================================
         * QUESTIONS
         * ================================
         */

        if (url.pathname === "/api/questions") {

            return await generateQuestions(url);

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
 * ========================================
 * MUSICBRAINZ
 * ========================================
 */

async function searchMusicBrainz(url) {

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
                            "ParolesMysteres/1.0"
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
            "MusicBrainz error:",
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
 * ========================================
 * LRCLIB
 * ========================================
 */

async function getLyrics(url) {

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

        const lrclibUrl =
            "https://lrclib.net/api/get" +
            "?artist_name=" +
            encodeURIComponent(artist) +
            "&track_name=" +
            encodeURIComponent(title);


        const response =
            await fetch(lrclibUrl);


        if (!response.ok) {

            return jsonResponse(
                {
                    success: false,
                    error:
                        "Paroles introuvables."
                },
                404
            );

        }


        const data =
            await response.json();


        return jsonResponse({

            success: true,

            artist:
                data.artistName ||
                artist,

            title:
                data.trackName ||
                title,

            album:
                data.albumName ||
                null,

            duration:
                data.duration ||
                null,

            lyrics:
                data.plainLyrics ||
                null,

            syncedLyrics:
                data.syncedLyrics ||
                null

        });


    } catch (error) {

        console.error(
            "LRCLIB error:",
            error
        );


        return jsonResponse(
            {
                success: false,
                error:
                    "Impossible de contacter LRCLIB."
            },
            500
        );

    }
}


/*
 * ========================================
 * GÉNÉRATION DES QUESTIONS
 * ========================================
 */

async function generateQuestions(url) {

    const genre =
        url.searchParams.get("genre") ||
        "all";

    const era =
        url.searchParams.get("era") ||
        "all";

    const difficulty =
        url.searchParams.get("difficulty") ||
        "all";

    const requestedNumber =
        Number(
            url.searchParams.get("number")
        ) || 10;


    /*
     * Limite de sécurité
     */

    const number =
        Math.min(
            Math.max(requestedNumber, 1),
            30
        );


    /*
     * Pour le premier test,
     * on utilise une petite sélection
     * de recherches MusicBrainz.
     */

    const searches = [
        "Stromae",
        "Indochine",
        "Mylène Farmer",
        "Jean-Jacques Goldman",
        "Daft Punk",
        "Queen",
        "Michael Jackson",
        "Eminem",
        "The Weeknd",
        "Coldplay"
    ];


    /*
     * Mélange aléatoire
     */

    const shuffled =
        searches
            .sort(
                () => Math.random() - 0.5
            );


    const questions = [];


    for (
        const artist of shuffled
    ) {

        if (
            questions.length >= number
        ) {
            break;
        }


        try {

            const searchUrl =
                "https://musicbrainz.org/ws/2/recording/" +
                "?query=" +
                encodeURIComponent(
                    `artist:"${artist}"`
                ) +
                "&fmt=json" +
                "&limit=10";


            const response =
                await fetch(
                    searchUrl,
                    {
                        headers: {
                            "User-Agent":
                                "ParolesMysteres/1.0"
                        }
                    }
                );


            if (!response.ok) {
                continue;
            }


            const data =
                await response.json();


            const recordings =
                data.recordings || [];


            if (
                recordings.length === 0
            ) {
                continue;
            }


            const recording =
                recordings[
                    Math.floor(
                        Math.random() *
                        recordings.length
                    )
                ];


            const recordingArtist =
                recording[
                    "artist-credit"
                ]?.[0]?.name;


            if (
                !recordingArtist ||
                !recording.title
            ) {
                continue;
            }


            /*
             * Recherche des paroles
             */

            const lyricsUrl =
                "https://lrclib.net/api/get" +
                "?artist_name=" +
                encodeURIComponent(
                    recordingArtist
                ) +
                "&track_name=" +
                encodeURIComponent(
                    recording.title
                );


            const lyricsResponse =
                await fetch(
                    lyricsUrl
                );


            if (
                !lyricsResponse.ok
            ) {
                continue;
            }


            const lyricsData =
                await lyricsResponse.json();


            if (
                !lyricsData.plainLyrics
            ) {
                continue;
            }


            /*
             * On extrait quelques lignes
             * des paroles.
             */

            const lyrics =
                createLyricsExcerpt(
                    lyricsData.plainLyrics
                );


            if (!lyrics) {
                continue;
            }


            questions.push({

                artist:
                    recordingArtist,

                title:
                    recording.title,

                lyrics:

                    lyrics,

                difficulty:
                    difficulty,

                year:
                    recording[
                        "first-release-date"
                    ] || null

            });


        } catch (error) {

            console.error(
                "Question generation error:",
                error
            );

        }

    }


    return jsonResponse({

        success: true,

        filters: {
            genre,
            era,
            difficulty
        },

        questions

    });

}


/*
 * ========================================
 * EXTRAIT DE PAROLES
 * ========================================
 */

function createLyricsExcerpt(
    lyrics
) {

    const lines =
        lyrics
            .split("\n")
            .map(
                line =>
                    line.trim()
            )
            .filter(
                line =>
                    line.length > 0
            );


    if (
        lines.length < 3
    ) {
        return null;
    }


    /*
     * On choisit un passage
     * de 2 à 4 lignes.
     */

    const maxStart =
        Math.max(
            lines.length - 4,
            0
        );


    const start =
        Math.floor(
            Math.random() *
            (maxStart + 1)
        );


    const selected =
        lines.slice(
            start,
            start + 4
        );


    return selected.join("\n");

}


/*
 * ========================================
 * RÉPONSE JSON
 * ========================================
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
                    "application/json; charset=UTF-8",

                "Cache-Control":
                    "no-store"
            }
        }
    );

}
