// 1. Gehe in Google Drive zu dem Ordner "BMD_Auto_Import"
// 2. Dieses Script muss über script.google.com als "Google Apps Script" angelegt werden.
// 3. Füge diesen Code ein:

const VERCEL_WEBHOOK_URL = "https://DEINE-VERCEL-APP-URL.vercel.app/api/process";
const FOLDER_ID = "1CzER2jU6RQQUP2ModeyYtBR1zgYaQau1"; // Deine BMD_Auto_Import Folder ID
const WEBHOOK_SECRET = "DEIN_GEHEIMER_WEBHOOK_SECRET"; // Dasselbe wie in Vercel als WEBHOOK_SECRET

function onFileAdded(e) {
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files = folder.getFiles();
  
  var props = PropertiesService.getScriptProperties();
  
  while (files.hasNext()) {
    var file = files.next();
    var fileId = file.getId();
    
    // Prüfen, ob wir diese Datei schon verarbeitet haben
    var processed = props.getProperty("processed_" + fileId);
    if (!processed) {
      
      var payload = {
        "fileId": fileId
      };
      
      var options = {
        "method" : "post",
        "contentType": "application/json",
        "headers": {
          "Authorization": "Bearer " + WEBHOOK_SECRET
        },
        "payload" : JSON.stringify(payload)
      };
      
      try {
        UrlFetchApp.fetch(VERCEL_WEBHOOK_URL, options);
        Logger.log("Webhook fired for file: " + file.getName());
        
        // Datei als verarbeitet markieren, damit wir sie beim nächsten Durchlauf überspringen
        props.setProperty("processed_" + fileId, "true");
        
      } catch (error) {
        Logger.log("Error firing webhook: " + error);
      }
    }
  }
}

// Optional: Regelmäßiges Aufräumen der Properties, um das Quota nicht zu sprengen
function cleanupProperties() {
  var props = PropertiesService.getScriptProperties();
  var keys = props.getKeys();
  var folder = DriveApp.getFolderById(FOLDER_ID);
  
  // Wir iterieren über alle verarbeiteten IDs.
  // Wenn die Datei nicht mehr im Ordner ist (z.B. weil der Webhook sie gelöscht oder verschoben hat), 
  // können wir die Property löschen.
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (key.indexOf("processed_") === 0) {
      var fileId = key.substring(10);
      try {
        var fileIter = folder.searchFiles('id="' + fileId + '"');
        if (!fileIter.hasNext()) {
          props.deleteProperty(key);
        }
      } catch(e) {
        props.deleteProperty(key);
      }
    }
  }
}

// 4. Gehe im Apps Script Editor auf "Trigger" (die Uhr im linken Menü)
// 5. Klicke "Trigger hinzufügen"
// 6. Wähle die Funktion `onFileAdded`
// 7. Wähle als Ereignisquelle: "Zeitgesteuert" -> "Minutentimer" -> "Jede Minute"
// 8. Richte einen zweiten Trigger für `cleanupProperties` ein: "Zeitgesteuert" -> "Tagestimer" (einmal am Tag aufräumen)
