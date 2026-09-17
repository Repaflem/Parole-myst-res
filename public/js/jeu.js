document.addEventListener(
    "DOMContentLoaded",
    function () {

        const languageSelect =
            document.getElementById(
                "language"
            );

        const genreSelect =
            document.getElementById(
                "genre"
            );

        const eraSelect =
            document.getElementById(
                "era"
            );

        const difficultySelect =
            document.getElementById(
                "difficulty"
            );

        const numberSelect =
            document.getElementById(
                "number"
            );

        const startButton =
            document.getElementById(
                "start-game"
            );

        if (
            !languageSelect ||
            !genreSelect ||
            !eraSelect ||
            !difficultySelect ||
            !numberSelect ||
            !startButton
        ) {
            console.error(
                "Impossible de trouver les éléments de configuration."
            );

            return;
        }

        startButton.addEventListener(
            "click",
            function () {

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

                localStorage.setItem(
                    "parolesMysteresSettings",
                    JSON.stringify(
                        gameSettings
                    )
                );

                window.location.href =
                    "question.html";
            }
        );
    }
);
```
