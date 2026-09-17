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
         * GÉNÉRATION DES QUESTIONS
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
            await fetch(
                lrclibUrl
            );


        if (!response.ok) {

            return jsonResponse(
                {
                    success: false,
                    error:
                        "Paroles introuvables.",
                    status:
                        response.status
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
        url.searchParams.get("genre") || "all";

    const era =
        url.searchParams.get("era") || "all";

    const difficulty =
        url.searchParams.get("difficulty") || "all";

    const requestedNumber =
        Number(
            url.searchParams.get("number")
        ) || 10;


    /*
     * Limite de sécurité
     */

    const number =
        Math.min(
            Math.max(
                requestedNumber,
                1
            ),
            30
        );


    /*
     * Artistes utilisés pour la génération.
     *
     * Cette liste est temporaire.
     * Elle sera remplacée par un système
     * réellement basé sur les filtres
     * musicaux.
     */

    const artists = [

        "Stromae",
        "Indochine",
        "Mylène Farmer",
        "Jean-Jacques Goldman",
        "Daft Punk",
        "Queen",
        "Michael Jackson",
        "Eminem",
        "The Weeknd",
        "Coldplay",
        "Ed Sheeran",
        "Adele",
        "Lady Gaga",
        "Rihanna",
        "Bruno Mars",
        "David Bowie",
        "ABBA",
        "Depeche Mode",
        "Oasis",
        "Nirvana"

    ];


    /*
     * Mélange des artistes
     */

    const shuffledArtists =
        [...artists].sort(
            () => Math.random() - 0.5
        );


    const questions = [];


    /*
     * Parcours des artistes
     */

    for (
        const artist of shuffledArtists
    ) {

        /*
         * On arrête dès que le nombre
         * demandé est atteint.
         */

        if (
            questions.length >= number
        ) {

            break;

        }


        try {

            /*
             * ================================
             * RECHERCHE MUSICBRAINZ
             * ================================
             */

            const searchUrl =
                "https://musicbrainz.org/ws/2/recording/" +
                "?query=" +
                encodeURIComponent(
                    `artist:"${artist}"`
                ) +
                "&fmt=json" +
                "&limit=25";


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


            /*
             * Mélange des chansons
             */

            const shuffledRecordings =
                [...recordings].sort(
                    () => Math.random() - 0.5
                );


            /*
             * ================================
             * RECHERCHE DES PAROLES
             * ================================
             */

            for (
                const recording
                of shuffledRecordings
            ) {

                /*
                 * Nombre de questions atteint
                 */

                if (
                    questions.length >= number
                ) {

                    break;

                }


                const recordingArtist =
                    recording[
                        "artist-credit"
                    ]?.[0]?.name;


                const recordingTitle =
                    recording.title;


                /*
                 * Enregistrement invalide
                 */

                if (
                    !recordingArtist ||
                    !recordingTitle
                ) {

                    continue;

                }


                /*
                 * Recherche LRCLIB
                 */

                const lyricsUrl =
                    "https://lrclib.net/api/get" +
                    "?artist_name=" +
                    encodeURIComponent(
                        recordingArtist
                    ) +
                    "&track_name=" +
                    encodeURIComponent(
                        recordingTitle
                    );


                const lyricsResponse =
                    await fetch(
                        lyricsUrl
                    );


                /*
                 * Pas de paroles
                 */

                if (
                    !lyricsResponse.ok
                ) {

                    continue;

                }


                const lyricsData =
                    await lyricsResponse.json();


                /*
                 * Pas de paroles exploitables
                 */

                if (
                    !lyricsData.plainLyrics
                ) {

                    continue;

                }


                /*
                 * Création de l'extrait
                 */

                const lyrics =
                    createLyricsExcerpt(
                        lyricsData.plainLyrics
                    );


                if (!lyrics) {

                    continue;

                }


                /*
                 * Éviter les doublons
                 */

                const duplicate =
                    questions.some(
                        question =>

                            question.artist
                                .toLowerCase() ===
                            recordingArtist
                                .toLowerCase()

                            &&

                            question.title
                                .toLowerCase() ===
                            recordingTitle
                                .toLowerCase()
                    );


                if (duplicate) {

                    continue;

                }


                /*
                 * ================================
                 * AJOUT DE LA QUESTION
                 * ================================
                 */

                questions.push({

                    artist:
                        recordingArtist,

                    title:
                        recordingTitle,

                    lyrics:
                        lyrics,

                    difficulty:
                        difficulty,

                    year:
                        recording[
                            "first-release-date"
                        ] || null

                });

            }


        } catch (error) {

            console.error(
                "Question generation error:",
                error
            );

        }

    }


    /*
     * ================================
     * RÉSULTAT
     * ================================
     */

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

    /*
     * Découpage des paroles
     */

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


    /*
     * Pas assez de contenu
     */

    if (
        lines.length < 3
    ) {

        return null;

    }


    /*
     * Choisir un point de départ
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


    /*
     * Récupérer jusqu'à 4 lignes
     */

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
