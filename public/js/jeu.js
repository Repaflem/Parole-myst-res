document.addEventListener(

"DOMContentLoaded",

function () {

const startButton =

document.getElementById("start-game");


/*

* Vérification de l'élément de la page.

*/

if (!startButton) {

console.error(

"Paroles Mystères : impossible de trouver le bouton de lancement."

);

return;
}


/*

* Lecture de la valeur sélectionnée

* dans un groupe de boutons radio (chips).

*/

function getSelectedValue(fieldName) {

const checked =

document.querySelector(

'input[name="' +

fieldName +

'"]:checked'

);

return checked ? checked.value : null;
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

genre:

getSelectedValue("genre") ||

"all",

era:

getSelectedValue("era") ||

"all",

difficulty:

getSelectedValue("difficulty") ||

"all",

number:

Number(

getSelectedValue("number") ||

"10"
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
