export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    /*
     * ============================================================
     * CONFIGURATION
     * ============================================================
     */

    const MB_USER_AGENT =
      "ParolesMysteres/1.0 (https://paroles-mysteres.pages.dev/)";

    const LASTFM_API_KEY = env.LASTFM_API_KEY || "";

    /*
     * ============================================================
     * CATALOGUES
     * ============================================================
     */

    const ARTISTS = {
      "variete-francaise": [
        "Jean-Jacques Goldman",
        "Francis Cabrel",
        "Michel Sardou",
        "Daniel Balavoine",
        "France Gall",
        "Mylène Farmer",
        "Céline Dion",
        "Patrick Bruel",
        "Florent Pagny",
        "Garou",
        "Calogero",
        "Zaz",
        "Vianney",
        "Louane",
        "Julien Clerc",
        "Alain Souchon",
        "Laurent Voulzy",
        "Renaud",
        "Vanessa Paradis",
        "Pascal Obispo"
      ],

      "pop-rock-francais": [
        "Indochine",
        "Téléphone",
        "Noir Désir",
        "Louise Attaque",
        "Kyo",
        "Superbus",
        "BB Brunes",
        "Shaka Ponk",
        "Matmatah",
        "Tryo",
        "Mickey 3D",
        "Phoenix",
        "Dionysos",
        "The Dø",
        "Skip The Use",
        "Manu Chao",
        "Zebda",
        "M",
        "Cali",
        "Feu! Chatterton"
      ],

      "rap-francais": [
        "Orelsan",
        "Stromae",
        "Nekfeu",
        "Soprano",
        "MC Solaar",
        "Booba",
        "PNL",
        "SCH",
        "Damso",
        "Ninho",
        "Vald",
        "Lomepal",
        "Bigflo & Oli",
        "Kery James",
        "Oxmo Puccino",
        "IAM",
        "NTM",
        "Disiz",
        "Jul",
        "Gims"
      ],

      "pop-actuelle": [
        "Angèle",
        "Aya Nakamura",
        "Juliette Armanet",
        "Clara Luciani",
        "Hoshi",
        "Adé",
        "Pierre de Maere",
        "Mentissa",
        "Eddy de Pretto",
        "Yseult",
        "Pomme",
        "Zaho de Sagazan",
        "Santa",
        "Jeck",
        "Helena",
        "Jain",
        "Christine and the Queens",
        "Vitaa",
        "Slimane",
        "Amir"
      ]
    };

    /*
     * ============================================================
     * OUTILS
     * ============================================================
     */

    function json(data, status = 200) {
      return new Response(JSON.stringify(data), {
        status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    async function fetchTimeout(resource, options = {}, timeout = 10000) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        return await fetch(resource, {
          ...options,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }
    }

    function shuffle(array) {
      const copy = [...array];

      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }

      return copy;
    }

    function normalize(value) {
      return String(value || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’']/g, "'")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    function yearOf(value) {
      if (!value) return null;

      const match = String(value).match(/\b(19|20)\d{2}\b/);

      if (!match) return null;

      return Number(match[0]);
    }

    function isInEra(year, era) {
      if (era === "all") return true;

      if (!year) return true;

      const ranges = {
        "1960-1979": [1960, 1979],
        "1980-1989": [1980, 1989],
        "1990-1999": [1990, 1999],
        "2000-2009": [2000, 2009],
        "2010-2019": [2010, 2019],
        "2020-2026": [2020, 2026]
      };

      const range = ranges[era];

      if (!range) return true;

      return year >= range[0] && year <= range[1];
    }

    function looksFrench(text) {
      if (!text || text.length < 80) return false;

      const lower = text.toLowerCase();

      const frenchWords = [
        " le ",
        " la ",
        " les ",
        " un ",
        " une ",
        " des ",
        " de ",
        " du ",
        " dans ",
        " pour ",
        " avec ",
        " sans ",
        " que ",
        " qui ",
        " je ",
        " tu ",
        " il ",
        " elle ",
        " nous ",
        " vous ",
        " ils ",
        " elles ",
        " est ",
        " sont ",
        " pas ",
        " plus ",
        " comme ",
        " mais ",
        " mon ",
        " ton ",
        " son ",
        " notre ",
        " votre ",
        " leur "
      ];

      let score = 0;

      for (const word of frenchWords) {
        if (lower.includes(word)) {
          score++;
        }
      }

      return score >= 3;
    }

    function cleanLyrics(text) {
      if (!text) return "";

      let result = String(text);

      result = result.replace(/\r/g, "");

      result = result.replace(/\[[^\]]*\]/g, "");

      result = result.replace(
        /^(paroles|lyrics|verse|chorus|refrain|couplet)[^\n]*$/gim,
        ""
      );

      result = result
        .split("\n")
        .map(line => line.trim())
        .filter(Boolean)
        .join("\n");

      return result.trim();
    }

    function createExcerpt(text) {
      const cleaned = cleanLyrics(text);

      if (!cleaned) return null;

      const lines = cleaned
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length >= 8)
        .filter(line => !/^https?:\/\//i.test(line));

      if (lines.length < 2) return null;

      const possibleStarts = [];

      for (let i = 0; i < lines.length - 1; i++) {
        const a = lines[i];
        const b = lines[i + 1];

        if (
          a.length >= 12 &&
          b.length >= 12 &&
          a.length <= 180 &&
          b.length <= 180
        ) {
          possibleStarts.push(i);
        }
      }

      if (possibleStarts.length === 0) return null;

      const start =
        possibleStarts[
          Math.floor(Math.random() * possibleStarts.length)
        ];

      const selected = lines.slice(start, start + 4);

      if (selected.length < 2) return null;

      return selected.join("\n");
    }

    /*
     * ============================================================
     * MUSICBRAINZ
     * ============================================================
     */

    async function searchArtist(artistName) {
      const query =
        'artist:"' +
        artistName.replace(/"/g, "") +
        '"';

      const endpoint =
        "https://musicbrainz.org/ws/2/artist" +
        "?query=" +
        encodeURIComponent(query) +
        "&fmt=json&limit=5";

      const response = await fetchTimeout(
        endpoint,
        {
          headers: {
            "User-Agent": MB_USER_AGENT,
            Accept: "application/json"
          }
        },
        10000
      );

      if (!response.ok) {
        throw new Error(
          "MusicBrainz artist HTTP " + response.status
        );
      }

      const data = await response.json();

      if (!Array.isArray(data.artists)) {
        return null;
      }

      const normalizedTarget = normalize(artistName);

      let best = null;

      for (const artist of data.artists) {
        const name = artist.name || "";

        if (!name) continue;

        const normalizedName = normalize(name);

        if (normalizedName === normalizedTarget) {
          best = artist;
          break;
        }

        if (!best) {
          best = artist;
        }
      }

      return best || null;
    }

    async function getArtistRecordings(artistMbid) {
      /*
       * IMPORTANT :
       * On utilise ici la recherche MusicBrainz "recording"
       * avec arid:<MBID>.
       *
       * L'ancienne version utilisait un endpoint qui ne renvoyait
       * pas les enregistrements attendus.
       */

      const query = "arid:" + artistMbid;

      const endpoint =
        "https://musicbrainz.org/ws/2/recording" +
        "?query=" +
        encodeURIComponent(query) +
        "&fmt=json&limit=100";

      const response = await fetchTimeout(
        endpoint,
        {
          headers: {
            "User-Agent": MB_USER_AGENT,
            Accept: "application/json"
          }
        },
        15000
      );

      if (!response.ok) {
        throw new Error(
          "MusicBrainz recordings HTTP " + response.status
        );
      }

      const data = await response.json();

      if (!Array.isArray(data.recordings)) {
        return [];
      }

      return data.recordings;
    }

    function recordingToCandidate(recording, artistName) {
      if (!recording || !recording.title) {
        return null;
      }

      let year = null;

      if (Array.isArray(recording.releases)) {
        for (const release of recording.releases) {
          const releaseYear = yearOf(release.date);

          if (releaseYear) {
            if (!year || releaseYear < year) {
              year = releaseYear;
            }
          }

          if (!year && release["release-group"]) {
            const rgYear = yearOf(
              release["release-group"].first_release_date
            );

            if (rgYear) {
              year = rgYear;
            }
          }
        }
      }

      return {
        artist: artistName,
        title: recording.title,
        year,
        mbid: recording.id
      };
    }

    /*
     * ============================================================
     * LRCLIB
     * ============================================================
     */

    async function getLyrics(artist, title) {
      const endpoint =
        "https://lrclib.net/api/get" +
        "?artist_name=" +
        encodeURIComponent(artist) +
        "&track_name=" +
        encodeURIComponent(title);

      const response = await fetchTimeout(
        endpoint,
        {
          headers: {
            Accept: "application/json"
          }
        },
        10000
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      if (!data) {
        return null;
      }

      return (
        data.plainLyrics ||
        data.syncedLyrics ||
        null
      );
    }

    /*
     * ============================================================
     * LAST.FM
     * ============================================================
     */

    async function getLastFmListeners(artist, title) {
      if (!LASTFM_API_KEY) {
        return null;
      }

      const endpoint =
        "https://ws.audioscrobbler.com/2.0/" +
        "?method=track.getInfo" +
        "&api_key=" +
        encodeURIComponent(LASTFM_API_KEY) +
        "&artist=" +
        encodeURIComponent(artist) +
        "&track=" +
        encodeURIComponent(title) +
        "&format=json";

      const response = await fetchTimeout(
        endpoint,
        {
          headers: {
            Accept: "application/json"
          }
        },
        8000
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      const listeners =
        data &&
        data.track &&
        data.track.listeners;

      if (!listeners) {
        return null;
      }

      const number = Number(listeners);

      return Number.isFinite(number) ? number : null;
    }

    function difficultyMatches(listeners, difficulty) {
      if (difficulty === "all") {
        return true;
      }

      /*
       * Si Last.fm ne donne pas de nombre d'auditeurs,
       * on accepte le morceau plutôt que de supprimer
       * arbitrairement le candidat.
       */

      if (listeners === null || listeners === undefined) {
        return true;
      }

      if (difficulty === "easy") {
        return listeners >= 300000;
      }

      if (difficulty === "medium") {
        return listeners >= 30000 && listeners < 300000;
      }

      if (difficulty === "hard") {
        return listeners < 30000;
      }

      return true;
    }

    /*
     * ============================================================
     * CONSTRUCTION DES QUESTIONS
     * ============================================================
     */

    async function buildQuestions({
      genre,
      era,
      difficulty,
      number
    }) {
      const diagnostics = {
        parameters: {
          genre,
          era,
          difficulty,
          requested: number
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

      let artists = [];

      if (genre === "all") {
        for (const category of Object.keys(ARTISTS)) {
          artists.push(...ARTISTS[category]);
        }
      } else {
        artists = ARTISTS[genre] || [];
      }

      artists = [...new Set(artists)];

      diagnostics.artistsCatalog = artists.length;

      /*
       * On mélange les artistes pour éviter d'avoir toujours
       * les mêmes premières chansons.
       */

      artists = shuffle(artists);

      const artistObjects = [];

      /*
       * MusicBrainz impose une limitation de débit.
       * On traite les artistes un par un.
       */

      for (const artistName of artists) {
        if (artistObjects.length >= 12) {
          break;
        }

        try {
          const artist = await searchArtist(artistName);

          if (!artist || !artist.id) {
            diagnostics.artistsWithoutMusicBrainz++;
            continue;
          }

          diagnostics.artistsFound++;

          artistObjects.push({
            name: artistName,
            mbid: artist.id
          });

          /*
           * Petite pause pour respecter MusicBrainz.
           */
          await new Promise(resolve => setTimeout(resolve, 1100));
        } catch (error) {
          diagnostics.artistsWithoutMusicBrainz++;

          if (diagnostics.errors.length < 10) {
            diagnostics.errors.push(
              "Artist " +
                artistName +
                ": " +
                String(error.message || error)
            );
          }
        }
      }

      /*
       * ==========================================================
       * RÉCUPÉRATION DES MORCEAUX
       * ==========================================================
       */

      let candidates = [];

      for (const artist of artistObjects) {
        if (candidates.length >= 120) {
          break;
        }

        try {
          const recordings = await getArtistRecordings(
            artist.mbid
          );

          diagnostics.recordingsFound += recordings.length;

          for (const recording of recordings) {
            const candidate = recordingToCandidate(
              recording,
              artist.name
            );

            if (!candidate) {
              continue;
            }

            if (!isInEra(candidate.year, era)) {
              continue;
            }

            diagnostics.recordingsAfterEra++;

            candidates.push(candidate);

            if (candidates.length >= 120) {
              break;
            }
          }

          /*
           * MusicBrainz rate limit.
           */
          await new Promise(resolve => setTimeout(resolve, 1100));
        } catch (error) {
          if (diagnostics.errors.length < 10) {
            diagnostics.errors.push(
              "Recordings " +
                artist.name +
                ": " +
                String(error.message || error)
            );
          }
        }
      }

      /*
       * ==========================================================
       * SUPPRESSION DES DOUBLONS
       * ==========================================================
       */

      const seen = new Set();

      candidates = candidates.filter(candidate => {
        const key =
          normalize(candidate.artist) +
          "|" +
          normalize(candidate.title);

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });

      diagnostics.recordingsAfterDuplicateFilter =
        candidates.length;

      candidates = shuffle(candidates);

      /*
       * On ne teste pas 120 morceaux avec LRCLIB.
       * Cela ralentirait inutilement la requête.
       *
       * 35 candidats suffisent généralement pour obtenir
       * plusieurs questions.
       */

      candidates = candidates.slice(0, 35);

      const questions = [];

      /*
       * ==========================================================
       * PAROLES
       * ==========================================================
       */

      for (const candidate of candidates) {
        if (questions.length >= number) {
          break;
        }

        diagnostics.lyricsRequests++;

        try {
          const lyrics = await getLyrics(
            candidate.artist,
            candidate.title
          );

          if (!lyrics) {
            continue;
          }

          diagnostics.lyricsFound++;

          const cleaned = cleanLyrics(lyrics);

          if (!looksFrench(cleaned)) {
            diagnostics.lyricsNotFrench++;
            continue;
          }

          diagnostics.lyricsFrench++;

          /*
           * ======================================================
           * LAST.FM
           * ======================================================
           */

          let listeners = null;

          if (LASTFM_API_KEY) {
            diagnostics.lastFmRequests++;

            try {
              listeners = await getLastFmListeners(
                candidate.artist,
                candidate.title
              );

              if (listeners !== null) {
                diagnostics.lastFmFound++;
              }
            } catch (error) {
              /*
               * Last.fm ne doit jamais empêcher une question
               * d'être créée.
               */
              listeners = null;
            }
          }

          if (
            !difficultyMatches(
              listeners,
              difficulty
            )
          ) {
            continue;
          }

          diagnostics.difficultyAccepted++;

          const excerpt = createExcerpt(cleaned);

          if (!excerpt) {
            continue;
          }

          diagnostics.excerptsCreated++;

          questions.push({
            artist: candidate.artist,
            title: candidate.title,
            year: candidate.year,
            difficulty:
              difficulty === "all"
                ? "medium"
                : difficulty,
            lyrics: excerpt,
            points:
              difficulty === "hard"
                ? 3
                : difficulty === "medium"
                  ? 2
                  : 1
          });
        } catch (error) {
          if (diagnostics.errors.length < 10) {
            diagnostics.errors.push(
              "Lyrics " +
                candidate.artist +
                " - " +
                candidate.title +
                ": " +
                String(error.message || error)
            );
          }
        }
      }

      diagnostics.questionsCreated =
        questions.length;

      return {
        questions,
        diagnostics
      };
    }

    /*
     * ============================================================
     * ROUTE /api/test
     * ============================================================
     */

    if (url.pathname === "/api/test") {
      return json({
        success: true,
        message: "Paroles Mystères API fonctionne !"
      });
    }

    /*
     * ============================================================
     * ROUTE /api/musicbrainz
     * ============================================================
     */

    if (url.pathname === "/api/musicbrainz") {
      const artist = url.searchParams.get("artist");
      const title = url.searchParams.get("title");

      if (!artist || !title) {
        return json(
          {
            success: false,
            error: "Artiste et titre requis."
          },
          400
        );
      }

      try {
        const query =
          'recording:"' +
          title.replace(/"/g, "") +
          '" AND artist:"' +
          artist.replace(/"/g, "") +
          '"';

        const endpoint =
          "https://musicbrainz.org/ws/2/recording" +
          "?query=" +
          encodeURIComponent(query) +
          "&fmt=json&limit=5";

        const response = await fetchTimeout(
          endpoint,
          {
            headers: {
              "User-Agent": MB_USER_AGENT,
              Accept: "application/json"
            }
          },
          10000
        );

        if (!response.ok) {
          return json(
            {
              success: false,
              error:
                "MusicBrainz HTTP " +
                response.status
            },
            502
          );
        }

        const data = await response.json();

        return json({
          success: true,
          artist,
          title,
          recordings: data.recordings || []
        });
      } catch (error) {
        return json(
          {
            success: false,
            error: String(
              error.message || error
            )
          },
          500
        );
      }
    }

    /*
     * ============================================================
     * ROUTE /api/lyrics
     * ============================================================
     */

    if (url.pathname === "/api/lyrics") {
      const artist = url.searchParams.get("artist");
      const title = url.searchParams.get("title");

      if (!artist || !title) {
        return json(
          {
            success: false,
            error: "Artiste et titre requis."
          },
          400
        );
      }

      try {
        const lyrics = await getLyrics(
          artist,
          title
        );

        return json({
          success: true,
          artist,
          title,
          found: Boolean(lyrics),
          lyrics: lyrics || null
        });
      } catch (error) {
        return json(
          {
            success: false,
            error: String(
              error.message || error
            )
          },
          500
        );
      }
    }

    /*
     * ============================================================
     * ROUTE /api/questions
     * ============================================================
     */

    if (url.pathname === "/api/questions") {
      const genre =
        url.searchParams.get("genre") || "all";

      const era =
        url.searchParams.get("era") || "all";

      const difficulty =
        url.searchParams.get("difficulty") || "all";

      const requestedNumber =
        Number(
          url.searchParams.get("number") || "10"
        );

      const number = Math.min(
        Math.max(
          Number.isFinite(requestedNumber)
            ? requestedNumber
            : 10,
          1
        ),
        30
      );

      try {
        const result =
          await buildQuestions({
            genre,
            era,
            difficulty,
            number
          });

        return json({
          success: true,
          questions: result.questions,
          requested: number,
          count: result.questions.length,
          diagnostics: result.diagnostics
        });
      } catch (error) {
        return json(
          {
            success: false,
            error: String(
              error.message || error
            )
          },
          500
        );
      }
    }

    /*
     * ============================================================
     * ROUTE RACINE
     * ============================================================
     */

    return new Response(
      "Paroles Mystères API",
      {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      }
    );
  }
};
