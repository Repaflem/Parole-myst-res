document.addEventListener(
    "DOMContentLoaded",
    function () {

        const languageSelect =
            document.getElementById("language");

        const genreSelect =
            document.getElementById("genre");

        const eraSelect =
            document.getElementById("era");

        const difficultySelect =
            document.getElementById("difficulty");

        const numberSelect =
            document.getElementById("number");

        const startButton =
            document.getElementById("start-game");


        /*
         * Vérification des éléments de la page.
         */

        if (
            !languageSelect ||
            !genreSelect ||
            !eraSelect ||
            !difficultySelect ||
            !numberSelect ||
            !startButton
        ) {

            console.error(
                "Paroles Mystères : impossible de trouver les éléments de configuration."
            );

            return;
        }


        /*
         * Gestion du lancement de la partie.
         */

        startButton.addEventListener(
            "click",
            function () {

                /*
                 * Récupération des paramètres.
                 */

                const gameSettings = {

                    language:
                        languageSelect.value,

                    genre:
                        genreSelect.value,

                    era:
                        eraSelect.value,

                    difficulty:
                        difficultySelect.value,

                    number:
                        Number(
                            numberSelect.value
                        )
                };


                /*
                 * Vérification du nombre
                 * de questions.
                 */

                if (
                    !gameSettings.number ||
                    gameSettings.number < 1
                ) {

                    console.error(
                        "Nombre de questions invalide."
                    );

                    return;
                }


                /*
                 * Sauvegarde des paramètres.
                 */

                try {

                    localStorage.setItem(
                        "parolesMysteresSettings",
                        JSON.stringify(
                            gameSettings
                        )
                    );

                } catch (error) {

                    console.error(
                        "Impossible de sauvegarder les paramètres :",
                        error
                    );

                    return;
                }


                /*
                 * Passage à la page du quiz.
                 */

                window.location.href =
                    "question.html";
            }
        );

    }
);
