const TIMEOUT = 7000;

const CATALOGS = {
    "variete-francaise": [
        "Jean-Jacques Goldman",
        "Francis Cabrel",
        "Michel Sardou",
        "Daniel Balavoine",
        "France Gall",
        "Patrick Bruel",
        "Florent Pagny",
        "Zaz",
        "Vianney",
        "Calogero",
        "Louane",
        "Amel Bent",
        "Mylène Farmer",
        "Julien Clerc",
        "Alain Souchon"
    ],

    "pop-rock-francais": [
        "Indochine",
        "Téléphone",
        "Noir Désir",
        "Louise Attaque",
        "Kyo",
        "Superbus",
        "BB Brunes",
        "Phoenix",
        "M",
        "Dionysos",
        "Shaka Ponk",
        "Manau",
        "Tryo",
        "Mickey 3D",
        "Matmatah"
    ],

    "rap-francais": [
        "Orelsan",
        "Nekfeu",
        "PNL",
        "IAM",
        "MC Solaar",
        "Booba",
        "Soprano",
        "Bigflo & Oli",
        "Lomepal",
        "Damso",
        "Ninho",
        "SCH",
        "Jul",
        "Vald",
        "Kaaris",
        "Niska",
        "Disiz",
        "Oxmo Puccino",
        "Rohff",
        "Sexion d'Assaut"
    ],

    "pop-actuelle": [
        "Stromae",
        "Angèle",
        "Aya Nakamura",
        "Juliette Armanet",
        "Clara Luciani",
        "Hoshi",
        "Pomme",
        "Yseult",
        "Adé",
        "Santa",
        "Eddy de Pretto",
        "Christine and the Queens",
        "Mentissa",
        "Zaho de Sagazan",
        "Pierre de Maere"
    ]
};


/* ============================================================
   OUTILS
   ============================================================ */

function json(data, status) {
    if (!status) {
        status = 200;
    }

    return new Response(JSON.stringify(data), {
        status: status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*"
        }
    });
}


async function fetchTimeout(url, options, timeout) {
    if (!options) {
        options = {};
    }

    if (!timeout) {
        timeout = TIMEOUT;
    }

    const controller = new AbortController();

    const timer = setTimeout(function () {
        controller.abort();
    }, timeout);

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
    const copy = array.slice();

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        const temp = copy[i];
        copy[i] = copy[j];
        copy[j] = temp;
    }

    return copy;
}


function normalize(text) {
    return String(text || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}


function yearOf(date) {
    if (!date) {
        return null;
    }

    const match = String(date).match(/\d{4}/);

    if (!match) {
        return null;
    }

    return Number(match[0]);
}


function isInEra(year, era) {
    if (era === "all") {
        return true;
    }

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


/* ============================================================
   DÉTECTION FRANÇAISE
   ============================================================ */

function looksFrench(text) {
    if (!text || text.length < 80) {
        return false;
    }

    const value = normalize(text);

    const words = [
        " je ",
        " tu ",
        " il ",
        " elle ",
        " nous ",
        " vous ",
        " ils ",
        " elles ",
        " que ",
        " qui ",
        " dans ",
        " pour ",
        " avec ",
        " sans ",
        " mais ",
        " comme ",
        " une ",
        " un ",
        " des ",
        " les ",
        " pas ",
        " est ",
        " suis ",
        " tes ",
        " mes ",
        " mon ",
        " ton ",
        " ma ",
        " ta ",
        " sur ",
        " cette ",
        " quand ",
        " encore ",
        " toujours ",
        " parce "
    ];

    let score = 0;

    for (const word of words) {
        if (value.includes(word)) {
            score++;
        }
    }

    return score >= 4;
}


/* ============================================================
   EXTRAIT DE PAROLES
   ============================================================ */

function cleanLyrics(text) {
    return String(text || "")
        .replace(/\r/g, "")
        .replace(/\[.*?\]/g, "")
        .replace(/^\s*\d+:\d+(?::\d+)?\s*/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}


function createExcerpt(text) {
    const lyrics = cleanLyrics(text);

    if (!lyrics) {
        return null;
    }

    const lines = lyrics
        .split("\n")
        .map(function (line) {
            return line.trim();
        })
        .filter(function (line) {
            return line.length >= 3;
        });

    if (lines.length < 2) {
        return null;
    }

    const candidates = [];

    for (let i = 0; i < lines.length - 2; i++) {
        const block = lines.slice(i, i + 3);

        if (
            block.every(function (line) {
                return line.length >= 3;
            }) &&
            block.join(" ").length >= 80
        ) {
            candidates.push(block.join("\n"));
        }
    }

    if (candidates.length === 0) {
        return lines
            .slice(0, Math.min(4, lines.length))
            .join("\n");
    }

    return candidates[
        Math.floor(Math.random() * candidates.length)
    ];
}


/* ============================================================
   MUSICBRAINZ
   ============================================================ */

async function searchMusicBrainzArtist(artist) {
    /*
     * IMPORTANT :
     * On évite ici les template literals.
     */

    const query =
        'artist:"' +
        artist +
        '"';

    const url =
        "https://musicbrainz.org/ws/2/artist" +
        "?query=" +
        encodeURIComponent(query) +
        "&fmt=json&limit=5";

    try {
        const response = await fetchTimeout(url, {
            headers: {
                "User-Agent": "ParolesMysteres/1.0"
            }
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();

        if (!Array.isArray(data.artists)) {
            return [];
        }

        return data.artists;
    } catch (error) {
        return [];
    }
}


async function getArtistRecordings(artistId) {
    const url =
        "https://musicbrainz.org/ws/2/recording" +
        "?artist=" +
        encodeURIComponent(artistId) +
        "&fmt=json&limit=50" +
        "&inc=artists+releases";

    try {
        const response = await fetchTimeout(url, {
            headers: {
                "User-Agent": "ParolesMysteres/1.0"
            }
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();

        if (!Array.isArray(data.recordings)) {
            return [];
        }

        return data.recordings;
    } catch (error) {
        return [];
    }
}


function recordingToCandidate(recording, artistName) {
    if (!recording || !recording.title) {
        return null;
    }

    let releaseDate = null;

    if (Array.isArray(recording.releases)) {
        for (const release of recording.releases) {
            if (release.date) {
                releaseDate = release.date;
                break;
            }

            if (
                release["release-group"] &&
                release["release-group"]["first-release-date"]
            ) {
                releaseDate =
                    release["release-group"]["first-release-date"];

                break;
            }
        }
    }

    return {
        artist: artistName,
        title: recording.title,
        firstReleaseDate: releaseDate,
        year: yearOf(releaseDate)
    };
}


/* ============================================================
   LRCLIB
   ============================================================ */

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

        const data = await response.json();

        const lyrics =
            data.plainLyrics ||
            data.syncedLyrics ||
            null;

        if (!lyrics) {
            return null;
        }

        return {
            lyrics: lyrics,
            source: "LRCLIB"
        };
    } catch (error) {
        return null;
    }
}


/* ============================================================
   LAST.FM
   ============================================================ */

async function getLastFmInfo(artist, title, env) {
    if (!env || !env.LASTFM_API_KEY) {
        return null;
    }

    const url =
        "https://ws.audioscrobbler.com/2.0/" +
        "?method=track.getInfo" +
        "&api_key=" +
        encodeURIComponent(env.LASTFM_API_KEY) +
        "&artist=" +
        encodeURIComponent(artist) +
        "&track=" +
        encodeURIComponent(title) +
        "&format=json";

    try {
        const response = await fetchTimeout(url);

        if (!response.ok) {
            return null;
        }

        const data = await response.json();

        if (!data.track) {
            return null;
        }

        return {
            listeners: Number(data.track.listeners || 0),
            playcount: Number(data.track.playcount || 0),
            url: data.track.url || null
        };
    } catch (error) {
        return null;
    }
}


/* ============================================================
   DIFFICULTÉ
   ============================================================ */

function matchesDifficulty(info, difficulty) {
    if (difficulty === "all") {
        return true;
    }

    /*
     * Si Last.fm n'est pas disponible,
     * on accepte la chanson.
     */

    if (!info) {
        return true;
    }

    const listeners = Number(info.listeners || 0);

    if (difficulty === "easy") {
        return listeners >= 300000;
    }

    if (difficulty === "medium") {
        return listeners >= 30000 &&
            listeners < 300000;
    }

    if (difficulty === "hard") {
        return listeners < 30000;
    }

    return true;
}


/* ============================================================
   CONSTRUCTION QUESTION
   ============================================================ */

function buildQuestion(
    candidate,
    lyricsData,
    difficulty,
    genre,
    lastFmInfo
) {
    const excerpt =
        createExcerpt(lyricsData.lyrics);

    if (!excerpt) {
        return null;
    }

    return {
        artist: candidate.artist,
        title: candidate.title,
        lyrics: excerpt,
        difficulty: difficulty,
        year: candidate.year,
        language: "fr",
        genre: genre,
        popularity: lastFmInfo
            ? lastFmInfo.listeners
            : null,
        playcount: lastFmInfo
            ? lastFmInfo.playcount
            : null,
        lastFmUrl: lastFmInfo
            ? lastFmInfo.url
            : null
    };
}


/* ============================================================
   ROUTE TEST
   ============================================================ */

async function handleTest() {
    return json({
        success: true,
        message: "Paroles Mystères API fonctionne !"
    });
}


/* ============================================================
   ROUTE MUSICBRAINZ
   ============================================================ */

async function handleMusicBrainz(url) {
    const artist =
        url.searchParams.get("artist");

    const title =
        url.searchParams.get("title");

    if (!artist || !title) {
        return json({
            success: false,
            error: "Artiste et titre requis."
        }, 400);
    }

    const artists =
        await searchMusicBrainzArtist(artist);

    if (!artists.length) {
        return json({
            success: false,
            error:
                "Artiste introuvable sur MusicBrainz."
        });
    }

    const exact =
        artists.find(function (item) {
            return normalize(item.name) ===
                normalize(artist);
        }) || artists[0];

    const recordings =
        await getArtistRecordings(exact.id);

    const wanted =
        normalize(title);

    const matches =
        recordings.filter(function (recording) {
            return normalize(recording.title) ===
                wanted;
        });

    return json({
        success: true,
        artist: exact.name,
        artistId: exact.id,
        requestedTitle: title,
        recordings: matches
    });
}


/* ============================================================
   ROUTE LYRICS
   ============================================================ */

async function handleLyrics(url) {
    const artist =
        url.searchParams.get("artist");

    const title =
        url.searchParams.get("title");

    if (!artist || !title) {
        return json({
            success: false,
            error: "Artiste et titre requis."
        }, 400);
    }

    const result =
        await getLyrics(artist, title);

    if (!result) {
        return json({
            success: false,
            error: "Paroles introuvables."
        });
    }

    return json({
        success: true,
        artist: artist,
        title: title,
        source: result.source,
        lyrics: result.lyrics
    });
}


/* ============================================================
   ROUTE QUESTIONS
   ============================================================ */

async function handleQuestions(url, env) {
    const genre =
        url.searchParams.get("genre") ||
        "all";

    const era =
        url.searchParams.get("era") ||
        "all";

    const difficulty =
        url.searchParams.get("difficulty") ||
        "all";

    const requested =
        Math.max(
            1,
            Math.min(
                Number(
                    url.searchParams.get("number")
                ) || 10,
                30
            )
        );


    /* ========================================================
       DIAGNOSTICS
       ======================================================== */

    const diagnostics = {
        parameters: {
            genre: genre,
            era: era,
            difficulty: difficulty,
            requested: requested
        },

        artistsCatalog: 0,
        artistsFound: 0,
        artistsWithoutMusicBrainz: 0,

        recordingsFound: 0,
        recordingsAfterEra: 0,
        recordingsAfterDuplicateFilter: 0,

        lyricsRequests: 0,
        lyricsFound: 0,
        lyricsFrench: 0,
        lyricsNotFrench: 0,

        lastFmRequests: 0,
        lastFmFound: 0,

        difficultyAccepted: 0,
        excerptsCreated: 0,
        questionsCreated: 0,

        errors: []
    };


    /* ========================================================
       CATALOGUE
       ======================================================== */

    let artists = [];

    if (genre === "all") {
        Object.keys(CATALOGS).forEach(function (key) {
            artists.push.apply(
                artists,
                CATALOGS[key]
            );
        });
    } else if (CATALOGS[genre]) {
        artists = CATALOGS[genre].slice();
    }

    artists = Array.from(
        new Set(artists)
    );

    diagnostics.artistsCatalog =
        artists.length;


    if (!artists.length) {
        return json({
            success: true,
            questions: [],
            requested: requested,
            count: 0,
            diagnostics: diagnostics
        });
    }


    /* ========================================================
       RECHERCHE ARTISTES
       ======================================================== */

    const artistResults = [];

    const shuffledArtists =
        shuffle(artists);

    for (
        let i = 0;
        i < shuffledArtists.length;
        i++
    ) {
        const artistName =
            shuffledArtists[i];

        const found =
            await searchMusicBrainzArtist(
                artistName
            );

        if (!found.length) {
            diagnostics.artistsWithoutMusicBrainz++;

            continue;
        }

        diagnostics.artistsFound++;

        const exact =
            found.find(function (item) {
                return normalize(item.name) ===
                    normalize(artistName);
            }) || found[0];

        artistResults.push({
            requestedName: artistName,
            id: exact.id,
            name: exact.name
        });

        if (artistResults.length >= 12) {
            break;
        }
    }


    /* ========================================================
       RÉCUPÉRATION MORCEAUX
       ======================================================== */

    let candidates = [];

    for (
        let i = 0;
        i < artistResults.length;
        i++
    ) {
        const artist =
            artistResults[i];

        const recordings =
            await getArtistRecordings(
                artist.id
            );

        for (
            let j = 0;
            j < recordings.length;
            j++
        ) {
            const candidate =
                recordingToCandidate(
                    recordings[j],
                    artist.name
                );

            if (!candidate) {
                continue;
            }

            diagnostics.recordingsFound++;

            if (
                !isInEra(
                    candidate.year,
                    era
                )
            ) {
                continue;
            }

            diagnostics.recordingsAfterEra++;

            candidates.push(candidate);
        }
    }


    /* ========================================================
       DOUBLONS
       ======================================================== */

    const unique =
        new Map();

    candidates.forEach(function (candidate) {
        const key =
            normalize(candidate.artist) +
            "|" +
            normalize(candidate.title);

        if (!unique.has(key)) {
            unique.set(key, candidate);
        }
    });

    candidates =
        Array.from(unique.values());

    diagnostics.recordingsAfterDuplicateFilter =
        candidates.length;


    /* ========================================================
       MÉLANGE
       ======================================================== */

    candidates =
        shuffle(candidates);


    /*
     * Maximum 60 appels LRCLIB par requête.
     */
    const maxCandidates =
        Math.min(
            candidates.length,
            60
        );


    /* ========================================================
       PAROLES
       ======================================================== */

    const questions = [];

    for (
        let i = 0;
        i < maxCandidates;
        i++
    ) {
        if (
            questions.length >= requested
        ) {
            break;
        }

        const candidate =
            candidates[i];

        diagnostics.lyricsRequests++;

        const lyricsData =
            await getLyrics(
                candidate.artist,
                candidate.title
            );

        if (!lyricsData) {
            continue;
        }

        diagnostics.lyricsFound++;


        /* ====================================================
           FRANÇAIS
           ==================================================== */

        if (
            !looksFrench(
                lyricsData.lyrics
            )
        ) {
            diagnostics.lyricsNotFrench++;

            continue;
        }

        diagnostics.lyricsFrench++;


        /* ====================================================
           LAST.FM
           ==================================================== */

        let lastFmInfo = null;

        if (difficulty !== "all") {
            diagnostics.lastFmRequests++;

            lastFmInfo =
                await getLastFmInfo(
                    candidate.artist,
                    candidate.title,
                    env
                );

            if (lastFmInfo) {
                diagnostics.lastFmFound++;
            }
        }


        /* ====================================================
           DIFFICULTÉ
           ==================================================== */

        if (
            !matchesDifficulty(
                lastFmInfo,
                difficulty
            )
        ) {
            continue;
        }

        diagnostics.difficultyAccepted++;


        /* ====================================================
           QUESTION
           ==================================================== */

        const question =
            buildQuestion(
                candidate,
                lyricsData,
                difficulty,
                genre,
                lastFmInfo
            );

        if (!question) {
            continue;
        }

        diagnostics.excerptsCreated++;

        questions.push(question);

        diagnostics.questionsCreated++;
    }


    /* ========================================================
       RÉPONSE
       ======================================================== */

    return json({
        success: true,
        questions: questions,
        requested: requested,
        count: questions.length,
        diagnostics: diagnostics
    });
}


/* ============================================================
   ROUTER PRINCIPAL
   ============================================================ */

export default {
    async fetch(request, env) {
        const url =
            new URL(request.url);

        try {
            if (
                request.method ===
                "OPTIONS"
            ) {
                return new Response(
                    null,
                    {
                        status: 204,
                        headers: {
                            "Access-Control-Allow-Origin":
                                "*",
                            "Access-Control-Allow-Methods":
                                "GET, OPTIONS",
                            "Access-Control-Allow-Headers":
                                "Content-Type"
                        }
                    }
                );
            }


            if (
                url.pathname ===
                "/api/test"
            ) {
                return await handleTest();
            }


            if (
                url.pathname ===
                "/api/musicbrainz"
            ) {
                return await handleMusicBrainz(
                    url
                );
            }


            if (
                url.pathname ===
                "/api/lyrics"
            ) {
                return await handleLyrics(
                    url
                );
            }


            if (
                url.pathname ===
                "/api/questions"
            ) {
                return await handleQuestions(
                    url,
                    env
                );
            }


            return new Response(
                "Paroles Mystères API",
                {
                    status: 200,
                    headers: {
                        "Content-Type":
                            "text/plain; charset=utf-8"
                    }
                }
            );

        } catch (error) {
            return json(
                {
                    success: false,
                    error:
                        error &&
                        error.message
                            ? error.message
                            : "Erreur serveur inconnue."
                },
                500
            );
        }
    }
};
