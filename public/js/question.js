document.addEventListener("DOMContentLoaded", async function () {

    const lyricsElement =
        document.getElementById("lyrics");

    const currentQuestionElement =
        document.getElementById("current-question");

    const totalQuestionsElement =
        document.getElementById("total-questions");

    const artistInput =
        document.getElementById("artist");

    const titleInput =
        document.getElementById("title");

    const validateButton =
        document.getElementById("validate-answer");

    const nextQuestionButton =
        document.getElementById("next-question");

    const answerCard =
        document.getElementById("answer-card");

    const resultCard =
        document.getElementById("result-card");

    const resultIcon =
        document.getElementById("result-icon");

    const resultTitle =
        document.getElementById("result-title");

    const resultMessage =
        document.getElementById("result-message");

    const correctArtist =
        document.getElementById("correct-artist");

    const correctTitle =
        document.getElementById("correct-title");

    const pointsEarned =
        document.getElementById("points-earned");

    const scoreElement =
        document.getElementById("score");


    /*
     * Vérification des éléments de la page.
     */

    if (
        !lyricsElement ||
        !currentQuestionElement ||
        !totalQuestionsElement ||
        !artistInput ||
        !titleInput ||
        !validateButton ||
        !nextQuestionButton ||
        !answerCard ||
        !resultCard ||
        !resultIcon ||
        !resultTitle ||
        !resultMessage ||
        !correctArtist ||
        !correctTitle ||
        !pointsEarned ||
        !scoreElement
    ) {

        console.error(
            "Paroles Mystères : certains éléments du quiz sont introuvables."
        );

        return;
    }


    /*
     * Récupération des paramètres
     * de la partie.
     */

    let settings =
        localStorage.getItem(
            "parolesMysteresSettings"
        );


    if (settings) {

        try {

            settings =
                JSON.parse(settings);

        } catch (error) {

            console.error(
                "Impossible de lire les paramètres de la partie.",
                error
            );

            settings = null;
        }
    }


    /*
     * Paramètres par défaut.
     *
     * Le jeu est exclusivement
     * francophone.
     */

    if (!settings) {

        settings = {

            genre: "all",

            era: "all",

            difficulty: "all",

            number: 10
        };
    }


    if (!settings.genre) {

        settings.genre = "all";
    }


    if (!settings.era) {

        settings.era = "all";
    }


    if (!settings.difficulty) {

        settings.difficulty = "all";
    }


    if (!settings.number) {

        settings.number = 10;
    }


    /*
     * Variables de la partie.
     */

    let currentQuestionIndex = 0;

    let score = 0;

    let gameQuestions = [];


    /*
     * Chargement des questions.
     *
     * IMPORTANT : les questions reçues ici ne contiennent
     * jamais l'artiste ni le titre en clair, seulement les
     * paroles et un jeton chiffré. La bonne réponse n'existe
     * nulle part côté client tant que le joueur n'a pas validé
     * sa réponse (voir checkAnswer).
     */

    async function loadQuestions() {

        lyricsElement.textContent =
            "🎵 Recherche des chansons...";

        validateButton.disabled = true;


        try {

            const params =
                new URLSearchParams();

            params.set(
                "genre",
                settings.genre
            );

            params.set(
                "era",
                settings.era
            );

            params.set(
                "difficulty",
                settings.difficulty
            );

            params.set(
                "number",
                String(settings.number)
            );


            const url =
                "/api/questions?" +
                params.toString();


            const response =
                await fetch(
                    url,
                    {
                        method: "GET",
                        cache: "no-store",
                        headers: {
                            "Accept": "application/json"
                        }
                    }
                );


            if (!response.ok) {

                throw new Error(
                    "Erreur HTTP " +
                    response.status
                );
            }


            const responseText =
                await response.text();


            if (!responseText.trim()) {

                throw new Error(
                    "L'API a renvoyé une réponse vide."
                );
            }


            let data;

            try {

                data =
                    JSON.parse(
                        responseText
                    );

            } catch (jsonError) {

                console.error(
                    "Réponse reçue mais JSON invalide."
                );

                throw new Error(
                    "La réponse de l'API n'est pas un JSON valide."
                );
            }


            if (
                data.success !== true
            ) {

                throw new Error(
                    data.message ||
                    "L'API a indiqué une erreur."
                );
            }


            if (
                !Array.isArray(
                    data.questions
                )
            ) {

                throw new Error(
                    "La réponse de l'API ne contient pas de liste de questions."
                );
            }


            if (
                data.questions.length === 0
            ) {

                throw new Error(
                    "Aucune question disponible avec ces paramètres."
                );
            }


            gameQuestions =
                data.questions;


            totalQuestionsElement.textContent =
                gameQuestions.length;


            console.log(
                "Paroles Mystères : " +
                gameQuestions.length +
                " question(s) chargée(s)."
            );


            return true;


        } catch (error) {

            console.error(
                "Paroles Mystères : erreur lors du chargement des questions :",
                error.message
            );


            lyricsElement.textContent =
                "❌ Impossible de charger les questions. Réessaie dans quelques instants.";


            return false;
        }
    }


    /*
     * Affichage d'une question.
     */

    function displayQuestion() {

        const question =
            gameQuestions[
                currentQuestionIndex
            ];


        if (!question) {

            endGame();

            return;
        }


        currentQuestionElement.textContent =
            currentQuestionIndex + 1;


        lyricsElement.textContent =
            question.lyrics;


        artistInput.value = "";

        titleInput.value = "";


        answerCard.style.display =
            "block";


        resultCard.style.display =
            "none";


        validateButton.disabled =
            false;


        artistInput.focus();
    }


    /*
     * Mise à jour du score.
     */

    function updateScore() {

        scoreElement.textContent =
            score;
    }


    /*
     * Vérification de la réponse.
     *
     * La comparaison se fait entièrement côté serveur :
     * on envoie le jeton de la question + la saisie du
     * joueur à /api/validate, qui renvoie les points et
     * la bonne réponse (jamais l'inverse).
     */

    async function checkAnswer() {

        const question =
            gameQuestions[
                currentQuestionIndex
            ];


        if (!question) {

            return;
        }


        validateButton.disabled =
            true;


        try {

            const response =
                await fetch(
                    "/api/validate",
                    {
                        method: "POST",
                        cache: "no-store",
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        },
                        body: JSON.stringify({
                            token: question.token,
                            artist: artistInput.value,
                            title: titleInput.value
                        })
                    }
                );


            if (!response.ok) {

                throw new Error(
                    "Erreur HTTP " +
                    response.status
                );
            }


            const data =
                await response.json();


            if (
                data.success !== true
            ) {

                throw new Error(
                    data.error ||
                    "Validation impossible."
                );
            }


            score += data.points;


            updateScore();


            showResult(
                data.points,
                data.correctArtist,
                data.correctTitle
            );


        } catch (error) {

            console.error(
                "Paroles Mystères : erreur lors de la validation :",
                error.message
            );

            validateButton.disabled =
                false;

            lyricsElement.textContent =
                "❌ Impossible de vérifier ta réponse. Réessaie.";
        }
    }


    /*
     * Affichage du résultat.
     */

    function showResult(
        points,
        artistName,
        titleName
    ) {

        answerCard.style.display =
            "none";


        correctArtist.textContent =
            artistName;


        correctTitle.textContent =
            titleName;


        pointsEarned.textContent =
            points;


        if (points === 2) {

            resultIcon.textContent =
                "🎉";

            resultTitle.textContent =
                "Excellent !";

            resultMessage.textContent =
                "Tu as trouvé l'artiste et le titre.";

        } else if (points === 1) {

            resultIcon.textContent =
                "👍";

            resultTitle.textContent =
                "Bien joué !";

            resultMessage.textContent =
                "Tu as trouvé une des deux réponses.";

        } else {

            resultIcon.textContent =
                "❌";

            resultTitle.textContent =
                "Dommage !";

            resultMessage.textContent =
                "Tu feras mieux à la prochaine.";
        }


        resultCard.style.display =
            "block";


        if (
            currentQuestionIndex >=
            gameQuestions.length - 1
        ) {

            nextQuestionButton.textContent =
                "Voir mon score 🏆";

        } else {

            nextQuestionButton.textContent =
                "Question suivante →";
        }
    }


    /*
     * Passage à la question suivante.
     */

    function nextQuestion() {

        currentQuestionIndex++;


        if (
            currentQuestionIndex >=
            gameQuestions.length
        ) {

            endGame();

            return;
        }


        displayQuestion();
    }


    /*
     * Fin de la partie.
     */

    function endGame() {

        answerCard.style.display =
            "none";


        resultCard.style.display =
            "block";


        resultIcon.textContent =
            "🏆";


        resultTitle.textContent =
            "Partie terminée !";


        resultMessage.textContent =
            "Voici ton score final :";


        const artistRow =
            correctArtist.parentElement;


        const titleRow =
            correctTitle.parentElement;


        if (artistRow) {

            artistRow.style.display =
                "none";
        }


        if (titleRow) {

            titleRow.style.display =
                "none";
        }


        const pointsLabel =
            document.querySelector(
                ".points-earned"
            );


        if (pointsLabel) {

            pointsLabel.innerHTML =
                "🏆 Score final : " +
                "<span>" +
                score +
                " / " +
                (
                    gameQuestions.length *
                    2
                ) +
                "</span>";
        }


        nextQuestionButton.textContent =
            "Rejouer 🔄";


        nextQuestionButton.onclick =
            function () {

                window.location.href =
                    "jeu.html";
            };


        currentQuestionElement.textContent =
            gameQuestions.length;
    }


    /*
     * Bouton "Valider".
     */

    validateButton.addEventListener(
        "click",
        function () {

            checkAnswer();
        }
    );


    /*
     * Bouton "Question suivante".
     */

    nextQuestionButton.addEventListener(
        "click",
        function () {

            nextQuestion();
        }
    );


    /*
     * Touche Entrée dans le champ artiste.
     */

    artistInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter" &&
                !validateButton.disabled
            ) {

                checkAnswer();
            }
        }
    );


    /*
     * Touche Entrée dans le champ titre.
     */

    titleInput.addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter" &&
                !validateButton.disabled
            ) {

                checkAnswer();
            }
        }
    );


    /*
     * Chargement initial.
     */

    const success =
        await loadQuestions();


    if (success) {

        displayQuestion();

        updateScore();
    }

});
