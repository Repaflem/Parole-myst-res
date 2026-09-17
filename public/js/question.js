document.addEventListener("DOMContentLoaded", async function () {

    // =========================================================
    // ÉLÉMENTS HTML
    // =========================================================

    const lyricsElement =
        document.getElementById("lyrics");

    const currentQuestionElement =
        document.getElementById(
            "current-question"
        );

    const totalQuestionsElement =
        document.getElementById(
            "total-questions"
        );

    const artistInput =
        document.getElementById("artist");

    const titleInput =
        document.getElementById("title");

    const validateButton =
        document.getElementById(
            "validate-answer"
        );

    const nextQuestionButton =
        document.getElementById(
            "next-question"
        );

    const answerCard =
        document.getElementById(
            "answer-card"
        );

    const resultCard =
        document.getElementById(
            "result-card"
        );

    const resultIcon =
        document.getElementById(
            "result-icon"
        );

    const resultTitle =
        document.getElementById(
            "result-title"
        );

    const resultMessage =
        document.getElementById(
            "result-message"
        );

    const correctArtist =
        document.getElementById(
            "correct-artist"
        );

    const correctTitle =
        document.getElementById(
            "correct-title"
        );

    const pointsEarned =
        document.getElementById(
            "points-earned"
        );

    const scoreElement =
        document.getElementById(
            "score"
        );


    // =========================================================
    // VÉRIFICATION
    // =========================================================

    if (
        !lyricsElement ||
        !validateButton
    ) {

        console.error(
            "Impossible de trouver les éléments du quiz."
        );

        return;

    }


    // =========================================================
    // PARAMÈTRES
    // =========================================================

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
                "Impossible de lire les paramètres.",
                error
            );

            settings = null;

        }

    }


    if (!settings) {

        settings = {

            genre: "all",

            era: "all",

            difficulty: "all",

            number: 10

        };

    }


    // =========================================================
    // VARIABLES
    // =========================================================

    let currentQuestionIndex = 0;

    let score = 0;

    let gameQuestions = [];


    // =========================================================
    // NORMALISATION
    // =========================================================

    function normalizeText(text) {

        return String(text)

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


    // =========================================================
    // CHARGEMENT DES QUESTIONS
    // =========================================================

    async function loadQuestions() {

        lyricsElement.textContent =
            "Recherche des chansons...";

        validateButton.disabled = true;


        try {

            const params =
                new URLSearchParams({

                    genre:
                        settings.genre,

                    era:
                        settings.era,

                    difficulty:
                        settings.difficulty,

                    number:
                        settings.number

                });


            const response =
                await fetch(
                    `/api/questions?${params.toString()}`
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
                !data.questions ||
                !Array.isArray(
                    data.questions
                )
            ) {

                throw new Error(
                    "Réponse API invalide."
                );

            }


            gameQuestions =
                data.questions;


            if (
                gameQuestions.length === 0
            ) {

                throw new Error(
                    "Aucune question disponible."
                );

            }


            totalQuestionsElement.textContent =
                gameQuestions.length;


            return true;


        } catch (error) {

            console.error(
                "Erreur lors du chargement des questions :",
                error
            );


            lyricsElement.textContent =
                "Impossible de charger les questions. Réessaie dans quelques instants.";


            return false;

        }

    }


    // =========================================================
    // AFFICHER UNE QUESTION
    // =========================================================

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


    // =========================================================
    // SCORE
    // =========================================================

    function updateScore() {

        scoreElement.textContent =
            score;

    }


    // =========================================================
    // VÉRIFICATION DE LA RÉPONSE
    // =========================================================

    function checkAnswer() {

        const question =
            gameQuestions[
                currentQuestionIndex
            ];


        if (!question) {

            return;

        }


        const playerArtist =
            normalizeText(
                artistInput.value
            );


        const playerTitle =
            normalizeText(
                titleInput.value
            );


        const expectedArtist =
            normalizeText(
                question.artist
            );


        const expectedTitle =
            normalizeText(
                question.title
            );


        let points = 0;


        // Artiste

        if (
            playerArtist !== "" &&
            playerArtist === expectedArtist
        ) {

            points++;

        }


        // Titre

        if (
            playerTitle !== "" &&
            playerTitle === expectedTitle
        ) {

            points++;

        }


        score += points;


        updateScore();


        showResult(
            question,
            points
        );

    }


    // =========================================================
    // AFFICHER LE RÉSULTAT
    // =========================================================

    function showResult(
        question,
        points
    ) {

        validateButton.disabled =
            true;


        answerCard.style.display =
            "none";


        correctArtist.textContent =
            question.artist;


        correctTitle.textContent =
            question.title;


        pointsEarned.textContent =
            points;


        if (points === 2) {

            resultIcon.textContent =
                "🎉";

            resultTitle.textContent =
                "Excellent !";

            resultMessage.textContent =
                "Tu as trouvé l'artiste et le titre !";

        }

        else if (points === 1) {

            resultIcon.textContent =
                "👍";

            resultTitle.textContent =
                "Bien joué !";

            resultMessage.textContent =
                "Tu as trouvé une des deux réponses.";

        }

        else {

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

        }

        else {

            nextQuestionButton.textContent =
                "Question suivante →";

        }

    }


    // =========================================================
    // QUESTION SUIVANTE
    // =========================================================

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


    // =========================================================
    // FIN DU JEU
    // =========================================================

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


        correctArtist.parentElement
            .style.display =
            "none";


        correctTitle.parentElement
            .style.display =
            "none";


        const pointsLabel =
            document.querySelector(
                ".points-earned"
            );


        if (pointsLabel) {

            pointsLabel.innerHTML =
                "🏆 Score final : " +
                "<span id=\"points-earned\">" +
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


    // =========================================================
    // BOUTON VALIDER
    // =========================================================

    validateButton.addEventListener(
        "click",
        function () {

            checkAnswer();

        }
    );


    // =========================================================
    // BOUTON SUIVANT
    // =========================================================

    nextQuestionButton.addEventListener(
        "click",
        function () {

            nextQuestion();

        }
    );


    // =========================================================
    // TOUCHE ENTRÉE
    // =========================================================

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


    // =========================================================
    // LANCEMENT
    // =========================================================

    const success =
        await loadQuestions();


    if (success) {

        displayQuestion();

        updateScore();

    }

});
