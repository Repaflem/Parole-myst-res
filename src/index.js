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
   ARTISTES ET GENRES
   ========================================================= */

/*
 * Un artiste peut appartenir à plusieurs genres.
 *
 * Le filtre de genre est donc basé sur ce catalogue
 * contrôlé plutôt que sur une interprétation aléatoire
 * des tags MusicBrainz.
 */

const artistGenres = {

    /* =====================================================
       CHANSON FRANÇAISE
       ===================================================== */

    "chanson-francaise": [

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
        "Joe Dassin",
        "Michel Berger",
        "Alain Souchon",
        "Laurent Voulzy",
        "Serge Gainsbourg",
        "Georges Brassens",
        "Maxime Le Forestier",
        "Patrick Bruel",
        "Florent Pagny",
        "Calogero",
        "Christophe Maé",
        "Zaz",
        "Vianney",
        "Julien Doré",
        "Clara Luciani",
        "Louane",
        "Kendji Girac",
        "M. Pokora",
        "Patrick Fiori",
        "Garou",
        "Pascal Obispo",
        "Amel Bent",
        "Christophe Willem",
        "Soprano",
        "Grand Corps Malade",
        "Zaho de Sagazan",
        "Slimane"
    ],


    /* =====================================================
       POP
       ===================================================== */

    "pop": [

        "Stromae",
        "Angèle",
        "Louane",
        "Vianney",
        "Clara Luciani",
        "Julien Doré",
        "Zaz",
        "Calogero",
        "Christophe Maé",
        "Aya Nakamura",

        "Michael Jackson",
        "The Weeknd",
        "Coldplay",
        "Ed Sheeran",
        "Adele",
        "Lady Gaga",
        "Rihanna",
        "Bruno Mars",
        "Madonna",
        "Taylor Swift",
        "Billie Eilish",
        "Justin Timberlake",
        "Britney Spears",
        "Katy Perry",
        "Maroon 5",
        "Imagine Dragons",
        "Dua Lipa",
        "Harry Styles",
        "Justin Bieber",
        "Sia",
        "Miley Cyrus",
        "P!nk",
        "Shakira",
        "Beyoncé",
        "Christina Aguilera",
        "Kesha",
        "Ariana Grande",
        "Selena Gomez",
        "Sam Smith"
    ],


    /* =====================================================
       ROCK
       ===================================================== */

    "rock": [

        "Indochine",
        "Téléphone",
        "Johnny Hallyday",
        "Noir Désir",
        "Louise Attaque",
        "Mickey 3D",
        "Superbus",
        "Kyo",

        "Queen",
        "The Beatles",
        "The Rolling Stones",
        "David Bowie",
        "Oasis",
        "Nirvana",
        "The Police",
        "Red Hot Chili Peppers",
        "Green Day",
        "Linkin Park",
        "U2",
        "AC/DC",
        "Bon Jovi",
        "Aerosmith",
        "Guns N' Roses",
        "The Cranberries",
        "Muse",
        "Radiohead",
        "Foo Fighters",
        "Arctic Monkeys",
        "The Killers",
        "Maroon 5",
        "Imagine Dragons",
        "Coldplay",
        "Elton John",
        "Lenny Kravitz",
        "Sting"
    ],


    /* =====================================================
       RAP / HIP-HOP
       ===================================================== */

    "rap": [

        "Orelsan",
        "Soprano",
        "Bigflo & Oli",
        "Maître Gims",
        "Gims",
        "Nekfeu",
        "Booba",
        "Jul",
        "Ninho",
        "SCH",
        "PNL",
        "Vald",
        "Damso",
        "Lomepal",
        "Kery James",
        "MC Solaar",
        "IAM",
        "NTM",
        "Diam's",
        "Stromae",
        "Aya Nakamura",

        "Eminem",
        "Dr. Dre",
        "Snoop Dogg",
        "50 Cent",
        "Tupac Shakur",
        "The Notorious B.I.G.",
        "Jay-Z",
        "Kanye West",
        "Kendrick Lamar",
        "Drake",
        "Nicki Minaj",
        "Cardi B",
        "Post Malone",
        "Macklemore",
        "Will Smith",
        "Coolio",
        "Black Eyed Peas",
        "Beastie Boys"
    ],


    /* =====================================================
       DISCO / FUNK
       ===================================================== */

    "disco-funk": [

        "France Gall",
        "Dalida",
        "Claude François",
        "Sheila",
        "Ottawan",
        "Patrick Hernandez",
        "Cerrone",

        "ABBA",
        "Earth, Wind & Fire",
        "Kool & The Gang",
        "Chic",
        "Bee Gees",
        "Donna Summer",
        "Gloria Gaynor",
        "Village People",
        "Boney M.",
        "KC and the Sunshine Band",
        "Sister Sledge",
        "Chaka Khan",
        "Stevie Wonder",
        "Michael Jackson",
        "Prince",
        "James Brown",
        "Diana Ross",
        "The Jacksons",
        "Commodores",
        "Rick James",
        "George Clinton"
    ],


    /* =====================================================
       ÉLECTRO
       ===================================================== */

    "electro": [

        "Daft Punk",
        "David Guetta",
        "Justice",
        "Stromae",
        "Kavinsky",
        "Martin Solveig",
        "Bob Sinclar",
        "Madeon",
        "M83",
        "Air",
        "Cassius",
        "The Blaze",
        "Breakbot",
        "Étienne de Crécy",

        "The Chemical Brothers",
        "The Prodigy",
        "Fatboy Slim",
        "Calvin Harris",
        "Avicii",
        "Deadmau5",
        "Skrillex",
        "Disclosure",
        "Swedish House Mafia",
        "Tiesto",
        "Martin Garrix",
        "Kygo",
        "Alan Walker",
        "Marshmello",
        "Major Lazer",
        "Clean Bandit",
        "Pet Shop Boys",
        "Depeche Mode"
    ],


    /* =====================================================
       METAL
       ===================================================== */

    "metal": [

        "Metallica",
        "Iron Maiden",
        "Black Sabbath",
        "Judas Priest",
        "Megadeth",
        "Slayer",
        "Anthrax",
        "Pantera",
        "Slipknot",
        "Rammstein",
        "System of a Down",
        "Korn",
        "Linkin Park",
        "Evanescence",
        "Nightwish",
        "Within Temptation",
        "Sabaton",
        "Bring Me the Horizon",
        "Avenged Sevenfold",
        "Disturbed",
        "Tool",
        "Gojira",
        "Mastodon",
        "Dream Theater",
        "Scorpions",
        "Kiss",
        "Europe",
        "Alice Cooper",
        "Marilyn Manson",
        "Papa Roach"
    ],


    /* =====================================================
       INTERNATIONAL
       ===================================================== */

    "international": [

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
        "The Police",
        "U2",
        "AC/DC",
        "Bon Jovi",
        "Aerosmith",
        "Guns N' Roses",
        "Metallica",
        "Iron Maiden",
        "Rammstein",
        "Daft Punk",
        "David Guetta",
        "The Chemical Brothers",
        "Eminem",
        "Drake",
        "Beyoncé",
        "Shakira",
        "Dua Lipa",
        "Harry Styles",
        "Justin Bieber"
    ]
};


/* =========================================================
   ARTISTES FRANÇAIS
   ========================================================= */

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
    "Aya Nakamura",
    "Nekfeu",
    "Booba",
    "Jul",
    "Ninho",
    "SCH",
    "PNL",
    "Damso",
    "Kery James",
    "MC Solaar",
    "IAM",
    "NTM",
    "Diam's",
    "Daft Punk",
    "David Guetta",
    "Justice",
    "Kavinsky",
    "Martin Solveig",
    "Bob Sinclar",
    "M83",
    "Air",
    "Metallica",
    "Gojira",
    "Zaho de Sagazan",
    "Slimane"
];


/* =========================================================
   ARTISTES ANGLAIS / INTERNATIONAUX
   ========================================================= */

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
    "The Police",
    "U2",
    "AC/DC",
    "Bon Jovi",
    "Aerosmith",
    "Guns N' Roses",
    "Metallica",
    "Iron Maiden",
    "Black Sabbath",
    "Rammstein",
    "Slipknot",
    "System of a Down",
    "Evanescence",
    "Scorpions",
    "Daft Punk",
    "David Guetta",
    "The Chemical Brothers",
    "Calvin Harris",
    "Avicii",
    "Skrillex",
    "Drake",
    "Beyoncé",
    "Shakira",
    "Dua Lipa",
    "Harry Styles",
    "Justin Bieber",
    "Ariana Grande",
    "Sam Smith"
];


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
       CONSTRUCTION DU CATALOGUE SELON LE GENRE
       ===================================================== */

    let artists = [];


    if (genre === "all") {

        /*
         * Tous les artistes compatibles avec la langue.
         */

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

    } else {

        /*
         * On récupère uniquement les artistes
         * appartenant au genre demandé.
         */

        const genreArtists =
            artistGenres[genre] || [];


        if (language === "fr") {

            artists =
                genreArtists.filter(
                    artist =>
                        frenchArtists.includes(
                            artist
                        )
                );

        } else if (language === "en") {

            artists =
                genreArtists.filter(
                    artist =>
                        englishArtists.includes(
                            artist
                        )
                );

        } else {

            artists = [
                ...genreArtists
            ];
        }
    }


    /*
     * Suppression des doublons.
     */

    artists =
        [
            ...new Map(
                artists.map(
                    artist => [
                        normalizeArtistName(
                            artist
                        ),
                        artist
                    ]
                )
            ).values()
        ];


    /*
     * Mélange aléatoire.
     */

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


            let artistQuestion =
                null;


            /* =================================================
               RECHERCHE D'UNE CHANSON
               ================================================= */

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


                /* =================================================
                   RECHERCHE DES PAROLES
                   ================================================= */

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
                 * Création de l'extrait.
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


            /*
             * Petite pause afin de ne pas bombarder
             * MusicBrainz.
             */

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
   SÉLECTION DE L'EXTRAIT
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


    const normalizedTitle =
        normalizeText(
            title
        );


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
         * Évite le titre de la chanson.
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
         * Évite les phrases trop courtes.
         */

        if (
            firstLine.length < 20 ||
            secondLine.length < 20
        ) {
            continue;
        }


        /*
         * Évite les passages avec beaucoup
         * de mots répétés.
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
     * On préfère les passages situés
     * au milieu de la chanson.
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
