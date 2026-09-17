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

/*
 * Plus élevé qu'avant :
 * on veut suffisamment de morceaux pour pouvoir appliquer
 * ensuite les filtres de difficulté / époque / paroles.
 */
const MAX_MUSICBRAINZ_RECORDINGS = 50;

/*
 * Nombre maximum de titres conservés par artiste
 * avant le traitement LRCLIB / Last.fm.
 */
const MAX_CANDIDATES_PER_ARTIST = 10;


/*
 * ============================================================
 * DIFFICULTÉ
 * ============================================================
 *
 * Les valeurs Last.fm servent de référence lorsqu'elles sont
 * disponibles.
 *
 * EASY   : très populaire
 * MEDIUM : populaire mais moins évident
 * HARD   : moins populaire
 *
 * Les seuils sont volontairement moins stricts que l'ancienne
 * version afin d'éviter qu'une partie soit vide.
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
 * CACHE / UTILITAIRES
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
 * MUSICBRAINZ - API DIRECTE
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
 * LRCLIB - API DIRECTE
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

        if (data.error || !data.track) {
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

    /*
     * Si Last.fm répond :
     * on utilise les auditeurs.
     */
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
     * Pas de données Last.fm :
     * le candidat pourra être accepté par
     * le système de secours.
     */
    return null;
}


/*
 * ============================================================
 * FILTRE TITRES
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
        "mix",
        "instrumental"
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
 * MUSICBRAINZ - RECHERCHE D'UN ARTISTE
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
 * ARTISTE MUSICBRAINZ
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
 * DATE MUSICBRAINZ
 * ============================================================
 */

function
