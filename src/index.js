export default {
    async fetch(request, env) {

        const url = new URL(request.url);

        if (url.pathname === "/api/test") {
            return jsonResponse({
                success: true,
                message: "Paroles Mystères API fonctionne !"
            });
        }

        if (url.pathname === "/api/musicbrainz") {
            return await searchMusicBrainz(url);
        }

        if (url.pathname === "/api/lyrics") {
            return await getLyrics(url);
        }

        if (url.pathname === "/api/questions") {
            return await generateQuestions(url);
        }

        return env.ASSETS.fetch(request);
    }
};


/* =========================================================
   MUSICBRAINZ
   ========================================================= */

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
            .map(
                recording => {

                    return {
                        id:
                            recording.id,

                        title:
                            recording.title,

                        artist:
                            recording[
                                "artist-credit"
                            ]?.[0]?.name ||
                            "Artiste inconnu",

                        firstReleaseDate:
                            recording[
                                "first-release-date"
                            ] || null
                    };
                }
            );

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


/* =========================================================
   LRCLIB
   ========================================================= */

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


/* =========================================================
   GÉNÉRATION DES QUESTIONS
   ========================================================= */

async function generateQuestions(url) {

    const language =
        url.searchParams.get("language") ||
        "both";

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

    const number =
        Math.min(
            Math.max(
                requestedNumber,
                1
            ),
            30
        );


    /* =====================================================
       ARTISTES FRANÇAIS
       ===================================================== */

    const frenchArtists = [

        "Stromae",
        "Indochine",
        "Mylène Farmer",
        "Jean-Jacques Goldman",
        "Francis Cabrel",
        "Johnny Hallyday",
        "Michel Sardou",
        "Daniel Balavoine",
        "France Gall",
        "Dalida",
        "Charles Aznavour",
        "Édith Piaf",
        "Jacques Brel",
        "Renaud",
        "Téléphone",
        "Louane",
        "Angèle",
        "Vianney",
        "Orelsan",
        "Bigflo & Oli",
        "Soprano",
        "Maître Gims",
        "Kendji Girac",
        "Julien Doré",
        "Zaz",
        "Christophe Maé",
        "Calogero",
        "M. Pokora",
        "Clara Luciani",
        "Aya Nakamura"
    ];


    /* =====================================================
       ARTISTES ANGLAIS
       ===================================================== */

    const englishArtists = [

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
        "Nirvana",
        "The Beatles",
        "The Rolling Stones",
        "Elton John",
        "Madonna",
        "Taylor Swift",
        "Billie Eilish",
        "Justin Timberlake",
        "Britney Spears",
        "Katy Perry",
        "Maroon 5",
        "Linkin Park",
        "Green Day",
        "Red Hot Chili Peppers",
        "Imagine Dragons",
        "The Police"
    ];


    /* =====================================================
       CHOIX DE LA LANGUE
       ===================================================== */

    let artists = [];

    if (language === "fr") {

        artists = [
            ...frenchArtists
        ];

    } else if (language === "en") {

        artists = [
            ...englishArtists
        ];

    } else {

        artists = [
            ...frenchArtists,
            ...englishArtists
        ];
    }


    /* =====================================================
       MÉLANGE DES ARTISTES
       ===================================================== */

    artists =
        shuffleArray(
            artists
        );


    const questions = [];

    const usedArtists =
        new Set();


    /* =====================================================
       PARCOURS DES ARTISTES
       ===================================================== */

    for (
        const artist of artists
    ) {

        if (
            questions.length >= number
        ) {
            break;
        }


        if (
            usedArtists.has(
                normalizeArtistName(
                    artist
                )
            )
        ) {
            continue;
        }


        try {

            /* =================================================
               RECHERCHE MUSICBRAINZ
               ================================================= */

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
                data.recordings ||
                [];


            if (
                recordings.length === 0
            ) {
                continue;
            }


            const shuffledRecordings =
                shuffleArray(
                    recordings
                );


            /*
             * On cherche une seule chanson
             * valable pour cet artiste.
             */

            let artistQuestion =
                null;


            for (
                const recording
                of shuffledRecordings
            ) {

                const recordingArtist =
                    recording[
                        "artist-credit"
                    ]?.[0]?.name;


                const recordingTitle =
                    recording.title;


                const releaseDate =
                    recording[
                        "first-release-date"
                    ] || null;


                if (
                    !recordingArtist ||
                    !recordingTitle
                ) {
                    continue;
                }


                /* =============================================
                   FILTRE ÉPOQUE
                   ============================================= */

                if (
                    !matchesEra(
                        releaseDate,
                        era
                    )
                ) {
                    continue;
                }


                /* =============================================
                   RECHERCHE DES PAROLES
                   ============================================= */

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
                 * Création d'un extrait intelligent.
                 *
                 * On évite autant que possible :
                 * - les refrains répétés
                 * - le titre de la chanson
                 * - les lignes trop courtes
                 * - les passages trop évidents
                 */

                const lyrics =
                    createLyricsExcerpt(
                        lyricsData.plainLyrics,
                        recordingTitle
                    );


                if (!lyrics) {
                    continue;
                }


                artistQuestion = {

                    artist:
                        recordingArtist,

                    title:
                        recordingTitle,

                    lyrics:
                        lyrics,

                    difficulty:
                        difficulty,

                    year:
                        releaseDate,

                    language:
                        language,

                    genre:
                        genre
                };


                break;
            }


            /* =================================================
               AJOUT DE LA QUESTION
               ================================================= */

            if (artistQuestion) {

                questions.push(
                    artistQuestion
                );


                usedArtists.add(
                    normalizeArtistName(
                        artistQuestion.artist
                    )
                );
            }


            await sleep(100);


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

            language,
            genre,
            era,
            difficulty
        },

        questions
    });
}


/* =========================================================
   FILTRE DES ÉPOQUES
   ========================================================= */

function matchesEra(
    releaseDate,
    era
) {

    if (
        !releaseDate ||
        era === "all"
    ) {
        return true;
    }


    const year =
        Number(
            String(
                releaseDate
            ).substring(0, 4)
        );


    if (
        !year ||
        Number.isNaN(year)
    ) {
        return false;
    }


    switch (era) {

        case "1960-1979":

            return (
                year >= 1960 &&
                year <= 1979
            );


        case "1980-1989":

            return (
                year >= 1980 &&
                year <= 1989
            );


        case "1990-1999":

            return (
                year >= 1990 &&
                year <= 1999
            );


        case "2000-2009":

            return (
                year >= 2000 &&
                year <= 2009
            );


        case "2010-2019":

            return (
                year >= 2010 &&
                year <= 2019
            );


        case "2020-2026":

            return (
                year >= 2020 &&
                year <= 2026
            );


        default:

            return true;
    }
}


/* =========================================================
   SÉLECTION DE L'EXTRAIT DE PAROLES
   ========================================================= */

function createLyricsExcerpt(
    lyrics,
    title
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
                    line.length >= 20
            );


    if (
        lines.length < 4
    ) {
        return null;
    }


    /*
     * Nettoyage du titre pour pouvoir détecter
     * les lignes qui le contiennent.
     */

    const normalizedTitle =
        normalizeText(
            title
        );


    /*
     * On crée des candidats composés
     * de 2 lignes consécutives.
     */

    const candidates = [];


    for (
        let i = 0;
        i < lines.length - 1;
        i++
    ) {

        const firstLine =
            lines[i];

        const secondLine =
            lines[i + 1];


        const combined =
            `${firstLine} ${secondLine}`;


        const normalizedCombined =
            normalizeText(
                combined
            );


        /*
         * Évite les extraits contenant le titre.
         */

        if (
            normalizedTitle.length >= 4 &&
            normalizedCombined.includes(
                normalizedTitle
            )
        ) {
            continue;
        }


        /*
         * Évite les lignes qui semblent
         * être des répétitions.
         */

        if (
            normalizeText(
                firstLine
            ) ===
            normalizeText(
                secondLine
            )
        ) {
            continue;
        }


        /*
         * Évite les lignes extrêmement courtes.
         */

        if (
            firstLine.length < 20 ||
            secondLine.length < 20
        ) {
            continue;
        }


        /*
         * Évite les passages contenant
         * plusieurs mots répétés.
         */

        if (
            hasTooManyRepeatedWords(
                combined
            )
        ) {
            continue;
        }


        candidates.push({
            text:
                combined,

            index:
                i
        });
    }


    if (
        candidates.length === 0
    ) {
        return null;
    }


    /*
     * On donne une préférence aux passages
     * situés dans différentes zones du morceau.
     *
     * Cela évite notamment de prendre
     * systématiquement le début.
     */

    const preferredCandidates =
        candidates.filter(
            candidate => {

                return (
                    candidate.index > 2 &&
                    candidate.index <
                        lines.length - 3
                );
            }
        );


    const pool =
        preferredCandidates.length > 0
            ? preferredCandidates
            : candidates;


    /*
     * Sélection aléatoire.
     */

    const selected =
        pool[
            Math.floor(
                Math.random() *
                pool.length
            )
        ];


    return selected.text;
}


/* =========================================================
   DÉTECTION DES RÉPÉTITIONS
   ========================================================= */

function hasTooManyRepeatedWords(
    text
) {

    const words =
        normalizeText(
            text
        )
        .split(" ")
        .filter(
            word =>
                word.length >= 4
        );


    if (
        words.length < 4
    ) {
        return false;
    }


    const counts = {};


    for (
        const word of words
    ) {

        counts[word] =
            (counts[word] || 0) + 1;
    }


    const repeated =
        Object.values(
            counts
        ).filter(
            count =>
                count >= 3
        );


    return (
        repeated.length > 0
    );
}


/* =========================================================
   MÉLANGE ALÉATOIRE
   ========================================================= */

function shuffleArray(
    array
) {

    return [...array].sort(
        () =>
            Math.random() - 0.5
    );
}


/* =========================================================
   NORMALISATION ARTISTE
   ========================================================= */

function normalizeArtistName(
    artist
) {

    return String(
        artist
    )
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .trim();
}


/* =========================================================
   NORMALISATION TEXTE
   ========================================================= */

function normalizeText(
    text
) {

    return String(
        text
    )
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^\w\s]/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


/* =========================================================
   PETITE PAUSE
   ========================================================= */

function sleep(
    milliseconds
) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                milliseconds
            )
    );
}


/* =========================================================
   RÉPONSE JSON
   ========================================================= */

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
