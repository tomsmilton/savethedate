window.APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzmIwbl_BXWo5DewBj6YXH4vsriTkBMoGoY6a8tlTQ27u4NDR-vzoKI8fFMtVdR9pQE5g/exec';

window.trackEvent = function(event, puzzle) {
  var guestName = localStorage.getItem('guestName');
  if (!guestName || !window.APPS_SCRIPT_URL) return;
  var data = {
    firstName: localStorage.getItem('guestFirstName') || '',
    surname: localStorage.getItem('guestSurname') || '',
    email: localStorage.getItem('guestEmail') || '',
    name: guestName,
    event: event,
    timestamp: new Date().toISOString()
  };
  if (puzzle) data.puzzle = puzzle;
  fetch(window.APPS_SCRIPT_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(data) }).catch(function() {});
};
