// Sélection des éléments
// const inputField = document.querySelector(".inputfield");
// const input = document.querySelectorAll(".input");
// const inputNumero = document.getElementById("numero");
// const submitButton = document.getElementById("submit");
// const refreshButton = document.getElementById("refresh");
//
// let inputCount = 0;
// let finalInput = "";
//
// // Mettre à jour la configuration des inputs
// const updateInputConfig = (element, disabled) => {
//   element.disabled = disabled;
//     if (!disabled) {
//         element.focus();
//           }
//           };
//
//           // Gérer la saisie des chiffres
//           const handleInput = (e) => {
//             const value = e.target.value;
//               if (value.length === 1) {
//                   finalInput += value;
//                       inputCount++;
//                           if (inputCount < 3) {
//                                 updateInputConfig(e.target.nextElementSibling, false);
//                                     } else {
//                                           inputNumero.value = finalInput;
//                                                 submitButton.classList.remove("hide");
//                                                       refreshButton.classList.remove("hide");
//                                                           }
//                                                             }
//                                                             };
//
//                                                             // Fonction pour rechercher les rifas
//                                                             const searchRifas = () => {
//                                                               if (finalInput.length === 3) {
//                                                                   document.forms["formRifas"].submit();
//                                                                     } else {
//                                                                         alert("Por favor, insira um número de 3 dígitos.");
//                                                                           }
//                                                                           };
//
//                                                                           // Démarrer la saisie
//                                                                           const startInput = () => {
//                                                                             inputCount = 0;
//                                                                               finalInput = "";
//                                                                                 input.forEach((element) => {
//                                                                                     element.value = "";
//                                                                                         element.disabled = true;
//                                                                                           });
//                                                                                             updateInputConfig(inputField.firstElementChild, false);
//                                                                                               submitButton.classList.add("hide");
//                                                                                                 refreshButton.classList.add("hide");
//                                                                                                 };
//
//                                                                                                 // Ajouter les écouteurs d'événements
//                                                                                                 input.forEach((element) => {
//                                                                                                   element.addEventListener("input", handleInput);
//                                                                                                   });
//
//                                                                                                   // Initialisation
//                                                                                                   window.onload = startInput;
