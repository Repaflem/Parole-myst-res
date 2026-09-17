export default {
  async fetch(request, env, ctx) {
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
        "Mylene Farmer",
        "Celine Dion",
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
        "Pascal Obispo",
        "Johnny Hallyday",
        "Charles Aznavour",
        "Serge Reggiani",
        "Michel Berger",
        "Veronique Sanson",
        "Christophe Mae",
        "Julien Dore",
        "Grand Corps Malade",
        "Benabar",
        "Zazie",
        "Jenifer",
        "Nolwenn Leroy",
        "Amel Bent",
        "M Pokora",
        "Christophe Willem",
        "Kendji Girac",
        "Claudio Capeo",
        "Michel Polnareff",
        "Sheila",
        "Michel Delpech",
        "Coeur de Pirate",
        "Ariane Moffatt",
        "Roch Voisine",
        "Corneille",
        "Lynda Lemay",
        "Salvatore Adamo",
        "Damien Robitaille",
        "Jacques Brel",
        "Maurane",
        "Axelle Red",
        "Lara Fabian",
        "Pierre Lapointe",
        "Ann O'Aro",
        "Suzanne",
        "Melissa Laveaux",
        "Gaetan Roussel",
        "Isabelle Boulay",
        "Nadege"
      ],

      "pop-rock-francais": [
        "Indochine",
        "Telephone",
        "Noir Desir",
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
        "The Do",
        "Skip The Use",
        "Manu Chao",
        "Zebda",
        "M",
        "Cali",
        "Feu! Chatterton",
        "Fauve",
        "Hollysiz",
        "Air",
        "Gojira",
        "Trust",
        "Alain Bashung",
        "Etienne Daho",
        "Rita Mitsouko",
        "Charlie Winston",
        "Yodelice",
        "Naive New Beaters",
        "Hyphen Hyphen",
        "Stupeflip",
        "Eiffel",
        "Miossec",
        "Dominique A"
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
        "Gims",
        "Youssoupha",
        "Alpha Wann",
        "Georgio",
        "Rim'K",
        "Kaaris",
        "Sofiane",
        "Niska",
        "Gazo",
        "Freeze Corleone",
        "Josman",
        "Laylow",
        "Dinos",
        "Hamza",
        "Zola",
        "Naps",
        "Werenoi",
        "Tiakola",
        "Sexion d'Assaut",
        "Sniper",
        "113",
        "Diam's",
        "Rohff",
        "Keny Arkana",
        "La Fouine"
      ],

      "pop-actuelle": [
        "Angele",
        "Aya Nakamura",
        "Juliette Armanet",
        "Clara Luciani",
        "Hoshi",
        "Pierre de Maere",
        "Mentissa",
        "Eddy de Pretto",
        "Yseult",
        "Pomme",
        "Zaho de Sagazan",
        "Jain",
        "Christine and the Queens",
        "Vitaa",
        "Slimane",
        "Amir",
        "Suzane",
        "Terrenoire",
        "L'Imperatrice",
        "Videoclub",
        "Fishbach",
        "Romeo Elvis",
        "Gael Faye",
        "Bilal Hassani",
        "Tayc",
        "Dadju",
        "Camelia Jordana",
        "Ben Mazue",
        "Zaho",
        "Shy'm",
        "Tal",
        "Joyce Jonathan"
      ]
    };

    /*
     * ============================================================
     * JETON DE REPONSE (anti-triche)
     * ============================================================
     *
     * La bonne réponse ne doit jamais transiter en clair vers
     * le navigateur. On la chiffre dans un jeton opaque que le
     * client renvoie tel quel lors de la validation ; seul le
     * Worker, avec sa clé secrète, peut le déchiffrer.
     */

    async function getAnswerKey() {
      const secret =
        env.ANSWER_SECRET ||
        "paroles-mysteres-cle-par-defaut-a-changer";

      const digest =
        await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(
            secret
          )
        );

      return crypto.subtle.importKey(
        "raw",
        digest,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
    }

    function bytesToBase64Url(bytes) {
      let binary = "";

      for (const byte of bytes) {
        binary +=
          String.fromCharCode(byte);
      }

      return btoa(binary)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    }

    function base64UrlToBytes(value) {
      const base64 =
        value
          .replace(/-/g, "+")
          .replace(/_/g, "/");

      const binary = atob(base64);

      const bytes = new Uint8Array(
        binary.length
      );

      for (
        let i = 0;
        i < binary.length;
        i++
      ) {
        bytes[i] =
          binary.charCodeAt(i);
      }

      return bytes;
    }

    async function encryptAnswer(
      payload,
      key
    ) {
      const iv =
        crypto.getRandomValues(
          new Uint8Array(12)
        );

      const data =
        new TextEncoder().encode(
          JSON.stringify(payload)
        );

      const ciphertext =
        await crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          data
        );

      const combined =
        new Uint8Array(
          iv.length +
            ciphertext.byteLength
        );

      combined.set(iv, 0);

      combined.set(
        new Uint8Array(ciphertext),
        iv.length
      );

      return bytesToBase64Url(
        combined
      );
    }

    async function decryptAnswer(
      token,
      key
    ) {
      const bytes =
        base64UrlToBytes(token);

      const iv = bytes.slice(0, 12);

      const ciphertext =
        bytes.slice(12);

      const decrypted =
        await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          key,
          ciphertext
        );

      return JSON.parse(
        new TextDecoder().decode(
          decrypted
        )
      );
    }

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

    async function fetchTimeout(
      resource,
      options = {},
      timeout = 10000
    ) {
      const controller = new AbortController();

      const timer = setTimeout(
        () => controller.abort(),
        timeout
      );

      try {
        return await fetch(resource, {
          ...options,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }
    }

    function sleep(ms) {
      return new Promise(resolve =>
        setTimeout(resolve, ms)
      );
    }

    function shuffle(array) {
      const copy = [...array];

      for (let i = copy.length - 1; i > 0; i--) {
        const j =
          Math.floor(Math.random() * (i + 1));

        [copy[i], copy[j]] =
          [copy[j], copy[i]];
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

      const match =
        String(value).match(/\b(19|20)\d{2}\b/);

      return match ? Number(match[0]) : null;
    }

    function isInEra(year, era) {
      if (era === "all") {
        return true;
      }

      /*
       * Lorsqu'une date est absente, on conserve le morceau.
       * Cela évite de supprimer inutilement des titres.
       */

      if (!year) {
        return true;
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

      return (
        year >= range[0] &&
        year <= range[1]
      );
    }

    function looksFrench(text) {
      if (!text || text.length < 80) {
        return false;
      }

      const lower =
        " " +
        text.toLowerCase() +
        " ";

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
        " leur ",
        " mes ",
        " tes ",
        " ses ",
        " cette ",
        " ces ",
        " tout ",
        " tous ",
        " rien ",
        " bien ",
        " quand ",
        " parce "
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
      if (!text) {
        return "";
      }

      let result = String(text);

      result = result.replace(/\r/g, "");

      result = result.replace(
        /\[[^\]]*\]/g,
        ""
      );

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
      const cleaned =
        cleanLyrics(text);

      if (!cleaned) {
        return null;
      }

      const lines = cleaned
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length >= 8)
        .filter(
          line =>
            !/^https?:\/\//i.test(line)
        );

      if (lines.length < 2) {
        return null;
      }

      const possibleStarts = [];

      for (
        let i = 0;
        i < lines.length - 1;
        i++
      ) {
        if (
          lines[i].length >= 12 &&
          lines[i + 1].length >= 12 &&
          lines[i].length <= 180 &&
          lines[i + 1].length <= 180
        ) {
          possibleStarts.push(i);
        }
      }

      if (!possibleStarts.length) {
        return null;
      }

      const start =
        possibleStarts[
          Math.floor(
            Math.random() *
              possibleStarts.length
          )
        ];

      const selected =
        lines.slice(start, start + 4);

      if (selected.length < 2) {
        return null;
      }

      return selected.join("\n");
    }

    /*
     * ============================================================
     * MUSICBRAINZ
     * ============================================================
     *
     * IMPORTANT :
     * On ne recherche PLUS l'ID MusicBrainz de l'artiste.
     *
     * On demande directement les recordings correspondant
     * au nom de l'artiste.
     *
     * Cela supprime une série entière de requêtes et évite
     * les 503 rencontrés précédemment.
     */

    async function searchArtistRecordings(
      artistName
    ) {
      /*
       * ----------------------------------------------------------
       * CACHE
       * ----------------------------------------------------------
       *
       * On met en cache les recordings par artiste pendant 6h.
       * Cela évite de re-questionner MusicBrainz (et d'attendre
       * la pause de rate-limit) pour un artiste déjà interrogé
       * récemment par n'importe quel joueur.
       */

      const cache = caches.default;

      const cacheKey = new Request(
        "https://cache.parolesmysteres.internal/mb/" +
          encodeURIComponent(artistName)
      );

      const cachedResponse =
        await cache.match(cacheKey);

      if (cachedResponse) {
        return {
          recordings:
            await cachedResponse.json(),
          fromCache: true
        };
      }

      const cleanArtist =
        artistName.replace(/"/g, "");

      const query =
        'artist:"' +
        cleanArtist +
        '"';

      const endpoint =
        "https://musicbrainz.org/ws/2/recording" +
        "?query=" +
        encodeURIComponent(query) +
        "&fmt=json&limit=50";

      const response =
        await fetchTimeout(
          endpoint,
          {
            headers: {
              "User-Agent":
                MB_USER_AGENT,
              Accept:
                "application/json"
            }
          },
          12000
        );

      if (!response.ok) {
        throw new Error(
          "MusicBrainz recording HTTP " +
            response.status
        );
      }

      const data =
        await response.json();

      const recordings =
        data &&
        Array.isArray(
          data.recordings
        )
          ? data.recordings
          : [];

      /*
       * On écrit dans le cache en arrière-plan
       * (n'attend pas, ne ralentit pas la réponse).
       */

      ctx.waitUntil(
        cache.put(
          cacheKey,
          new Response(
            JSON.stringify(
              recordings
            ),
            {
              headers: {
                "Cache-Control":
                  "max-age=21600"
              }
            }
          )
        )
      );

      return {
        recordings,
        fromCache: false
      };
    }

    function recordingToCandidate(
      recording,
      artistName
    ) {
      if (
        !recording ||
        !recording.title
      ) {
        return null;
      }

      let year = null;

      /*
       * MusicBrainz peut fournir la date via
       * les releases associées au recording.
       */

      if (
        Array.isArray(
          recording.releases
        )
      ) {
        for (
          const release
          of recording.releases
        ) {
          const releaseYear =
            yearOf(release.date);

          if (
            releaseYear &&
            (!year ||
              releaseYear < year)
          ) {
            year = releaseYear;
          }

          if (
            release[
              "release-group"
            ]
          ) {
            const rgYear =
              yearOf(
                release[
                  "release-group"
                ]
                  .first_release_date
              );

            if (
              rgYear &&
              (!year ||
                rgYear < year)
            ) {
              year = rgYear;
            }
          }
        }
      }

      /*
       * Certaines réponses MusicBrainz peuvent
       * contenir directement first-release-date.
       */

      if (
        !year &&
        recording[
          "first-release-date"
        ]
      ) {
        year = yearOf(
          recording[
            "first-release-date"
          ]
        );
      }

      return {
        artist: artistName,
        title: recording.title,
        year: year,
        mbid: recording.id || null
      };
    }

    /*
     * ============================================================
     * LRCLIB
     * ============================================================
     */

    async function getLyrics(
      artist,
      title
    ) {
      const endpoint =
        "https://lrclib.net/api/get" +
        "?artist_name=" +
        encodeURIComponent(artist) +
        "&track_name=" +
        encodeURIComponent(title);

      const response =
        await fetchTimeout(
          endpoint,
          {
            headers: {
              Accept:
                "application/json"
            }
          },
          8000
        );

      if (!response.ok) {
        return null;
      }

      const data =
        await response.json();

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

    async function getLastFmListeners(
      artist,
      title
    ) {
      if (!LASTFM_API_KEY) {
        return null;
      }

      const endpoint =
        "https://ws.audioscrobbler.com/2.0/" +
        "?method=track.getInfo" +
        "&api_key=" +
        encodeURIComponent(
          LASTFM_API_KEY
        ) +
        "&artist=" +
        encodeURIComponent(artist) +
        "&track=" +
        encodeURIComponent(title) +
        "&format=json";

      const response =
        await fetchTimeout(
          endpoint,
          {
            headers: {
              Accept:
                "application/json"
            }
          },
          7000
        );

      if (!response.ok) {
        return null;
      }

      const data =
        await response.json();

      const listeners =
        data &&
        data.track &&
        data.track.listeners;

      if (!listeners) {
        return null;
      }

      const number =
        Number(listeners);

      return Number.isFinite(number)
        ? number
        : null;
    }

    function difficultyMatches(
      listeners,
      difficulty
    ) {
      if (
        difficulty === "all"
      ) {
        return true;
      }

      /*
       * Si Last.fm ne répond pas,
       * on conserve le morceau.
       */

      if (
        listeners === null ||
        listeners === undefined
      ) {
        return true;
      }

      if (
        difficulty === "easy"
      ) {
        return listeners >= 300000;
      }

      if (
        difficulty === "medium"
      ) {
        return (
          listeners >= 30000 &&
          listeners < 300000
        );
      }

      if (
        difficulty === "hard"
      ) {
        return listeners < 30000;
      }

      return true;
    }

    /*
     * ============================================================
     * BUILD QUESTIONS
     * ============================================================
     */

    async function buildQuestions({
      genre,
      era,
      difficulty,
      number,
      answerKey
    }) {
      const questions = [];

      const diagnostics = {
        parameters: {
          genre,
          era,
          difficulty,
          requested: number
        },

        artistsCatalog: 0,
        artistsSelected: 0,

        artistsWithRecordings: 0,
        artistsWithoutRecordings: 0,

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

      /*
       * ----------------------------------------------------------
       * CHOIX DU CATALOGUE
       * ----------------------------------------------------------
       */

      let artists = [];

      if (genre === "all") {
        for (
          const category
          of Object.keys(ARTISTS)
        ) {
          artists.push(
            ...ARTISTS[category]
          );
        }
      } else {
        artists =
          ARTISTS[genre] || [];
      }

      artists = [
        ...new Set(artists)
      ];

      diagnostics.artistsCatalog =
        artists.length;

      artists = shuffle(artists);

      /*
       * ----------------------------------------------------------
       * MUSICBRAINZ
       * ----------------------------------------------------------
       *
       * On interroge davantage d'artistes qu'avant, pour
       * garantir assez de variété (surtout avec le catalogue
       * élargi) et assez de morceaux candidats pour atteindre
       * le nombre de questions demandé même après tous les
       * filtres (paroles absentes, pas assez françaises, etc.).
       *
       * Grâce au cache, seuls les artistes non encore en cache
       * coûtent réellement la pause de rate-limit.
       */

      const targetArtistCount =
        Math.min(
          artists.length,
          Math.max(12, number * 2)
        );

      const selectedArtists =
        artists.slice(
          0,
          targetArtistCount
        );

      diagnostics.artistsSelected =
        selectedArtists.length;

      let candidates = [];

      for (
        const artistName
        of selectedArtists
      ) {
        try {
          const {
            recordings,
            fromCache
          } =
            await searchArtistRecordings(
              artistName
            );

          diagnostics.recordingsFound +=
            recordings.length;

          if (
            recordings.length === 0
          ) {
            diagnostics.artistsWithoutRecordings++;
          } else {
            diagnostics.artistsWithRecordings++;
          }

          for (
            const recording
            of recordings
          ) {
            const candidate =
              recordingToCandidate(
                recording,
                artistName
              );

            if (!candidate) {
              continue;
            }

            if (
              !isInEra(
                candidate.year,
                era
              )
            ) {
              continue;
            }

            diagnostics.recordingsAfterEra++;

            candidates.push(
              candidate
            );
          }

          /*
           * MusicBrainz demande environ
           * 1 requête/seconde -- mais seulement
           * si on a réellement interrogé l'API
           * (pas nécessaire pour un résultat en cache).
           */

          if (!fromCache) {
            await sleep(1200);
          }
        } catch (error) {
          if (
            diagnostics.errors.length <
            10
          ) {
            diagnostics.errors.push(
              "MusicBrainz " +
                artistName +
                ": " +
                String(
                  error.message ||
                    error
                )
            );
          }

          /*
           * On continue avec l'artiste
           * suivant même en cas de 503.
           */

          await sleep(1500);
        }
      }

      /*
       * ----------------------------------------------------------
       * DOUBLONS
       * ----------------------------------------------------------
       */

      const seen =
        new Set();

      candidates =
        candidates.filter(
          candidate => {
            const key =
              normalize(
                candidate.artist
              ) +
              "|" +
              normalize(
                candidate.title
              );

            if (
              seen.has(key)
            ) {
              return false;
            }

            seen.add(key);

            return true;
          }
        );

      diagnostics.recordingsAfterDuplicateFilter =
        candidates.length;

      candidates =
        shuffle(candidates);

      /*
       * On limite le nombre de requêtes LRCLIB,
       * mais on garde une marge confortable au-dessus
       * du nombre de questions demandé, car beaucoup
       * de candidats seront rejetés en cours de route
       * (paroles absentes, pas assez françaises, etc.).
       */

      candidates =
        candidates.slice(
          0,
          Math.min(
            candidates.length,
            Math.max(40, number * 6)
          )
        );

      /*
       * ----------------------------------------------------------
       * LRCLIB
       * ----------------------------------------------------------
       *
       * On traite 6 morceaux en parallèle.
       * Cela réduit fortement le temps d'attente.
       */

      const batchSize = 6;

      for (
        let i = 0;
        i < candidates.length;
        i += batchSize
      ) {
        if (
          diagnostics.questionsCreated >=
          number
        ) {
          break;
        }

        const batch =
          candidates.slice(
            i,
            i + batchSize
          );

        diagnostics.lyricsRequests +=
          batch.length;

        const results =
          await Promise.all(
            batch.map(
              async candidate => {
                try {
                  const lyrics =
                    await getLyrics(
                      candidate.artist,
                      candidate.title
                    );

                  if (!lyrics) {
                    return null;
                  }

                  const cleaned =
                    cleanLyrics(
                      lyrics
                    );

                  if (
                    !looksFrench(
                      cleaned
                    )
                  ) {
                    return {
                      candidate,
                      cleaned,
                      isFrench: false,
                      listeners: null
                    };
                  }

                  /*
                   * ----------------------------------------------
                   * LAST.FM
                   * ----------------------------------------------
                   *
                   * Fait en parallèle avec les autres
                   * candidats du batch, au lieu d'attendre
                   * chaque appel un par un.
                   */

                  let listeners = null;

                  if (
                    difficulty !== "all" &&
                    LASTFM_API_KEY
                  ) {
                    try {
                      listeners =
                        await getLastFmListeners(
                          candidate.artist,
                          candidate.title
                        );
                    } catch {
                      listeners = null;
                    }
                  }

                  return {
                    candidate,
                    cleaned,
                    isFrench: true,
                    listeners,
                    lastFmQueried:
                      difficulty !== "all" &&
                      Boolean(LASTFM_API_KEY)
                  };
                } catch {
                  return null;
                }
              }
            )
          );

        for (
          const result
          of results
        ) {
          if (
            !result ||
            diagnostics.questionsCreated >=
              number
          ) {
            continue;
          }

          diagnostics.lyricsFound++;

          if (!result.isFrench) {
            diagnostics.lyricsNotFrench++;
            continue;
          }

          diagnostics.lyricsFrench++;

          const cleaned =
            result.cleaned;

          const listeners =
            result.listeners;

          if (result.lastFmQueried) {
            diagnostics.lastFmRequests++;

            if (listeners !== null) {
              diagnostics.lastFmFound++;
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

          const excerpt =
            createExcerpt(
              cleaned
            );

          if (!excerpt) {
            continue;
          }

          diagnostics.excerptsCreated++;

          const finalDifficulty =
            difficulty === "all"
              ? "medium"
              : difficulty;

          questionsPush(
            result.candidate,
            excerpt,
            finalDifficulty,
            diagnostics
          );
        }
      }

      diagnostics.questionsCreated =
        questions.length;

      const publicQuestions =
        await Promise.all(
          questions.map(
            async q => {
              const token =
                await encryptAnswer(
                  {
                    artist: q.artist,
                    title: q.title
                  },
                  answerKey
                );

              return {
                lyrics: q.lyrics,
                year: q.year,
                difficulty:
                  q.difficulty,
                points: q.points,
                token
              };
            }
          )
        );

      return {
        questions: publicQuestions,
        diagnostics
      };

      /*
       * ----------------------------------------------------------
       * Fonction locale de création
       * ----------------------------------------------------------
       */

      function questionsPush(
        candidate,
        excerpt,
        finalDifficulty,
        diagnosticObject
      ) {
        if (
          questions.length >=
          number
        ) {
          return;
        }

        /*
         * Limite de variété : 1 seule question par
         * artiste pour une petite partie (5 questions
         * ou moins), 2 maximum au-delà.
         */

        const maxPerArtist =
          number <= 5 ? 1 : 2;

        const artistKey =
          normalize(candidate.artist);

        const alreadyUsed =
          questions.filter(
            q =>
              normalize(q.artist) ===
              artistKey
          ).length;

        if (
          alreadyUsed >= maxPerArtist
        ) {
          return;
        }

        questions.push({
          artist:
            candidate.artist,

          title:
            candidate.title,

          year:
            candidate.year,

          difficulty:
            finalDifficulty,

          lyrics:
            excerpt,

          points:
            finalDifficulty === "hard"
              ? 3
              : finalDifficulty ===
                "medium"
                ? 2
                : 1
        });

        diagnosticObject.questionsCreated =
          questions.length;
      }
    }

    /*
     * ============================================================
     * API TEST
     * ============================================================
     */

    if (
      url.pathname ===
      "/api/test"
    ) {
      return json({
        success: true,
        message:
          "Paroles Mystères API fonctionne !"
      });
    }

    /*
     * ============================================================
     * API MUSICBRAINZ
     * ============================================================
     */

    if (
      url.pathname ===
      "/api/musicbrainz"
    ) {
      const artist =
        url.searchParams.get(
          "artist"
        );

      const title =
        url.searchParams.get(
          "title"
        );

      if (!artist || !title) {
        return json(
          {
            success: false,
            error:
              "Artiste et titre requis."
          },
          400
        );
      }

      try {
        const query =
          'recording:"' +
          title.replace(
            /"/g,
            ""
          ) +
          '" AND artist:"' +
          artist.replace(
            /"/g,
            ""
          ) +
          '"';

        const endpoint =
          "https://musicbrainz.org/ws/2/recording" +
          "?query=" +
          encodeURIComponent(
            query
          ) +
          "&fmt=json&limit=5";

        const response =
          await fetchTimeout(
            endpoint,
            {
              headers: {
                "User-Agent":
                  MB_USER_AGENT,
                Accept:
                  "application/json"
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

        const data =
          await response.json();

        return json({
          success: true,
          artist,
          title,
          recordings:
            data.recordings ||
            []
        });
      } catch (error) {
        return json(
          {
            success: false,
            error: String(
              error.message ||
                error
            )
          },
          500
        );
      }
    }

    /*
     * ============================================================
     * API LYRICS
     * ============================================================
     */

    if (
      url.pathname ===
      "/api/lyrics"
    ) {
      const artist =
        url.searchParams.get(
          "artist"
        );

      const title =
        url.searchParams.get(
          "title"
        );

      if (!artist || !title) {
        return json(
          {
            success: false,
            error:
              "Artiste et titre requis."
          },
          400
        );
      }

      try {
        const lyrics =
          await getLyrics(
            artist,
            title
          );

        return json({
          success: true,
          artist,
          title,
          found:
            Boolean(lyrics),
          lyrics:
            lyrics || null
        });
      } catch (error) {
        return json(
          {
            success: false,
            error: String(
              error.message ||
                error
            )
          },
          500
        );
      }
    }

    /*
     * ============================================================
     * API QUESTIONS
     * ============================================================
     */

    if (
      url.pathname ===
      "/api/questions"
    ) {
      const genre =
        url.searchParams.get(
          "genre"
        ) || "all";

      const era =
        url.searchParams.get(
          "era"
        ) || "all";

      const difficulty =
        url.searchParams.get(
          "difficulty"
        ) || "all";

      const requestedNumber =
        Number(
          url.searchParams.get(
            "number"
          ) || "10"
        );

      const number =
        Math.min(
          Math.max(
            Number.isFinite(
              requestedNumber
            )
              ? requestedNumber
              : 10,
            1
          ),
          30
        );

      try {
        const answerKey =
          await getAnswerKey();

        const result =
          await buildQuestions({
            genre,
            era,
            difficulty,
            number,
            answerKey
          });

        return json({
          success: true,

          questions:
            result.questions,

          requested:
            number,

          count:
            result.questions.length,

          diagnostics:
            result.diagnostics
        });
      } catch (error) {
        return json(
          {
            success: false,
            error: String(
              error.message ||
                error
            )
          },
          500
        );
      }
    }

    /*
     * ============================================================
     * API VALIDATE
     * ============================================================
     *
     * Vérifie la réponse du joueur côté serveur, à partir du
     * jeton chiffré reçu avec la question. La bonne réponse
     * n'est jamais renvoyée avant cet appel.
     */

    if (
      url.pathname === "/api/validate" &&
      request.method === "POST"
    ) {
      let body;

      try {
        body = await request.json();
      } catch {
        return json(
          {
            success: false,
            error:
              "Corps de requête JSON invalide."
          },
          400
        );
      }

      const token =
        body && body.token;

      if (!token) {
        return json(
          {
            success: false,
            error:
              "Jeton de question manquant."
          },
          400
        );
      }

      try {
        const answerKey =
          await getAnswerKey();

        const answer =
          await decryptAnswer(
            token,
            answerKey
          );

        const playerArtist =
          normalize(
            body.artist || ""
          );

        const playerTitle =
          normalize(
            body.title || ""
          );

        const expectedArtist =
          normalize(answer.artist);

        const expectedTitle =
          normalize(answer.title);

        let points = 0;

        if (
          playerArtist !== "" &&
          playerArtist ===
            expectedArtist
        ) {
          points++;
        }

        if (
          playerTitle !== "" &&
          playerTitle ===
            expectedTitle
        ) {
          points++;
        }

        return json({
          success: true,
          points,
          correctArtist:
            answer.artist,
          correctTitle:
            answer.title
        });
      } catch (error) {
        return json(
          {
            success: false,
            error:
              "Jeton invalide ou expiré."
          },
          400
        );
      }
    }

    /*
     * ============================================================
     * ASSETS STATIQUES (public/)
     * ============================================================
     *
     * Toute route qui n'est pas une API est servie
     * depuis les fichiers statiques de public/
     * (index.html, CSS, JS, etc.).
     */

    return env.ASSETS.fetch(request);
  }
};
