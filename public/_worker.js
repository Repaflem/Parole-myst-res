export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        try {
            if (url.pathname === "/api/test") {
                return json({
                    success: true,
                    message: "Paroles Mystères API fonctionne !"
                });
            }

            if (url.pathname === "/api/musicbrainz") {
                return musicBrainzSearch(url);
            }

            if (url.pathname === "/api/lyrics") {
                return lyricsSearch(url);
            }

            if (url.pathname === "/api/questions") {
                return questions(url, env);
            }

            return env.ASSETS.fetch(request);

        } catch (error) {
            return json({
                success: false,
                error: "Erreur serveur.",
                details: error.message
            }, 500);
        }
    }
};


/* =========================================================
   CONFIGURATION
   ========================================================= */

const TIMEOUT = 6000;

const GENRES = {
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
        "Calogero",
        "Zaz",
        "Vianney",
        "Florent Pagny",
        "Pascal Obispo",
        "Patricia Kaas",
        "Lara Fabian",
        "Garou",
        "Hélène Ségara",
        "Christophe Maé",
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

const ALL_ARTISTS = [
    ...new Set(Object.values(GENRES).flat())
];

const POPULARITY = {
    easy: 300000,
    medium: 30000
};


/* =========================================================
   OUTILS
   ========================================================= */

function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
        }
    });
}


async function fetchTimeout(url, options = {}) {
    const controller = new AbortController();

    const timer = setTimeout(
        () => controller.abort(),
        TIMEOUT
    );

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal
        });
    } finally {
        clearTimeout(timer);
    }
}


function shuffle(array) {
    return array.sort(() => Math.random() - 0.5);
}


function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


function yearOf(date) {
    const year = Number(String(date || "").slice(0, 4));
    return year || null;
}


/* =========================================================
   ÉPOQUES
   ========================================================= */

function validEra(date, era) {
    if (era === "all") {
        return true;
    }

    const year = yearOf(date);

    if (!year) {
        return false;
    }

    const ranges = {
        "1960-1979": [1960, 1979],
        "1980-1989": [1980, 1989],
        "1990-1999": [1990, 1999],
        "2000-2009": [2000, 2009],
        "2010-2019": [2010, 2019],
        "2020-2026": [2020, 2026]
    };

    const range = ranges[era];

    if (!range) {
        return true;
    }

    return year >= range[0] && year <= range[1];
}


/* =========================================================
   MUSICBRAINZ
   ========================================================= */

async function searchArtist(artist) {
    const query =
        `artist:"${artist}" AND type:recording`;

    const url =
        "https://musicbrainz.org/ws/2/recording/" +
        "?query=" +
        encodeURIComponent(query) +
        "&fmt=json&limit=25";

    try {
        const response = await fetchTimeout(url, {
            headers: {
                "User-Agent":
                    "ParolesMysteres/1.0"
            }
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();

        return (data.recordings || [])
            .map(recording => ({
                id: recording.id,
                title: recording.title,
                artist: getArtist(recording, artist),
                date: recording["first-release-date"] || null
            }))
            .filter(song => song.title);

    } catch {
        return [];
    }
}


function getArtist(recording, fallback) {
    const credits = recording["artist-credit"];

    if (!Array.isArray(credits) || !credits.length) {
        return fallback;
    }

    return credits
        .map(x =>
            x.name ||
            x.artist?.name ||
            ""
        )
        .join("")
        .trim() || fallback;
}


/* =========================================================
   LRCLIB
   ========================================================= */

async function getLyrics(artist, title) {
    const url =
        "https://lrclib.net/api/get" +
        "?artist_name=" +
        encodeURIComponent(artist) +
        "&track_name=" +
        encodeURIComponent(title);

    try {
        const response = await fetchTimeout(url);

        if (!response.ok) {
            return null;
        }

        return await response.json();

    } catch {
        return null;
    }
}


/* =========================================================
   LAST.FM
   ========================================================= */

async function getLastFm(env, artist, title) {
    if (!env.LASTFM_API_KEY) {
        return null;
    }

    const params = new URLSearchParams({
        method: "track.getInfo",
        api_key: env.LASTFM_API_KEY,
        artist,
        track: title,
        format: "json",
        autocorrect: "1"
    });

    const url =
        "https://ws.audioscrobbler.com/2.0/?" +
        params.toString();

    try {
        const response = await fetchTimeout(url);

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        if (!data.track || data.error) {
            return null;
        }

        return {
            listeners:
                Number(data.track.listeners) || 0,

            playcount:
                Number(data.track.playcount) || 0,

            url:
                data.track.url || null
        };

    } catch {
        return null;
    }
}


/* =========================================================
   DIFFICULTÉ
   ========================================================= */

function validDifficulty(info, difficulty) {
    if (difficulty === "all") {
        return true;
    }

    /*
     * Si Last.fm ne répond pas,
     * on accepte le morceau.
     * Cela évite de bloquer complètement
     * le jeu si Last.fm est indisponible.
     */

    if (!info) {
        return true;
    }

    const listeners = info.listeners || 0;

    if (difficulty === "easy") {
        return listeners >= POPULARITY.easy;
    }

    if (difficulty === "medium") {
        return (
            listeners >= POPULARITY.medium &&
            listeners < POPULARITY.easy
        );
    }

    if (difficulty === "hard") {
        return listeners < POPULARITY.medium;
    }

    return true;
}


/* =========================================================
   DÉTECTION FRANÇAISE
   ========================================================= */

function isFrench(text) {
    const words = normalize(text)
        .split(/\s+/)
        .filter(Boolean);

    if (words.length < 8) {
        return false;
    }

    const french = new Set([
        "je", "tu", "il", "elle", "nous", "vous",
        "ils", "elles", "dans", "avec", "pour",
        "sans", "mais", "comme", "une", "des",
        "les", "mes", "tes", "ses", "notre",
        "votre", "etre", "avoir", "faire", "tout",
        "tous", "plus", "pas", "que", "qui",
        "quoi", "quand", "comment", "pourquoi",
        "mon", "ton", "son", "ma", "ta", "sa",
        "on", "est", "sont", "vais", "vas", "va",
        "veux", "peux", "peut", "sur", "sous",
        "entre", "bien", "mal", "moi", "toi",
        "lui", "eux", "ici", "la", "aussi",
        "encore", "toujours", "jamais", "rien",
        "quelque", "chose", "ou", "et", "en",
        "au", "aux", "du", "de", "le", "un",
        "me", "te", "se", "ce", "cette"
    ]);

    const english = new Set([
        "the", "you", "your", "and", "with",
        "for", "that", "this", "from", "have",
        "has", "are", "was", "were", "what",
        "when", "where", "who", "how", "why",
        "love", "baby", "girl", "boy", "heart",
        "night", "day", "life", "world", "want",
        "know", "can", "will", "not", "all",
        "just", "like", "one", "out", "get",
        "got", "never", "always", "really",
        "there", "here", "away", "back", "down",
        "come", "going"
    ]);

    let fr = 0;
    let en = 0;

    for (const word of words) {
        if (french.has(word)) fr++;
        if (english.has(word)) en++;
    }

    if (
        String(text).match(
            /[àâäçéèêëîïôöùûüÿœæ]/i
        )
    ) {
        fr += 2;
    }

    return fr >= 2 && fr > en;
}


/* =========================================================
   EXTRAIT
   ========================================================= */

function createExcerpt(lyrics, title) {
    const lines = String(lyrics)
        .split(/\r?\n/)
        .map(line =>
            line
                .replace(/^\s*\[[^\]]+\]\s*/, "")
                .trim()
        )
        .filter(line => line.length >= 15);

    if (lines.length < 2) {
        return null;
    }

    const normalizedTitle = normalize(title);

    const possibilities = [];

    for (let i = 0; i < lines.length - 1; i++) {
        const first = lines[i];
        const second = lines[i + 1];

        if (
            normalize(first) ===
            normalize(second)
        ) {
            continue;
        }

        const text =
            `${first} ${second}`;

        if (
            normalizedTitle.length >= 4 &&
            normalize(text).includes(normalizedTitle)
        ) {
            continue;
        }

        possibilities.push(text);
    }

    if (!possibilities.length) {
        return null;
    }

    return possibilities[
        Math.floor(
            Math.random() * possibilities.length
        )
    ];
}


/* =========================================================
   API MUSICBRAINZ DIRECTE
   ========================================================= */

async function musicBrainzSearch(url) {
    const artist = url.searchParams.get("artist");
    const title = url.searchParams.get("title");

    if (!artist || !title) {
        return json({
            success: false,
            error: "Artiste et titre requis."
        }, 400);
    }

    const query =
        `artist:"${artist}" AND recording:"${title}"`;

    const apiUrl =
        "https://musicbrainz.org/ws/2/recording/" +
        "?query=" +
        encodeURIComponent(query) +
        "&fmt=json&limit=5";

    try {
        const response = await fetchTimeout(apiUrl, {
            headers: {
                "User-Agent": "ParolesMysteres/1.0"
            }
        });

        if (!response.ok) {
            return json({
                success: false,
                error: "MusicBrainz a retourné une erreur."
            }, response.status);
        }

        const data = await response.json();

        return json({
            success: true,
            results: (data.recordings || []).map(r => ({
                id: r.id,
                title: r.title,
                artist: getArtist(r, artist),
                firstReleaseDate:
                    r["first-release-date"] || null
            }))
        });

    } catch (error) {
        return json({
            success: false,
            error: "Erreur MusicBrainz.",
            details: error.message
        }, 500);
    }
}


/* =========================================================
   API PAROLES DIRECTE
   ========================================================= */

async function lyricsSearch(url) {
    const artist = url.searchParams.get("artist");
    const title = url.searchParams.get("title");

    if (!artist || !title) {
        return json({
            success: false,
            error: "Artiste et titre requis."
        }, 400);
    }

    const data = await getLyrics(artist, title);

    if (!data) {
        return json({
            success: false,
            error: "Paroles introuvables."
        }, 404);
    }

    return json({
        success: true,
        data
    });
}


/* =========================================================
   GÉNÉRATION DES QUESTIONS
   ========================================================= */

async function questions(url, env) {
    const genre =
        url.searchParams.get("genre") || "all";

    const era =
        url.searchParams.get("era") || "all";

    const difficulty =
        url.searchParams.get("difficulty") || "all";

    const requested =
        Number(
            url.searchParams.get("number")
        ) || 10;

    const number =
        Math.min(
            Math.max(requested, 1),
            30
        );

    let artists =
        genre === "all"
            ? [...ALL_ARTISTS]
            : [...(GENRES[genre] || ALL_ARTISTS)];

    shuffle(artists);

    /*
     * On ne travaille que sur un nombre raisonnable
     * d'artistes.
     */

    const artistCount =
        Math.min(
            artists.length,
            Math.max(number * 2, 10)
        );

    artists =
        artists.slice(0, artistCount);

    const songs = [];

    /*
     * MusicBrainz est interrogé artiste par artiste.
     * Cela évite un énorme Promise.all().
     */

    for (const artist of artists) {
        const recordings =
            await searchArtist(artist);

        const usable =
            recordings.filter(song => {
                if (!validEra(song.date, era)) {
                    return false;
                }

                return !badTitle(song.title);
            });

        shuffle(usable);

        /*
         * Quelques morceaux seulement par artiste.
         */

        songs.push(
            ...usable.slice(0, 4)
        );

        if (songs.length >= number * 5) {
            break;
        }
    }

    shuffle(songs);

    const result = [];
    const used = new Set();

    /*
     * On teste les morceaux progressivement.
     */

    for (const song of songs) {
        if (result.length >= number) {
            break;
        }

        const key =
            normalize(song.artist) +
            "::" +
            normalize(song.title);

        if (used.has(key)) {
            continue;
        }

        used.add(key);

        const lyrics =
            await getLyrics(
                song.artist,
                song.title
            );

        if (!lyrics) {
            continue;
        }

        const fullLyrics =
            lyrics.plainLyrics || "";

        if (fullLyrics.length < 80) {
            continue;
        }

        if (!isFrench(fullLyrics)) {
            continue;
        }

        const excerpt =
            createExcerpt(
                fullLyrics,
                song.title
            );

        if (!excerpt) {
            continue;
        }

        /*
         * Last.fm uniquement si nécessaire.
         */

        let lastFm = null;

        if (difficulty !== "all") {
            lastFm =
                await getLastFm(
                    env,
                    song.artist,
                    song.title
                );

            if (
                !validDifficulty(
                    lastFm,
                    difficulty
                )
            ) {
                continue;
            }
        }

        result.push({
            artist: song.artist,
            title: song.title,
            lyrics: excerpt,
            difficulty,
            year: song.date,
            language: "fr",
            genre,
            popularity:
                lastFm?.listeners ?? null,
            playcount:
                lastFm?.playcount ?? null,
            lastFmUrl:
                lastFm?.url ?? null
        });
    }

    return json({
        success: true,
        questions: result,
        requested: number,
        count: result.length
    });
}


/* =========================================================
   TITRES À ÉVITER
   ========================================================= */

function badTitle(title) {
    const value = normalize(title);

    const forbidden = [
        "live",
        "concert",
        "remix",
        "remaster",
        "instrumental",
        "karaoke",
        "acapella",
        "demo",
        "radio edit",
        "radio version",
        "extended",
        "alternate",
        "cover",
        "tribute",
        "dub",
        "mix"
    ];

    return forbidden.some(
        word =>
            value.includes(normalize(word))
    );
}
