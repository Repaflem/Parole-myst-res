document.addEventListener("DOMContentLoaded", function () {

    const bouton = document.querySelector(
        ".game-start-button"
    );

    if (!bouton) {

        console.error(
            "Bouton de démarrage introuvable."
        );

        return;
    }

    bouton.addEventListener(
        "click",
        function (event) {

            event.preventDefault();

            // Récupération des choix du joueur

            const genre =
                document.getElementById(
                    "genre"
                ).value;

            const era =
                document.getElementById(
                    "era"
                ).value;

            const difficulty =
                document.getElementById(
                    "difficulty"
                ).value;

            const number =
                document.getElementById(
                    "number"
                ).value;

            // Création de la configuration

            const gameSettings = {

                genre: genre,

                era: era,

                difficulty: difficulty,

                number: Number(number)

            };

            // Sauvegarde

            localStorage.setItem(
                "parolesMysteresSettings",
                JSON.stringify(
                    gameSettings
                )
            );

            // Lancement du quiz

            window.location.href =
                "question.html";

        }
    );

});
