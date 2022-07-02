
import Numworks from '../Numworks.js'

var calculator = new Numworks();

var status = document.getElementById("status");
var connect = document.getElementById("connect");
var content = document.getElementById("content");

navigator.usb.addEventListener("disconnect", function(e) {
  calculator.onUnexpectedDisconnect(e, function() {
    status.innerHTML = "Disconnected.";
    content.innerHTML = "Please connect your Numworks.";
    connect.disabled = false;
    calculator.autoConnect(autoConnectHandler);
  });
});

calculator.autoConnect(autoConnectHandler);

function autoConnectHandler(e) {
  calculator.stopAutoConnect();
  connected();
}

connect.onclick = function(e) {
  calculator.detect(function() {
    calculator.stopAutoConnect();
    connected();
  }, function(error) {
    status.innerHTML = "Error: " + error;
  });
};

async function connected() {
  connect.disabled = true;
  status.innerHTML = "Connected.";

  var model = calculator.getModel(false);

  var html_content = "Model: " + calculator.getModel(false) + "<br/>";

  // Get the platform information
  var platformInfo = await calculator.getPlatformInfo();
  console.log(platformInfo);

  // Backup the storage
  // var storage = await calculator.backupStorage();
  // console.log(storage);

  content.innerHTML = html_content;
}

