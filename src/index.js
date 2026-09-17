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

            return await generateQuestions(url);

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
            await fetch(lrclibUrl);


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
 * CATALOGUE DES ARTISTES
 * ============================
 */

const artistGenres = {

    "chanson-francaise": [

        "Jean-Jacques Goldman",
        "Mylène Farmer",
        "Renaud",
        "Dalida",
        "Slimane",
        "Jacques Brel",
        "Téléphone",
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
        "Pascal Obispo"

    ],


    pop: [

        "Mylène Farmer",
        "Jean-Jacques Goldman",
        "France Gall",
        "Calogero",
        "Zaz",
        "Vianney",
        "Taylor Swift",
        "Lady Gaga",
        "Katy Perry",
        "Adele",
        "Bruno Mars",
        "Ed Sheeran",
        "Justin Timberlake",
        "Michael Jackson",
        "Madonna",
        "Britney Spears",
        "Rihanna",
        "Beyoncé",
        "The Weeknd",
        "Dua Lipa",
        "Harry Styles",
        "Billie Eilish"

    ],


    rock: [

        "Téléphone",
        "Noir Désir",
        "Indochine",
        "Trust",
        "Eiffel",
        "Louise Attaque",
        "Queen",
        "The Beatles",
        "The Rolling Stones",
        "Nirvana",
        "AC/DC",
        "Guns N' Roses",
        "Metallica",
        "U2",
        "Coldplay",
        "The Police",
        "Red Hot Chili Peppers",
        "Linkin Park",
        "Foo Fighters",
        "Green Day"

    ],


    rap: [

        "IAM",
        "NTM",
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
        "Eminem",
        "Dr. Dre",
        "Snoop Dogg",
        "Kendrick Lamar",
        "Jay-Z",
        "50 Cent",
        "Tupac"

    ],


    "disco-funk": [

        "Earth, Wind & Fire",
        "ABBA",
        "Bee Gees",
        "Boney M.",
        "Donna Summer",
        "Chic",
        "Kool & The Gang",
        "Michael Jackson",
        "Prince",
        "James Brown",
        "Stevie Wonder",
        "KC and the Sunshine Band"

    ],


    electro: [

        "Daft Punk",
        "Justice",
        "David Guetta",
        "Martin Solveig",
        "Stromae",
        "The Chemical Brothers",
        "The Prodigy",
        "Calvin Harris",
        "Avicii",
        "Kavinsky",
        "Deadmau5"

    ],


    metal: [

        "Metallica",
        "Iron Maiden",
        "Black Sabbath",
        "Judas Priest",
        "Slipknot",
        "Rammstein",
        "System of a Down",
        "Megadeth",
        "Pantera",
        "Linkin Park",
        "Nightwish"

    ],


    international: [

        "The Beatles",
        "Queen",
        "Michael Jackson",
        "Madonna",
        "ABBA",
        "Nirvana",
        "Metallica",
        "Eminem",
        "Rihanna",
        "Beyoncé",
        "Taylor Swift",
        "Adele",
        "Bruno Mars",
        "The Weeknd",
        "Ed Sheeran",
        "Lady Gaga",
        "Coldplay",
        "AC/DC",
        "U2",
        "Prince"

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


    /*
     * Choix du catalogue.
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

    shuffleArray(artists);


    const questions = [];


    /*
     * On donne davantage de tentatives
     * que le nombre de questions demandé
     * afin de compenser les chansons
     * qui peuvent être rejetées.
     */

    const maxAttempts =
        Math.max(
            artists.length * 3,
            number * 5
        );


    let attempts = 0;


    while (
        questions.length < number &&
        attempts < maxAttempts
    ) {

        attempts++;


        /*
         * S'il n'y a plus d'artistes,
         * on recommence avec le catalogue
         * mélangé.
         */

        if (artists.length === 0) {

            artists =
                [...allArtists];

            shuffleArray(artists);

        }


        const artist =
            artists.shift();


        if (!artist) {

            continue;

        }


        try {

            /*
             * Recherche MusicBrainz.
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


            if (!musicBrainzResponse.ok) {

                await sleep(250);

                continue;

            }


            const musicBrainzData =
                await musicBrainzResponse.json();


            const recordings =
                musicBrainzData.recordings ||
                [];


            if (recordings.length === 0) {

                await sleep(250);

                continue;

            }


            /*
             * On mélange les résultats
             * afin d'éviter d'avoir toujours
             * la même chanson.
             */

            shuffleArray(recordings);


            let validRecording = null;
            let lyricsData = null;
            let detectedLanguage = null;


            /*
             * Plusieurs chansons sont essayées
             * jusqu'à trouver une combinaison
             * compatible avec les filtres.
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
                 * Vérification de l'époque.
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
                 * Recherche des paroles.
                 */

                try {

                    const lrclibUrl =
                        "https://lrclib.net/api/get" +
                        "?artist_name=" +
                        encodeURIComponent(recordingArtist) +
                        "&track_name=" +
                        encodeURIComponent(recordingTitle);


                    const lyricsResponse =
                        await fetch(
                            lrclibUrl
                        );


                    if (!lyricsResponse.ok) {

                        continue;

                    }


                    const data =
                        await lyricsResponse.json();


                    const fullLyrics =
                        data.plainLyrics ||
                        "";


                    if (
                        !fullLyrics ||
                        fullLyrics.length < 100
                    ) {

                        continue;

                    }


                    /*
                     * Détection de langue.
                     */

                    const languageDetected =
                        detectLyricsLanguage(
                            fullLyrics
                        );


                    if (
                        !matchesLanguage(
                            languageDetected,
                            language
                        )
                    ) {

                        continue;

                    }


                    /*
                     * Création de l'extrait
                     * en fonction de la difficulté.
                     */

                    const excerpt =
                        createLyricsExcerpt(
                            fullLyrics,
                            recordingTitle,
                            difficulty
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
                            languageDetected

                    };


                    lyricsData = data;

                    detectedLanguage =
                        languageDetected;


                    break;


                } catch (error) {

                    continue;

                }

            }


            if (!validRecording) {

                await sleep(250);

                continue;

            }


            /*
             * Ajout de la question.
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
                    genre

            });


            /*
             * Petite pause pour éviter
             * d'interroger trop rapidement
             * les services externes.
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
     * Réponse finale.
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
 */

function detectLyricsLanguage(lyrics) {

    const text =
        normalizeText(lyrics);


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
        "veux",
        "vais",
        "va",
        "moi",
        "toi"

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
        "got"

    ];


    let frenchScore = 0;
    let englishScore = 0;


    for (
        const word of frenchWords
    ) {

        if (
            text.includes(
                ` ${word} `
            )
        ) {

            frenchScore++;

        }

    }


    for (
        const word of englishWords
    ) {

        if (
            text.includes(
                ` ${word} `
            )
        ) {

            englishScore++;

        }

    }


    /*
     * Les accents sont un indicateur
     * supplémentaire du français.
     */

    const accentMatches =
        lyrics.match(
            /[àâäçéèêëîïôöùûüÿœæ]/gi
        );


    if (accentMatches) {

        frenchScore += 2;

    }


    if (
        frenchScore === 0 &&
        englishScore === 0
    ) {

        return "unknown";

    }


    if (
        frenchScore >= englishScore
    ) {

        return "fr";

    }


    return "en";

}


/*
 * ============================
 * CORRESPONDANCE DE LANGUE
 * ============================
 */

function matchesLanguage(
    detectedLanguage,
    requestedLanguage
) {

    if (
        requestedLanguage === "both"
    ) {

        return (
            detectedLanguage === "fr" ||
            detectedLanguage === "en"
        );

    }


    if (
        requestedLanguage === "fr"
    ) {

        return detectedLanguage === "fr";

    }


    if (
        requestedLanguage === "en"
    ) {

        return detectedLanguage === "en";

    }


    return true;

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


    if (
        !releaseDate
    ) {

        return false;

    }


    const year =
        Number(
            String(releaseDate)
                .substring(0, 4)
        );


    if (
        !year
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


/*
 * ============================
 * CRÉATION DE L'EXTRAIT
 * ============================
 *
 * La difficulté agit réellement ici.
 *
 * FACILE :
 * - privilégie les passages situés
 *   au début de la chanson ou dans
 *   les zones centrales.
 *
 * MOYEN :
 * - sélection équilibrée dans toute
 *   la chanson.
 *
 * DIFFICILE :
 * - privilégie les passages moins
 *   évidents, plutôt éloignés du début.
 *
 * ALL :
 * - totalement aléatoire.
 */

function createLyricsExcerpt(
    lyrics,
    title,
    difficulty = "all"
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


    /*
     * Il faut suffisamment de lignes
     * pour fabriquer un extrait.
     */

    if (
        lines.length < 4
    ) {

        return null;

    }


    const normalizedTitle =
        normalizeText(title);


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
            normalizeText(combined);


        /*
         * Ne pas afficher le titre
         * directement dans l'extrait.
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
            normalizeText(firstLine) ===
            normalizeText(secondLine)
        ) {

            continue;

        }


        /*
         * Évite les extraits bourrés
         * de répétitions.
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
                i,

            position:
                i /
                Math.max(
                    lines.length - 1,
                    1
                )

        });

    }


    if (
        candidates.length === 0
    ) {

        return null;

    }


    /*
     * ============================
     * DIFFICULTÉ : ALÉATOIRE
     * ============================
     */

    if (
        difficulty === "all"
    ) {

        const randomIndex =
            Math.floor(
                Math.random() *
                candidates.length
            );


        return candidates[
            randomIndex
        ].text;

    }


    /*
     * ============================
     * CALCUL DU SCORE
     * ============================
     *
     * On donne à chaque extrait
     * une probabilité différente
     * selon sa position.
     *
     * Cela évite que la difficulté
     * soit trop rigide.
     */


    const scoredCandidates =
        candidates.map(
            candidate => {

                let score =
                    Math.random();


                const position =
                    candidate.position;


                /*
                 * FACILE
                 *
                 * On favorise :
                 * - début de chanson
                 * - premier tiers
                 * - zone centrale
                 *
                 * Le hasard reste présent.
                 */

                if (
                    difficulty === "easy"
                ) {

                    if (
                        position < 0.35
                    ) {

                        score += 4;

                    } else if (
                        position < 0.65
                    ) {

                        score += 2;

                    } else {

                        score += 0.5;

                    }

                }


                /*
                 * MOYEN
                 *
                 * On favorise surtout
                 * les zones centrales.
                 */

                else if (
                    difficulty === "medium"
                ) {

                    const distance =
                        Math.abs(
                            position - 0.5
                        );


                    score +=
                        Math.max(
                            0,
                            3 -
                            distance * 6
                        );

                }


                /*
                 * DIFFICILE
                 *
                 * On favorise les passages
                 * plus éloignés du début.
                 *
                 * Le score est également
                 * légèrement meilleur dans
                 * les zones très éloignées
                 * du centre.
                 */

                else if (
                    difficulty === "hard"
                ) {

                    if (
                        position >= 0.65
                    ) {

                        score += 4;

                    } else if (
                        position >= 0.45
                    ) {

                        score += 2.5;

                    } else {

                        score += 0.5;

                    }

                }


                return {

                    ...candidate,

                    score

                };

            }
        );


    /*
     * On trie les candidats par score.
     */

    scoredCandidates.sort(
        (
            a,
            b
        ) =>
            b.score -
            a.score
    );


    /*
     * On ne prend pas systématiquement
     * le meilleur candidat.
     *
     * Les 5 meilleurs sont considérés,
     * puis l'un d'eux est choisi
     * aléatoirement.
     *
     * Cela permet d'avoir une vraie
     * variation d'une partie à l'autre.
     */

    const poolSize =
        Math.min(
            5,
            scoredCandidates.length
        );


    const selectedIndex =
        Math.floor(
            Math.random() *
            poolSize
        );


    return scoredCandidates[
        selectedIndex
    ].text;

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
        normalizeText(text)
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


        /*
         * Si un même mot apparaît
         * trois fois ou plus dans
         * un extrait de deux lignes,
         * celui-ci est probablement
         * peu intéressant.
         */

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
