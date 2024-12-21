let currentTempHandler = Virtual.getHandle('number:200');
let targetTempHandler = Virtual.getHandle('number:201');
let hysteresis = 0.2;

function checkHeating(targetTemp, currentTemp, hysteresis, isHeating){
  
  if(isHeating){
    if(currentTemp - targetTemp < 0){
      print('weiter heizen');
      return true;
    } else {
      print('nicht mehr heizen');
      return false;
    }
  }
  else {
    if(targetTemp - hysteresis >= currentTemp){
      print('starte heizen');
      return true;
    } else {
      print('warm genug, nicht heizen');
      return false;
    }
  } 
}

function havacLoop(){
  let targetTemp = targetTempHandler.getValue();
  let currentTemp = currentTempHandler.getValue();
  let currentValveState = Shelly.getComponentStatus('switch:0').output;
  
  let nextValveState = checkHeating(targetTemp, currentTemp, hysteresis, currentValveState );
  if(currentValveState !== nextValveState ) {
     print('Neuer Ventilstatus: ' + nextValveState);
     Shelly.call("Switch.set", {'id': 0, 'on': nextValveState});
  }   
  
  sendStatusMessage(targetTemp, currentTemp, nextValveState);
}

function sendStatusMessage(targetTemp, currentTemp, valveState) {
  var message = {
    target_T: targetTemp,
    current_T: currentTemp,
    action: valveState ? 'heating' : 'off',
    valveId: 0
  };
  
  MQTT.publish('shellypro4pm-fbh/havacstatus0', JSON.stringify(message) );
}

Shelly.addStatusHandler(function(e, ud){
  
  if(!e) return;
  if(e.component === 'number:200' || e.component === 'number:201'){
    havacLoop();      
  }
  
});

MQTT.subscribe('shellypro4pm-fbh/havacstatus0/setT', function(topic, message){
  //var data = JSON.parse(message);
  targetTempHandler.setValue(message);
});

havacLoop();
