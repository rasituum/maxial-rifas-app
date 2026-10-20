//Initial references
const input = document.querySelectorAll(".input");
const inputField = document.querySelector(".inputfield");
const submitButton = document.getElementById("submit");
const refreshButton = document.getElementById("refresh");
const inputNumero = document.getElementById("numero");
let inputCount = 0,
  finalInput = "";

//Update input
const updateInputConfig = (element, disabledStatus) => {
  element.disabled = disabledStatus;
  if (!disabledStatus) {
    element.focus();
  } else {
    element.blur();
  }
};

input.forEach((element) => {
  element.addEventListener("keyup", (e) => {
    e.target.value = e.target.value.replace(/[^0-9]/g, "");
    let { value } = e.target;

    if (value.length == 1) {
      updateInputConfig(e.target, true);
      if (inputCount <= 2 && e.key != "Backspace") {
        finalInput += value;
        if (inputCount < 2) {
          updateInputConfig(e.target.nextElementSibling, false);
        }
      }
      inputCount += 1;
    } else if (value.length == 0 && e.key == "Backspace") {
      finalInput = finalInput.substring(0, finalInput.length - 1);
      if (inputCount == 0) {
        updateInputConfig(e.target, false);
        return false;
      }
      updateInputConfig(e.target, true);
      e.target.previousElementSibling.value = "";
      updateInputConfig(e.target.previousElementSibling, false);
      inputCount -= 1;
    } else if (value.length > 1) {
      e.target.value = value.split("")[0];
    }
    classButtons("hide","show");
    
  });
});

window.addEventListener("keyup", (e) => {
  if (inputCount > 2) {
    classButtons("show","hide")
    if (e.key == "Backspace") {
      finalInput = finalInput.substring(0, finalInput.length - 1);
      updateInputConfig(inputField.lastElementChild, false);
      inputField.lastElementChild.value = "";
      inputCount -= 1;
      classButtons("hide","show");
    }
  }
});

const classButtons = (add, remove) => {
  submitButton.classList.add(add);
  submitButton.classList.remove(remove);
  refreshButton.classList.add(add);
  refreshButton.classList.remove(remove);
}

const searchRifas = () => {
  if (finalInput.startsWith("00")){
    inputNumero.value = finalInput.substring(2);
  } else if (finalInput.startsWith("0")){
    inputNumero.value = finalInput.substring(1);
  } else {
    inputNumero.value = finalInput;
  }
//  alert("2_"+inputNumero.value);
};

//Start
const startInput = () => {
  inputCount = 0;
  finalInput = "";
  input.forEach((element) => {
    element.value = "";
  });
  updateInputConfig(inputField.firstElementChild, false);
};

window.onload = startInput();
