function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.openById('1zqDQY6Sddi8k2qfqEKmYMiZUB0Yg7Y2phsfFiaNKTMI');
  var sheet = ss.getSheetByName('Visits');
  if (!sheet) {
    sheet = ss.insertSheet('Visits');
    sheet.appendRow(['First Name', 'Surname', 'Email', 'Event', 'Puzzle', 'Client Timestamp', 'Server Timestamp']);
  }
  sheet.appendRow([
    data.firstName || '',
    data.surname || '',
    data.email || '',
    data.event || '',
    data.puzzle || '',
    data.timestamp || '',
    new Date()
  ]);
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
