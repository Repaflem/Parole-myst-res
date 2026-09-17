export default {
    async fetch(request, env) {

        const url = new URL(request.url);


        /*
         * ============================
         * ROUTES
         * ============================
         */

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

            return await generateQuestions(url, env);

        }


        /*
         * Toutes les autres requêtes
         * sont envoyées vers les fichiers
         * présents dans /public.
         */

        return env.ASSETS.fetch(request);

    }
};


/*
 * ============================
 * CACHE LAST.FM
 * ============================
 */

const lastFmCache =
    new Map();

const LASTFM_CACHE_DURATION =
    30 * 60 * 1000;


/*
 * ============================
 * MUSICBRAINZ
 * ============================
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
            "&fmt=json&limit=5";


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

            return jsonResponse(
                {
                    success: false,
                    error:
                        "MusicBrainz a retourné une erreur."
                },
                response.status
            );

        }


        const data =
            await response.json();


        const recordings =
            data.recordings || [];


        const results =
            recordings.map(
                recording => {

                    const artistCredit =
                        recording["artist-credit"] || [];


                    const recordingArtist =
                        artistCredit.length > 0
                            ? artistCredit[0].name
                            : artist;


                    const firstReleaseDate =
                        recording["first-release-date"] ||
                        (
                            recording.releases &&
                            recording.releases.length > 0
                                ? recording.releases[0]["date"]
                                : null
                        );


                    return {

                        id:
                            recording.id,

                        title:
                            recording.title ||
                            title,

                        artist:
                            recordingArtist,

                        firstReleaseDate:
                            firstReleaseDate

                    };

                }
            );


        return jsonResponse(
            {
                success: true,
                results
            }
        );


    } catch (error) {

        return jsonResponse(
            {
                success: false,
                error:
                    "Erreur lors de la recherche MusicBrainz.",
                details:
                    error.message
            },
            500
        );

    }

}


/*
 * ============================
 * LRCLIB
 * ============================
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
                        "LRCLIB n'a pas trouvé les paroles."
                },
                response.status
            );

        }


        const data =
            await response.json();


        return jsonResponse(
            {
                success: true,
                data
            }
        );


    } catch (error) {

        return jsonResponse(
            {
                success: false,
                error:
                    "Erreur lors de la récupération des paroles.",
                details:
                    error.message
            },
            500
        );

    }

}


/*
 * ============================
 * LAST.FM
 * ============================
 */

const POPULARITY_THRESHOLDS = {

    easy:
        500000,

    medium:
        100000,

    hard:
        10000

};


async function getLastFmTrackInfo(
    env,
    artist,
    title,
    mbid = null
) {

    const apiKey =
        env.LASTFM_API_KEY;


    if (!apiKey) {

        console.error(
            "Paroles Mystères : LASTFM_API_KEY est absente."
        );

        return null;

    }


    const cacheKey =
        mbid
            ? `mbid:${mbid}`
            : `track:${normalizeArtistName(artist)}:${normalizeText(title)}`;


    const cached =
        lastFmCache.get(
            cacheKey
        );


    if (
        cached &&
        (
            Date.now() -
            cached.timestamp
        ) <
        LASTFM_CACHE_DURATION
    ) {

        return cached.data;

    }


    try {

        const params =
            new URLSearchParams({

                method:
                    "track.getInfo",

                api_key:
                    apiKey,

                format:
                    "json",

                autocorrect:
                    "1"

            });


        if (mbid) {

            params.set(
                "mbid",
                mbid
            );

        } else {

            params.set(
                "artist",
                artist
            );

            params.set(
                "track",
                title
            );

        }


        const lastFmUrl =
            "https://ws.audioscrobbler.com/2.0/?" +
            params.toString();


        const response =
            await fetch(
                lastFmUrl,
                {
                    headers: {

                        "User-Agent":
                            "ParolesMysteres/1.0 (Cloudflare Worker)"

                    }
                }
            );


        if (!response.ok) {

            console.error(
                "Last.fm HTTP error:",
                response.status
            );

            return null;

        }


        const data =
            await response.json();


        if (data.error) {

            console.error(
                "Last.fm error:",
                data.message
            );

            return null;

        }


        const track =
            data.track;


        if (!track) {

            return null;

        }


        const listeners =
            Number(
                track.listeners
            ) || 0;


        const playcount =
            Number(
                track.playcount
            ) || 0;


        const result = {

            listeners,
            playcount,

            artist:
                track.artist?.name ||
                artist,

            title:
                track.name ||
                title,

            mbid:
                track.mbid ||
                mbid,

            url:
                track.url ||
                null

        };


        lastFmCache.set(
            cacheKey,
            {
                timestamp:
                    Date.now(),

                data:
                    result
            }
        );


        return result;


    } catch (error) {

        console.error(
            "Erreur Last.fm :",
            error
        );

        return null;

    }

}


/*
 * ============================
 * POPULARITÉ / DIFFICULTÉ
 * ============================
 */

function matchesDifficulty(
    lastFmInfo,
    difficulty
) {

    if (
        difficulty === "all"
    ) {

        return true;

    }


    if (!lastFmInfo) {

        return false;

    }


    const listeners =
        Number(
            lastFmInfo.listeners
        ) || 0;


    if (
        difficulty === "easy"
    ) {

        return (
            listeners >=
            POPULARITY_THRESHOLDS.easy
        );

    }


    if (
        difficulty === "medium"
    ) {

        return (
            listeners >=
            POPULARITY_THRESHOLDS.medium &&
            listeners <
            POPULARITY_THRESHOLDS.easy
        );

    }


    if (
        difficulty === "hard"
    ) {

        return (
            listeners >=
            POPULARITY_THRESHOLDS.hard &&
            listeners <
            POPULARITY_THRESHOLDS.medium
        );

    }


    return true;

}


/*
 * ============================
 * CATALOGUE DES ARTISTES
 * ============================
 *
 * 4 catégories uniquement :
 *
 * - Variété française
 * - Pop / Rock français
 * - Rap français
 * - Pop actuelle
 *
 * Tous les artistes sont francophones.
 */

const artistGenres = {


    /*
     * ============================
     * VARIÉTÉ FRANÇAISE
     * ============================
     */

    "variete-francaise": [

        "Jean-Jacques Goldman",
        "Mylène Farmer",
        "Renaud",
        "Dalida",
        "Slimane",
        "Jacques Brel",
        "Francis Cabrel",
        "Michel Sardou",
        "France Gall",
        "Daniel Balavoine",
        "Patrick Bruel",
        "Alain Souchon",
        "Laurent Voulzy",
        "Joe Dassin",
        "Serge Gainsbourg",
        "Barbara",
        "Édith Piaf",
        "Charles Aznavour",
        "Johnny Hallyday",
        "Claude François",
        "Michel Berger",
        "Véronique Sanson",
        "Julien Clerc",
        "Maxime Le Forestier",
        "Georges Brassens",
        "Georges Moustaki",
        "Calogero",
        "Zaz",
        "Vianney",
        "Amel Bent",
        "Florent Pagny",
        "Pascal Obispo",
        "Francis Lalanne",
        "Patricia Kaas",
        "Lara Fabian",
        "Garou",
        "Hélène Ségara",
        "Nolwenn Leroy",
        "Christophe Maé",
        "Raphaël",
        "Grand Corps Malade"

    ],


    /*
     * ============================
     * POP / ROCK FRANÇAIS
     * ============================
     */

    "pop-rock-francais": [

        "Téléphone",
        "Noir Désir",
        "Indochine",
        "Trust",
        "Eiffel",
        "Louise Attaque",
        "Kyo",
        "Superbus",
        "BB Brunes",
        "Skip The Use",
        "Saez",
        "Matmatah",
        "Mickey 3D",
        "Dionysos",
        "Shaka Ponk",
        "Mademoiselle K",
        "Les Rita Mitsouko",
        "Les Innocents",
        "Déportivo",
        "Luke",
        "Gaëtan Roussel",
        "Benjamin Biolay",
        "Louane"

    ],


    /*
     * ============================
     * RAP FRANÇAIS
     * ============================
     */

    "rap-francais": [

        "IAM",
        "Suprême NTM",
        "MC Solaar",
        "Orelsan",
        "Stromae",
        "Bigflo & Oli",
        "Nekfeu",
        "Booba",
        "Soprano",
        "PNL",
        "Damso",
        "Jul",
        "Ninho",
        "SCH",
        "Vald",
        "Lomepal",
        "Gims",
        "Black M",
        "Kaaris",
        "Niska",
        "Rohff",
        "Oxmo Puccino",
        "Disiz",
        "Sniper",
        "Sexion d'Assaut",
        "113",
        "Fonky Family",
        "Doc Gynéco",
        "Kery James",
        "La Fouine",
        "Alonzo",
        "Heuss l'Enfoiré",
        "PLK",
        "Tiakola",
        "Hatik",
        "Dinos",
        "Laylow",
        "Werenoi"

    ],


    /*
     * ============================
     * POP ACTUELLE
     * ============================
     */

    "pop-actuelle": [

        "Aya Nakamura",
        "Angèle",
        "Clara Luciani",
        "Juliette Armanet",
        "Adèle Castillon",
        "Hoshi",
        "Pomme",
        "Eddy de Pretto",
        "Pierre de Maere",
        "Vitaa",
        "Dadju",
        "Amir",
        "Kendji Girac",
        "Soprano",
        "Vianney",
        "Louane",
        "Claudio Capéo",
        "Slimane",
        "Yseult",
        "Mentissa",
        "Suzane",
        "Luidji",
        "Christophe Willem",
        "Amel Bent",
        "Zaho de Sagazan",
        "Pierre Garnier",
        "Santa",
        "Jain"

    ]

};


/*
 * ============================
 * TOUS LES ARTISTES
 * ============================
 */

const allArtists =
    [
        ...new Set(
            Object.values(artistGenres)
                .flat()
        )
    ];


/*
 * ============================
 * GÉNÉRATION DES QUESTIONS
 * ============================
 */

async function generateQuestions(
    url,
    env
) {

    /*
     * Le paramètre language n'est
     * volontairement plus utilisé.
     *
     * Le jeu est maintenant
     * exclusivement francophone.
     */


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


    /*
     * ============================
     * CHOIX DU CATALOGUE
     * ============================
     */

    let artists;


    if (
        genre === "all" ||
        !artistGenres[genre]
    ) {

        artists =
            [...allArtists];

    } else {

        artists =
            [...artistGenres[genre]];

    }


    /*
     * Mélange des artistes.
     */

    shuffleArray(
        artists
    );


    const questions = [];


    /*
     * Pour les difficultés filtrées,
     * nous avons besoin de davantage
     * de tentatives.
     */

    const maxAttempts =
        Math.max(
            artists.length * 5,
            number * 10
        );


    let attempts = 0;


    while (
        questions.length < number &&
        attempts < maxAttempts
    ) {

        attempts++;


        /*
         * S'il n'y a plus d'artistes,
         * on recommence avec le catalogue.
         */

        if (
            artists.length === 0
        ) {

            artists =
                [...allArtists];

            shuffleArray(
                artists
            );

        }


        const artist =
            artists.shift();


        if (!artist) {

            continue;

        }


        try {

            /*
             * ============================
             * MUSICBRAINZ
             * ============================
             */

            const query =
                `artist:"${artist}"`;

            const musicBrainzUrl =
                "https://musicbrainz.org/ws/2/recording/" +
                "?query=" +
                encodeURIComponent(query) +
                "&fmt=json&limit=20";


            const musicBrainzResponse =
                await fetch(
                    musicBrainzUrl,
                    {
                        headers: {

                            "User-Agent":
                                "ParolesMysteres/1.0 (Cloudflare Worker)"

                        }
                    }
                );


            if (
                !musicBrainzResponse.ok
            ) {

                await sleep(250);

                continue;

            }


            const musicBrainzData =
                await musicBrainzResponse.json();


            const recordings =
                musicBrainzData.recordings ||
                [];


            if (
                recordings.length === 0
            ) {

                await sleep(250);

                continue;

            }


            /*
             * Mélange des morceaux.
             */

            shuffleArray(
                recordings
            );


            let validRecording =
                null;


            let detectedLanguage =
                null;


            /*
             * Plusieurs morceaux sont testés.
             */

            for (
                const recording of recordings
            ) {

                const recordingTitle =
                    recording.title;


                if (!recordingTitle) {

                    continue;

                }


                const artistCredit =
                    recording["artist-credit"] ||
                    [];


                const recordingArtist =
                    artistCredit.length > 0
                        ? artistCredit[0].name
                        : artist;


                const releaseDate =
                    recording["first-release-date"] ||
                    (
                        recording.releases &&
                        recording.releases.length > 0
                            ? recording.releases[0]["date"]
                            : null
                    );


                /*
                 * ============================
                 * FILTRE ÉPOQUE
                 * ============================
                 */

                if (
                    !matchesEra(
                        releaseDate,
                        era
                    )
                ) {

                    continue;

                }


                /*
                 * ============================
                 * LAST.FM
                 * ============================
                 */

                const lastFmInfo =
                    await getLastFmTrackInfo(
                        env,
                        recordingArtist,
                        recordingTitle,
                        recording.id
                    );


                /*
                 * Si une difficulté est demandée,
                 * Last.fm est obligatoire.
                 */

                if (
                    difficulty !== "all" &&
                    !lastFmInfo
                ) {

                    continue;

                }


                if (
                    !matchesDifficulty(
                        lastFmInfo,
                        difficulty
                    )
                ) {

                    continue;

                }


                /*
                 * ============================
                 * LRCLIB
                 * ============================
                 */

                try {

                    const lrclibUrl =
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
                            lrclibUrl
                        );


                    if (
                        !lyricsResponse.ok
                    ) {

                        continue;

                    }


                    const data =
                        await lyricsResponse.json();


                    const fullLyrics =
                        data.plainLyrics ||
                        "";


                    /*
                     * Il faut suffisamment
                     * de paroles pour créer
                     * un extrait intéressant.
                     */

                    if (
                        !fullLyrics ||
                        fullLyrics.length < 100
                    ) {

                        continue;

                    }


                    /*
                     * ============================
                     * FILTRE LANGUE
                     * ============================
                     *
                     * Le jeu est exclusivement
                     * francophone.
                     */

                    const languageDetected =
                        detectLyricsLanguage(
                            fullLyrics
                        );


                    if (
                        languageDetected !== "fr"
                    ) {

                        continue;

                    }


                    /*
                     * ============================
                     * EXTRAIT
                     * ============================
                     */

                    const excerpt =
                        createLyricsExcerpt(
                            fullLyrics,
                            recordingTitle
                        );


                    if (!excerpt) {

                        continue;

                    }


                    validRecording = {

                        artist:
                            recordingArtist,

                        title:
                            recordingTitle,

                        year:
                            releaseDate,

                        lyrics:
                            excerpt,

                        language:
                            languageDetected,

                        popularity:
                            lastFmInfo
                                ? lastFmInfo.listeners
                                : null,

                        playcount:
                            lastFmInfo
                                ? lastFmInfo.playcount
                                : null,

                        lastFmUrl:
                            lastFmInfo
                                ? lastFmInfo.url
                                : null

                    };


                    detectedLanguage =
                        languageDetected;


                    break;


                } catch (error) {

                    continue;

                }

            }


            /*
             * Aucun morceau valide.
             */

            if (
                !validRecording
            ) {

                await sleep(250);

                continue;

            }


            /*
             * ============================
             * AJOUT DE LA QUESTION
             * ============================
             */

            questions.push({

                artist:
                    validRecording.artist,

                title:
                    validRecording.title,

                lyrics:
                    validRecording.lyrics,

                difficulty:
                    difficulty,

                year:
                    validRecording.year,

                language:
                    detectedLanguage,

                genre:
                    genre,

                popularity:
                    validRecording.popularity,

                playcount:
                    validRecording.playcount,

                lastFmUrl:
                    validRecording.lastFmUrl

            });


            /*
             * Petite pause pour éviter
             * de surcharger les services.
             */

            await sleep(250);


        } catch (error) {

            console.error(
                "Erreur génération question :",
                error
            );

            await sleep(250);

        }

    }


    /*
     * ============================
     * RÉPONSE FINALE
     * ============================
     */

    return jsonResponse({

        success:
            true,

        questions,

        requested:
            number,

        count:
            questions.length

    });

}


/*
 * ============================
 * DÉTECTION DE LANGUE
 * ============================
 *
 * Détection volontairement orientée
 * vers le français.
 */

function detectLyricsLanguage(
    lyrics
) {

    const text =
        normalizeText(
            lyrics
        );


    if (!text) {

        return "unknown";

    }


    const words =
        text.split(/\s+/);


    const frenchWords = [

        "je",
        "tu",
        "il",
        "elle",
        "nous",
        "vous",
        "ils",
        "elles",
        "dans",
        "avec",
        "pour",
        "sans",
        "mais",
        "comme",
        "une",
        "des",
        "les",
        "mes",
        "tes",
        "ses",
        "notre",
        "votre",
        "être",
        "avoir",
        "faire",
        "tout",
        "tous",
        "plus",
        "pas",
        "que",
        "qui",
        "quoi",
        "sur",
        "mon",
        "ton",
        "son",
        "ma",
        "ta",
        "sa",
        "ce",
        "cette",
        "ces",
        "est",
        "sont",
        "peut",
        "veux",
        "vais",
        "va",
        "moi",
        "toi",
        "eux",
        "leur",
        "leurs",
        "bien",
        "encore",
        "quand",
        "comment",
        "pourquoi",
        "parce",
        "aussi",
        "très",
        "été",
        "était",
        "serai",
        "seras",
        "serait",
        "avais",
        "avait",
        "aurai",
        "aurais",
        "dois",
        "doit",
        "peux",
        "faut",
        "fais",
        "fait",
        "viens",
        "vient",
        "aller",
        "amour",
        "coeur",
        "vie",
        "jour",
        "nuit",
        "temps",
        "monde"

    ];


    const englishWords = [

        "the",
        "you",
        "your",
        "and",
        "with",
        "for",
        "that",
        "this",
        "from",
        "have",
        "has",
        "had",
        "are",
        "was",
        "were",
        "what",
        "when",
        "where",
        "who",
        "how",
        "why",
        "love",
        "baby",
        "girl",
        "boy",
        "heart",
        "night",
        "day",
        "life",
        "world",
        "want",
        "know",
        "can",
        "will",
        "not",
        "all",
        "just",
        "like",
        "one",
        "out",
        "get",
        "got",
        "yourself",
        "myself",
        "someone",
        "something",
        "never",
        "always",
        "really",
        "there",
        "here",
        "away",
        "back",
        "down",
        "come",
        "going",
        "gonna"

    ];


    let frenchScore = 0;
    let englishScore = 0;


    for (
        const word of words
    ) {

        if (
            frenchWords.includes(word)
        ) {

            frenchScore++;

        }


        if (
            englishWords.includes(word)
        ) {

            englishScore++;

        }

    }


    /*
     * Les accents français apportent
     * un bonus.
     */

    const accentMatches =
        lyrics.match(
            /[àâäçéèêëîïôöùûüÿœæ]/gi
        );


    if (accentMatches) {

        frenchScore +=
            Math.min(
                accentMatches.length,
                10
            );

    }


    /*
     * Si l'anglais domine,
     * le morceau est rejeté.
     */

    if (
        englishScore > frenchScore
    ) {

        return "en";

    }


    /*
     * Il faut au minimum quelques
     * indicateurs français.
     */

    if (
        frenchScore >= 3 &&
        frenchScore > englishScore
    ) {

        return "fr";

    }


    return "unknown";

}


/*
 * ============================
 * CORRESPONDANCE D'ÉPOQUE
 * ============================
 */

function matchesEra(
    releaseDate,
    era
) {

    if (
        era === "all"
    ) {

        return true;

    }


    if (!releaseDate) {

        return false;

    }


    const year =
        Number(
            String(releaseDate)
                .substring(0, 4)
        );


    if (!year) {

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


/*
 * ============================
 * CRÉATION DE L'EXTRAIT
 * ============================
 */

function createLyricsExcerpt(
    lyrics,
    title
) {

    const lines =
        lyrics
            .split(/\r?\n/)
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


    const normalizedTitle =
        normalizeText(
            title
        );


    const candidates = [];


    /*
     * Création des couples de lignes.
     */

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
         * Ne pas révéler le titre.
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
         * Évite deux lignes identiques.
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
         * Évite les extraits contenant
         * trop de répétitions.
         */

        if (
            hasTooManyRepeatedWords(
                combined
            )
        ) {

            continue;

        }


        candidates.push(
            combined
        );

    }


    if (
        candidates.length === 0
    ) {

        return null;

    }


    /*
     * Sélection aléatoire.
     */

    const randomIndex =
        Math.floor(
            Math.random() *
            candidates.length
        );


    return candidates[
        randomIndex
    ];

}


/*
 * ============================
 * DÉTECTION DES RÉPÉTITIONS
 * ============================
 */

function hasTooManyRepeatedWords(
    text
) {

    const words =
        normalizeText(
            text
        )
            .split(/\s+/)
            .filter(
                word =>
                    word.length >= 4
            );


    const counts = {};


    for (
        const word of words
    ) {

        counts[word] =
            (
                counts[word] ||
                0
            ) + 1;


        if (
            counts[word] >= 3
        ) {

            return true;

        }

    }


    return false;

}


/*
 * ============================
 * NORMALISATION ARTISTE
 * ============================
 */

function normalizeArtistName(
    artist
) {

    return String(
        artist || ""
    )
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-z0-9\s]/g,
            ""
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


/*
 * ============================
 * NORMALISATION TEXTE
 * ============================
 */

function normalizeText(
    text
) {

    return String(
        text || ""
    )
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^\p{L}\p{N}\s]/gu,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


/*
 * ============================
 * MÉLANGE
 * ============================
 */

function shuffleArray(
    array
) {

    for (
        let i = array.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            array[i],
            array[j]
        ] = [
            array[j],
            array[i]
        ];

    }


    return array;

}


/*
 * ============================
 * PAUSE
 * ============================
 */

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


/*
 * ============================
 * RÉPONSE JSON
 * ============================
 */

function jsonResponse(
    data,
    status = 200
) {

    return new Response(
        JSON.stringify(
            data
        ),
        {
            status,

            headers: {

                "Content-Type":
                    "application/json; charset=utf-8",

                "Cache-Control":
                    "no-store"

            }
        }
    );

}
