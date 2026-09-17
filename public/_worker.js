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
         * sont envoyées vers /public.
         */

        return env.ASSETS.fetch(request);

    }
};


/*
 * ============================
 * CACHE LAST.FM
 * ============================
 */

const lastFmCache = new Map();

const LASTFM_CACHE_DURATION =
    30 * 60 * 1000;


/*
 * ============================
 * CACHE LRCLIB
 * ============================
 */

const lyricsCache = new Map();

const LYRICS_CACHE_DURATION =
    60 * 60 * 1000;


/*
 * ============================
 * CACHE MUSICBRAINZ
 * ============================
 */

const musicBrainzCache = new Map();

const MUSICBRAINZ_CACHE_DURATION =
    60 * 60 * 1000;


/*
 * ============================
 * PARAMÈTRES
 * ============================
 */

const MAX_MUSICBRAINZ_RECORDINGS = 12;

const MAX_LYRICS_CANDIDATES = 6;

const REQUEST_TIMEOUT = 5000;


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
            await fetchWithTimeout(
                musicBrainzUrl,
                {
                    headers: {
                        "User-Agent":
                            "ParolesMysteres/1.0 (Cloudflare Worker)"
                    }
                },
                REQUEST_TIMEOUT
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

                    const recordingArtist =
                        getRecordingArtist(
                            recording,
                            artist
                        );


                    const firstReleaseDate =
                        getReleaseDate(
                            recording
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

        const data =
            await fetchLyrics(
                artist,
                title
            );


        if (!data) {

            return jsonResponse(
                {
                    success: false,
                    error:
                        "LRCLIB n'a pas trouvé les paroles."
                },
                404
            );

        }


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
 * RÉCUPÉRATION DES PAROLES
 * ============================
 */

async function fetchLyrics(
    artist,
    title
) {

    const cacheKey =
        `lyrics:${normalizeArtistName(artist)}:${normalizeText(title)}`;


    const cached =
        lyricsCache.get(
            cacheKey
        );


    if (
        cached &&
        (
            Date.now() -
            cached.timestamp
        ) <
        LYRICS_CACHE_DURATION
    ) {

        return cached.data;

    }


    try {

        const lrclibUrl =
            "https://lrclib.net/api/get" +
            "?artist_name=" +
            encodeURIComponent(artist) +
            "&track_name=" +
            encodeURIComponent(title);


        const response =
            await fetchWithTimeout(
                lrclibUrl,
                {},
                REQUEST_TIMEOUT
            );


        if (!response.ok) {

            return null;

        }


        const data =
            await response.json();


        lyricsCache.set(
            cacheKey,
            {
                timestamp:
                    Date.now(),

                data:
                    data
            }
        );


        return data;


    } catch (error) {

        return null;

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
            await fetchWithTimeout(
                lastFmUrl,
                {
                    headers: {

                        "User-Agent":
                            "ParolesMysteres/1.0 (Cloudflare Worker)"

                    }
                },
                REQUEST_TIMEOUT
            );


        if (!response.ok) {

            return null;

        }


        const data =
            await response.json();


        if (data.error) {

            return null;

        }


        const track =
            data.track;


        if (!track) {

            return null;

        }


        const result = {

            listeners:
                Number(
                    track.listeners
                ) || 0,

            playcount:
                Number(
                    track.playcount
                ) || 0,

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

        return null;

    }

}


/*
 * ============================
 * DIFFICULTÉ
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
 * FILTRE DES TITRES
 * ============================
 */

function isBadRecordingTitle(
    title
) {

    if (!title) {

        return true;

    }


    const normalized =
        normalizeText(
            title
        );


    const forbiddenTerms = [

        "live",
        "concert",
        "remix",
        "remaster",
        "remastered",
        "instrumental",
        "karaoke",
        "acapella",
        "a cappella",
        "demo",
        "radio edit",
        "radio version",
        "edit",
        "version",
        "version longue",
        "extended",
        "mono",
        "stereo",
        "alternate",
        "alternative",
        "reprise",
        "cover",
        "tribute",
        "dub",
        "mix"

    ];


    return forbiddenTerms.some(
        term =>
            normalized.includes(
                normalizeText(term)
            )
    );

}


/*
 * ============================
 * CATALOGUE DES ARTISTES
 * ============================
 */

const artistGenres = {

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


    shuffleArray(
        artists
    );


    /*
     * Questions finales.
     */

    const questions = [];


    /*
     * Pour éviter les doublons.
     */

    const usedSongs =
        new Set();


    /*
     * Nombre d'artistes à tester.
     */

    const maxArtists =
        Math.min(
            artists.length,
            Math.max(
                number * 3,
                12
            )
        );


    /*
     * On récupère d'abord les
     * artistes disponibles.
     */

    const artistsToSearch =
        artists.slice(
            0,
            maxArtists
        );


    /*
     * ============================
     * MUSICBRAINZ EN PARALLÈLE
     * ============================
     *
     * On ne fait qu'une requête
     * MusicBrainz par artiste.
     */

    const artistResults =
        await Promise.all(
            artistsToSearch.map(
                artist =>
                    getMusicBrainzRecordings(
                        artist
                    )
            )
        );


    /*
     * ============================
     * CANDIDATS
     * ============================
     */

    const candidates = [];


    for (
        let i = 0;
        i < artistResults.length;
        i++
    ) {

        const artist =
            artistsToSearch[i];


        const recordings =
            artistResults[i];


        if (!recordings.length) {

            continue;

        }


        shuffleArray(
            recordings
        );


        /*
         * On ne garde qu'un nombre
         * limité de candidats par artiste.
         */

        const limited =
            recordings.slice(
                0,
                MAX_MUSICBRAINZ_RECORDINGS
            );


        for (
            const recording of limited
        ) {

            const title =
                recording.title;


            if (
                isBadRecordingTitle(
                    title
                )
            ) {

                continue;

            }


            if (
                !matchesEra(
                    recording.firstReleaseDate,
                    era
                )
            ) {

                continue;

            }


            const recordingArtist =
                getRecordingArtist(
                    recording,
                    artist
                );


            const songKey =
                `${normalizeArtistName(recordingArtist)}::${normalizeText(title)}`;


            if (
                usedSongs.has(songKey)
            ) {

                continue;

            }


            candidates.push({

                ...recording,

                artist:
                    recordingArtist,

                songKey

            });

        }

    }


    /*
     * Mélange global des candidats.
     */

    shuffleArray(
        candidates
    );


    /*
     * ============================
     * DIFFICULTÉ "ALL"
     * ============================
     *
     * Aucun appel Last.fm.
     */

    if (
        difficulty === "all"
    ) {

        /*
         * On limite le nombre de requêtes
         * LRCLIB.
         */

        const lyricCandidates =
            candidates.slice(
                0,
                Math.max(
                    number * 4,
                    20
                )
            );


        /*
         * LRCLIB en parallèle.
         */

        const lyricResults =
            await Promise.all(
                lyricCandidates.map(
                    async candidate => {

                        const lyricsData =
                            await fetchLyrics(
                                candidate.artist,
                                candidate.title
                            );


                        return {

                            candidate,

                            lyricsData

                        };

                    }
                )
            );


        for (
            const result of lyricResults
        ) {

            if (
                questions.length >= number
            ) {

                break;

            }


            const candidate =
                result.candidate;


            const data =
                result.lyricsData;


            if (!data) {

                continue;

            }


            const fullLyrics =
                data.plainLyrics ||
                "";


            if (
                fullLyrics.length < 100
            ) {

                continue;

            }


            const languageDetected =
                detectLyricsLanguage(
                    fullLyrics
                );


            if (
                languageDetected !== "fr"
            ) {

                continue;

            }


            const excerpt =
                createLyricsExcerpt(
                    fullLyrics,
                    candidate.title
                );


            if (!excerpt) {

                continue;

            }


            if (
                usedSongs.has(
                    candidate.songKey
                )
            ) {

                continue;

            }


            usedSongs.add(
                candidate.songKey
            );


            questions.push({

                artist:
                    candidate.artist,

                title:
                    candidate.title,

                lyrics:
                    excerpt,

                difficulty:
                    difficulty,

                year:
                    candidate.firstReleaseDate,

                language:
                    "fr",

                genre:
                    genre,

                popularity:
                    null,

                playcount:
                    null,

                lastFmUrl:
                    null

            });

        }

    } else {

        /*
         * ============================
         * DIFFICULTÉ FILTRÉE
         * ============================
         *
         * Last.fm est nécessaire.
         */

        const popularityCandidates =
            candidates.slice(
                0,
                Math.max(
                    number * 5,
                    25
                )
            );


        /*
         * Last.fm en parallèle.
         */

        const popularityResults =
            await Promise.all(
                popularityCandidates.map(
                    async candidate => {

                        const lastFmInfo =
                            await getLastFmTrackInfo(
                                env,
                                candidate.artist,
                                candidate.title,
                                candidate.id
                            );


                        return {

                            candidate,

                            lastFmInfo

                        };

                    }
                )
            );


        /*
         * On garde uniquement
         * les chansons correspondant
         * à la difficulté.
         */

        const difficultyCandidates =
            popularityResults.filter(
                result =>
                    matchesDifficulty(
                        result.lastFmInfo,
                        difficulty
                    )
            );


        /*
         * LRCLIB en parallèle.
         */

        const lyricCandidates =
            difficultyCandidates.slice(
                0,
                Math.max(
                    number * 3,
                    15
                )
            );


        const lyricResults =
            await Promise.all(
                lyricCandidates.map(
                    async result => {

                        const lyricsData =
                            await fetchLyrics(
                                result.candidate.artist,
                                result.candidate.title
                            );


                        return {

                            ...result,

                            lyricsData

                        };

                    }
                )
            );


        for (
            const result of lyricResults
        ) {

            if (
                questions.length >= number
            ) {

                break;

            }


            const candidate =
                result.candidate;


            const data =
                result.lyricsData;


            if (!data) {

                continue;

            }


            const fullLyrics =
                data.plainLyrics ||
                "";


            if (
                fullLyrics.length < 100
            ) {

                continue;

            }


            const languageDetected =
                detectLyricsLanguage(
                    fullLyrics
                );


            if (
                languageDetected !== "fr"
            ) {

                continue;

            }


            const excerpt =
                createLyricsExcerpt(
                    fullLyrics,
                    candidate.title
                );


            if (!excerpt) {

                continue;

            }


            if (
                usedSongs.has(
                    candidate.songKey
                )
            ) {

                continue;

            }


            usedSongs.add(
                candidate.songKey
            );


            questions.push({

                artist:
                    candidate.artist,

                title:
                    candidate.title,

                lyrics:
                    excerpt,

                difficulty:
                    difficulty,

                year:
                    candidate.firstReleaseDate,

                language:
                    "fr",

                genre:
                    genre,

                popularity:
                    result.lastFmInfo
                        ? result.lastFmInfo.listeners
                        : null,

                playcount:
                    result.lastFmInfo
                        ? result.lastFmInfo.playcount
                        : null,

                lastFmUrl:
                    result.lastFmInfo
                        ? result.lastFmInfo.url
                        : null

            });

        }

    }


    /*
     * ============================
     * SECONDE CHANCE
     * ============================
     *
     * Si trop peu de questions ont
     * été trouvées, on tente quelques
     * candidats supplémentaires.
     */

    if (
        questions.length < number
    ) {

        const remainingCandidates =
            candidates.filter(
                candidate =>
                    !usedSongs.has(
                        candidate.songKey
                    )
            );


        const additional =
            remainingCandidates.slice(
                0,
                10
            );


        /*
         * Pour les difficultés filtrées,
         * on repasse par Last.fm.
         */

        if (
            difficulty !== "all"
        ) {

            const additionalResults =
                await Promise.all(
                    additional.map(
                        async candidate => {

                            const lastFmInfo =
                                await getLastFmTrackInfo(
                                    env,
                                    candidate.artist,
                                    candidate.title,
                                    candidate.id
                                );


                            if (
                                !matchesDifficulty(
                                    lastFmInfo,
                                    difficulty
                                )
                            ) {

                                return null;

                            }


                            const lyricsData =
                                await fetchLyrics(
                                    candidate.artist,
                                    candidate.title
                                );


                            return {

                                candidate,

                                lastFmInfo,

                                lyricsData

                            };

                        }
                    )
                );


            for (
                const result of additionalResults
            ) {

                if (
                    !result ||
                    questions.length >= number
                ) {

                    break;

                }


                const data =
                    result.lyricsData;


                if (!data) {

                    continue;

                }


                const fullLyrics =
                    data.plainLyrics ||
                    "";


                if (
                    fullLyrics.length < 100
                ) {

                    continue;

                }


                if (
                    detectLyricsLanguage(
                        fullLyrics
                    ) !== "fr"
                ) {

                    continue;

                }


                const excerpt =
                    createLyricsExcerpt(
                        fullLyrics,
                        result.candidate.title
                    );


                if (!excerpt) {

                    continue;

                }


                usedSongs.add(
                    result.candidate.songKey
                );


                questions.push({

                    artist:
                        result.candidate.artist,

                    title:
                        result.candidate.title,

                    lyrics:
                        excerpt,

                    difficulty:
                        difficulty,

                    year:
                        result.candidate.firstReleaseDate,

                    language:
                        "fr",

                    genre:
                        genre,

                    popularity:
                        result.lastFmInfo.listeners,

                    playcount:
                        result.lastFmInfo.playcount,

                    lastFmUrl:
                        result.lastFmInfo.url

                });

            }

        } else {

            const additionalResults =
                await Promise.all(
                    additional.map(
                        async candidate => {

                            const lyricsData =
                                await fetchLyrics(
                                    candidate.artist,
                                    candidate.title
                                );


                            return {

                                candidate,

                                lyricsData

                            };

                        }
                    )
                );


            for (
                const result of additionalResults
            ) {

                if (
                    questions.length >= number
                ) {

                    break;

                }


                const data =
                    result.lyricsData;


                if (!data) {

                    continue;

                }


                const fullLyrics =
                    data.plainLyrics ||
                    "";


                if (
                    fullLyrics.length < 100
                ) {

                    continue;

                }


                if (
                    detectLyricsLanguage(
                        fullLyrics
                    ) !== "fr"
                ) {

                    continue;

                }


                const excerpt =
                    createLyricsExcerpt(
                        fullLyrics,
                        result.candidate.title
                    );


                if (!excerpt) {

                    continue;

                }


                usedSongs.add(
                    result.candidate.songKey
                );


                questions.push({

                    artist:
                        result.candidate.artist,

                    title:
                        result.candidate.title,

                    lyrics:
                        excerpt,

                    difficulty:
                        difficulty,

                    year:
                        result.candidate.firstReleaseDate,

                    language:
                        "fr",

                    genre:
                        genre,

                    popularity:
                        null,

                    playcount:
                        null,

                    lastFmUrl:
                        null

                });

            }

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
 * RÉCUPÉRATION MUSICBRAINZ
 * ============================
 */

async function getMusicBrainzRecordings(
    artist
) {

    const cacheKey =
        `mb:${normalizeArtistName(artist)}`;


    const cached =
        musicBrainzCache.get(
            cacheKey
        );


    if (
        cached &&
        (
            Date.now() -
            cached.timestamp
        ) <
        MUSICBRAINZ_CACHE_DURATION
    ) {

        return cached.data;

    }


    try {

        const query =
            `artist:"${artist}"`;

        const musicBrainzUrl =
            "https://musicbrainz.org/ws/2/recording/" +
            "?query=" +
            encodeURIComponent(query) +
            "&fmt=json&limit=" +
            MAX_MUSICBRAINZ_RECORDINGS;


        const response =
            await fetchWithTimeout(
                musicBrainzUrl,
                {
                    headers: {

                        "User-Agent":
                            "ParolesMysteres/1.0 (Cloudflare Worker)"

                    }
                },
                REQUEST_TIMEOUT
            );


        if (!response.ok) {

            return [];

        }


        const data =
            await response.json();


        const recordings =
            data.recordings || [];


        musicBrainzCache.set(
            cacheKey,
            {
                timestamp:
                    Date.now(),

                data:
                    recordings
            }
        );


        return recordings;


    } catch (error) {

        return [];

    }

}


/*
 * ============================
 * ARTISTE MUSICBRAINZ
 * ============================
 */

function getRecordingArtist(
    recording,
    fallbackArtist
) {

    const artistCredit =
        recording["artist-credit"] ||
        [];


    if (
        artistCredit.length === 0
    ) {

        return fallbackArtist;

    }


    return artistCredit
        .map(
            credit =>
                credit.name ||
                credit.artist?.name ||
                ""
        )
        .join("")
        .trim() ||
        fallbackArtist;

}


/*
 * ============================
 * DATE MUSICBRAINZ
 * ============================
 */

function getReleaseDate(
    recording
) {

    return (
        recording["first-release-date"] ||
        (
            recording.releases &&
            recording.releases.length > 0
                ? recording.releases[0]["date"]
                : null
        )
    );

}


/*
 * ============================
 * DÉTECTION LANGUE
 * ============================
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
        "etre",
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
        "tres",
        "ete",
        "etait",
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
     * Bonus accents.
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


    if (
        englishScore > frenchScore
    ) {

        return "en";

    }


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
 * ÉPOQUE
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
 * EXTRAIT DE PAROLES
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


        if (
            normalizedTitle.length >= 4 &&
            normalizedCombined.includes(
                normalizedTitle
            )
        ) {

            continue;

        }


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
 * RÉPÉTITIONS
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
 * TIMEOUT FETCH
 * ============================
 */

async function fetchWithTimeout(
    url,
    options = {},
    timeout = 5000
) {

    const controller =
        new AbortController();


    const timeoutId =
        setTimeout(
            () =>
                controller.abort(),
            timeout
        );


    try {

        return await fetch(
            url,
            {
                ...options,
                signal:
                    controller.signal
            }
        );

    } finally {

        clearTimeout(
            timeoutId
        );

    }

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
