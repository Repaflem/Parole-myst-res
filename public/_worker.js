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
            return await generateQuestions(url, env);
        }

        return env.ASSETS.fetch(request);
    }
};


/*
 * ============================================================
 * CONFIGURATION
 * ============================================================
 */

const REQUEST_TIMEOUT = 7000;

const LASTFM_CACHE_DURATION = 30 * 60 * 1000;
const LYRICS_CACHE_DURATION = 60 * 60 * 1000;
const MUSICBRAINZ_CACHE_DURATION = 60 * 60 * 1000;

const lastFmCache = new Map();
const lyricsCache = new Map();
const musicBrainzCache = new Map();

const MAX_MUSICBRAINZ_RECORDINGS = 50;
const MAX_CANDIDATES_PER_ARTIST = 10;


/*
 * ============================================================
 * SEUILS DE DIFFICULTÉ
 * ============================================================
 */

const POPULARITY_THRESHOLDS = {
    easy: 300000,
    medium: 30000,
    hard: 0
};


/*
 * ============================================================
 * CATALOGUE DES ARTISTES
 * ============================================================
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

const allArtists = [
    ...new Set(
        Object.values(artistGenres).flat()
    )
];


/*
 * ============================================================
 * OUTILS GÉNÉRAUX
 * ============================================================
 */

function jsonResponse(data, status = 200) {
    return new Response(
        JSON.stringify(data),
        {
            status,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Cache-Control": "no-store"
            }
        }
    );
}


async function fetchWithTimeout(
    url,
    options = {},
    timeout = REQUEST_TIMEOUT
) {
    const controller = new AbortController();

    const timer = setTimeout(
        () => controller.abort(),
        timeout
    );

    try {
        return await fetch(
            url,
            {
                ...options,
                signal: controller.signal
            }
        );
    } finally {
        clearTimeout(timer);
    }
}


function shuffleArray(array) {
    for (
        let i = array.length - 1;
        i > 0;
        i--
    ) {
        const j =
            Math.floor(
                Math.random() * (i + 1)
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


function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(
            /[\u0300-\u036f]/g,
            ""
        )
        .replace(
            /[^a-z0-9\s]/g,
            " "
        )
        .replace(
            /\s+/g,
            " "
        )
        .trim();
}


function normalizeArtistName(name) {
    return normalizeText(name);
}


/*
 * ============================================================
 * API MUSICBRAINZ DIRECTE
 * ============================================================
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
                recording => ({
                    id: recording.id,
                    title:
                        recording.title ||
                        title,
                    artist:
                        getRecordingArtist(
                            recording,
                            artist
                        ),
                    firstReleaseDate:
                        getReleaseDate(
                            recording
                        )
                })
            );

        return jsonResponse({
            success: true,
            results
        });

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
 * ============================================================
 * API LRCLIB DIRECTE
 * ============================================================
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

        return jsonResponse({
            success: true,
            data
        });

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


async function fetchLyrics(
    artist,
    title
) {

    const cacheKey =
        `lyrics:${normalizeArtistName(artist)}:${normalizeText(title)}`;

    const cached =
        lyricsCache.get(cacheKey);

    if (
        cached &&
        Date.now() - cached.timestamp <
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
                lrclibUrl
            );

        if (!response.ok) {
            lyricsCache.set(
                cacheKey,
                {
                    timestamp: Date.now(),
                    data: null
                }
            );

            return null;
        }

        const data =
            await response.json();

        lyricsCache.set(
            cacheKey,
            {
                timestamp: Date.now(),
                data
            }
        );

        return data;

    } catch (error) {
        return null;
    }
}


/*
 * ============================================================
 * LAST.FM
 * ============================================================
 */

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
            "Paroles Mystères : LASTFM_API_KEY absente."
        );

        return null;
    }

    const cacheKey =
        mbid
            ? `mbid:${mbid}`
            : `track:${normalizeArtistName(artist)}:${normalizeText(title)}`;

    const cached =
        lastFmCache.get(cacheKey);

    if (
        cached &&
        Date.now() - cached.timestamp <
        LASTFM_CACHE_DURATION
    ) {
        return cached.data;
    }

    try {

        const params =
            new URLSearchParams({
                method: "track.getInfo",
                api_key: apiKey,
                format: "json",
                autocorrect: "1"
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
                }
            );

        if (!response.ok) {
            return null;
        }

        const data =
            await response.json();

        if (
            data.error ||
            !data.track
        ) {
            return null;
        }

        const track =
            data.track;

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
 * ============================================================
 * DIFFICULTÉ
 * ============================================================
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

    if (lastFmInfo) {

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
                listeners <
                POPULARITY_THRESHOLDS.medium
            );
        }
    }

    /*
     * null = impossible de déterminer la difficulté
     * avec Last.fm.
     */
    return null;
}


/*
 * ============================================================
 * FILTRE DES TITRES INDÉSIRABLES
 * ============================================================
 */

function isBadRecordingTitle(title) {

    if (!title) {
        return true;
    }

    const normalized =
        normalizeText(title);

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
 * ============================================================
 * MUSICBRAINZ - RECHERCHE PAR ARTISTE
 * ============================================================
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
        Date.now() - cached.timestamp <
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
                }
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
 * ============================================================
 * ARTISTE D'UN ENREGISTREMENT
 * ============================================================
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
 * ============================================================
 * DATE DE SORTIE
 * ============================================================
 */

function getReleaseDate(
    recording
) {

    if (!recording) {
        return null;
    }

    if (
        recording["first-release-date"]
    ) {
        return recording[
            "first-release-date"
        ];
    }

    if (
        Array.isArray(
            recording.releases
        ) &&
        recording.releases.length > 0
    ) {

        for (
            const release of
            recording.releases
        ) {

            if (
                release?.date
            ) {
                return release.date;
            }
        }
    }

    return null;
}


/*
 * ============================================================
 * DÉTECTION DU FRANÇAIS
 * ============================================================
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
        "quand",
        "comment",
        "pourquoi",
        "mon",
        "ton",
        "son",
        "ma",
        "ta",
        "sa",
        "on",
        "est",
        "sont",
        "vais",
        "vas",
        "va",
        "veux",
        "peux",
        "peut",
        "sur",
        "sous",
        "entre",
        "bien",
        "mal",
        "moi",
        "toi",
        "lui",
        "eux",
        "ici",
        "la",
        "aussi",
        "encore",
        "toujours",
        "jamais",
        "rien",
        "quelque",
        "chose"
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

    const accentMatches =
        String(lyrics).match(
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
        frenchScore >= englishScore
    ) {
        return "fr";
    }

    if (
        frenchScore >= 1 &&
        englishScore <= 2
    ) {
        return "fr";
    }

    return "unknown";
}


/*
 * ============================================================
 * FILTRE PAR ÉPOQUE
 * ============================================================
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
 * ============================================================
 * EXTRAIT DE PAROLES
 * ============================================================
 */

function createLyricsExcerpt(
    lyrics,
    title
) {

    const lines =
        String(lyrics)
            .split(/\r?\n/)
            .map(
                line =>
                    line
                        .replace(
                            /^\s*\[[^\]]+\]\s*/,
                            ""
                        )
                        .trim()
            )
            .filter(
                line =>
                    line.length >= 20
            );

    if (
        lines.length < 2
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
            normalizeText(firstLine) ===
            normalizeText(secondLine)
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

    shuffleArray(
        candidates
    );

    return candidates[0];
}


/*
 * ============================================================
 * DÉTECTION DES LIGNES TROP RÉPÉTITIVES
 * ============================================================
 */

function hasTooManyRepeatedWords(
    text
) {

    const words =
        normalizeText(text)
            .split(/\s+/)
            .filter(
                word =>
                    word.length >= 3
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

    const maxCount =
        Math.max(
            ...Object.values(counts)
        );

    return (
        maxCount >= 3 &&
        maxCount >=
        Math.ceil(
            words.length * 0.5
        )
    );
}


/*
 * ============================================================
 * GÉNÉRATION DES QUESTIONS
 * ============================================================
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
     * Sélection du catalogue.
     */

    let artists;

    if (
        genre === "all" ||
        !artistGenres[genre]
    ) {
        artists = [
            ...allArtists
        ];
    } else {
        artists = [
            ...artistGenres[genre]
        ];
    }

    shuffleArray(
        artists
    );


    /*
     * On interroge beaucoup plus d'artistes
     * qu'auparavant.
     */

    const maxArtists =
        Math.min(
            artists.length,
            Math.max(
                number * 5,
                20
            )
        );

    const artistsToSearch =
        artists.slice(
            0,
            maxArtists
        );


    /*
     * MusicBrainz.
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
     * Création des candidats.
     */

    const candidates = [];
    const seenSongs = new Set();

    for (
        let i = 0;
        i < artistResults.length;
        i++
    ) {

        const fallbackArtist =
            artistsToSearch[i];

        const recordings =
            artistResults[i];

        if (
            !recordings ||
            recordings.length === 0
        ) {
            continue;
        }

        const usable =
            recordings
                .map(
                    recording => ({
                        ...recording,

                        artist:
                            getRecordingArtist(
                                recording,
                                fallbackArtist
                            ),

                        firstReleaseDate:
                            getReleaseDate(
                                recording
                            )
                    })
                )
                .filter(
                    recording => {

                        if (
                            isBadRecordingTitle(
                                recording.title
                            )
                        ) {
                            return false;
                        }

                        if (
                            !matchesEra(
                                recording.firstReleaseDate,
                                era
                            )
                        ) {
                            return false;
                        }

                        return true;
                    }
                );

        shuffleArray(
            usable
        );

        const limited =
            usable.slice(
                0,
                MAX_CANDIDATES_PER_ARTIST
            );

        for (
            const recording of limited
        ) {

            const songKey =
                `${normalizeArtistName(recording.artist)}::${normalizeText(recording.title)}`;

            if (
                seenSongs.has(songKey)
            ) {
                continue;
            }

            seenSongs.add(
                songKey
            );

            candidates.push({
                ...recording,
                songKey
            });
        }
    }

    shuffleArray(
        candidates
    );


    /*
     * On traite suffisamment de candidats.
     */

    const candidateLimit =
        Math.min(
            candidates.length,
            Math.max(
                number * 12,
                60
            )
        );

    const candidatesToProcess =
        candidates.slice(
            0,
            candidateLimit
        );


    /*
     * LRCLIB + Last.fm.
     */

    const results =
        await Promise.all(
            candidatesToProcess.map(
                async candidate => {

                    const lastFmInfo =
                        difficulty !== "all"
                            ? await getLastFmTrackInfo(
                                env,
                                candidate.artist,
                                candidate.title,
                                candidate.id
                            )
                            : await getLastFmTrackInfo(
                                env,
                                candidate.artist,
                                candidate.title,
                                candidate.id
                            );

                    const difficultyMatch =
                        matchesDifficulty(
                            lastFmInfo,
                            difficulty
                        );

                    const lyricsData =
                        await fetchLyrics(
                            candidate.artist,
                            candidate.title
                        );

                    return {
                        candidate,
                        lastFmInfo,
                        difficultyMatch,
                        lyricsData
                    };
                }
            )
        );


    const questions = [];
    const usedSongs = new Set();


    /*
     * ========================================================
     * PASSAGE 1
     *
     * On prend en priorité les titres dont la difficulté
     * correspond exactement aux données Last.fm.
     * ========================================================
     */

    for (
        const result of results
    ) {

        if (
            questions.length >= number
        ) {
            break;
        }

        if (
            result.difficultyMatch !== true
        ) {
            continue;
        }

        const question =
            buildQuestion(
                result.candidate,
                result.lyricsData,
                difficulty,
                genre,
                result.lastFmInfo
            );

        if (!question) {
            continue;
        }

        if (
            usedSongs.has(
                result.candidate.songKey
            )
        ) {
            continue;
        }

        usedSongs.add(
            result.candidate.songKey
        );

        questions.push(
            question
        );
    }


    /*
     * ========================================================
     * PASSAGE 2
     *
     * Si Last.fm ne connaît pas le titre, on l'autorise.
     * Cela évite de vider le catalogue francophone.
     * ========================================================
     */

    if (
        questions.length < number &&
        difficulty !== "all"
    ) {

        for (
            const result of results
        ) {

            if (
                questions.length >= number
            ) {
                break;
            }

            if (
                result.difficultyMatch !== null
            ) {
                continue;
            }

            const question =
                buildQuestion(
                    result.candidate,
                    result.lyricsData,
                    difficulty,
                    genre,
                    null
                );

            if (!question) {
                continue;
            }

            if (
                usedSongs.has(
                    result.candidate.songKey
                )
            ) {
                continue;
            }

            usedSongs.add(
                result.candidate.songKey
            );

            questions.push(
                question
            );
        }
    }


    /*
     * ========================================================
     * PASSAGE 3
     *
     * Dernier filet de sécurité :
     * si les seuils de popularité sont trop stricts,
     * on complète avec les morceaux français valides.
     * ========================================================
     */

    if (
        questions.length < number
    ) {

        for (
            const result of results
        ) {

            if (
                questions.length >= number
            ) {
                break;
            }

            const question =
                buildQuestion(
                    result.candidate,
                    result.lyricsData,
                    difficulty,
                    genre,
                    result.lastFmInfo
                );

            if (!question) {
                continue;
            }

            if (
                usedSongs.has(
                    result.candidate.songKey
                )
            ) {
                continue;
            }

            usedSongs.add(
                result.candidate.songKey
            );

            questions.push(
                question
            );
        }
    }


    /*
     * Réponse finale.
     */

    return jsonResponse({
        success: true,
        questions,
        requested: number,
        count: questions.length
    });
}


/*
 * ============================================================
 * CONSTRUCTION D'UNE QUESTION
 * ============================================================
 */

function buildQuestion(
    candidate,
    lyricsData,
    difficulty,
    genre,
    lastFmInfo
) {

    if (!lyricsData) {
        return null;
    }

    const fullLyrics =
        lyricsData.plainLyrics ||
        "";

    if (
        fullLyrics.length < 80
    ) {
        return null;
    }


    /*
     * Le jeu est francophone :
     * on conserve uniquement les paroles identifiées
     * comme françaises.
     */

    const languageDetected =
        detectLyricsLanguage(
            fullLyrics
        );

    if (
        languageDetected !== "fr"
    ) {
        return null;
    }


    const excerpt =
        createLyricsExcerpt(
            fullLyrics,
            candidate.title
        );

    if (!excerpt) {
        return null;
    }


    return {
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
}
