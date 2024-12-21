/// <reference path="../../shelly-script.d.ts" />

print("Bootstrap");

let CONFIG = {
  mqttTopicPrefix: 'shellypro4pm-fbh',
  mqttClientId: 'shellypro4pm-fbh'
};

let ENTITIES = [
  {
    valveId: 0,
    hysteresis: 0.2,
    currentTempId: 'number:200',
    targetTempId: 'number:201'
  }
]


function isHeatingRequired(targetTemp, currentTemp, hysteresis, isHeating) {
  // If we're currently heating, continue heating until we reach the target temperature
  if (isHeating) {
    return currentTemp < targetTemp;
  }

  // If we're not heating, start heating if the current temperature is below the lower threshold
  return currentTemp <= targetTemp - hysteresis;
}

function havacLoop(entity){

  let targetTemp = entity.targetTempHandler.getValue();
  let currentTemp = entity.currentTempHandler.getValue();
  let currentValveState = Shelly.getComponentStatus('switch:' + entity.valveId).output;
  
  let nextValveState = isHeatingRequired(targetTemp, currentTemp, entity.hysteresis, currentValveState );
  if(currentValveState !== nextValveState ) {
     print('Neuer Ventilstatus: ' + nextValveState);
     Shelly.call("Switch.set", {'id': entity.valveId, 'on': nextValveState});
  }   
  
  sendStatusMessage(entity.valveId, targetTemp, currentTemp, nextValveState);
}



function sendStatusMessage(valveId, targetTemp, currentTemp, valveState) {
  var message = {
    target_T: targetTemp,
    current_T: currentTemp,
    action: valveState ? 'heating' : 'off',
    clientId: CONFIG.mqttClientId,
    valveId: valveId
  };
  
  MQTT.publish(CONFIG.mqttTopicPrefix +  '/havac/status/'  + valveId, JSON.stringify(message) );
}


function initEntities(entities) {
  for (const entity of entities) {
    entity.currentTempHandler = Virtual.getHandle(entity.currentTempId);
    entity.targetTempHandler = Virtual.getHandle(entity.targetTempId);
  }

  return entities;
}


function registerStatusHandler(entites){
  const componentMap = {};

  for (const entity of entites) {
    componentMap[entity.currentTempId] = entity;
    componentMap[entity.targetTempId] = entity;
  }

  Shelly.addStatusHandler(function(e, map){
    if(!e) return;

    let entity = map[e.component];
    if(entity){
      havacLoop(entity);
    }
  }, componentMap);
};


/*
function subscribeMqtt(entites){
  MQTT.subscribe(CONFIG.mqttTopicPrefix + 'havac/set/#', function(topic, message){
    //var data = JSON.parse(message);
    targetTempHandler.setValue(message);
  });
};
*/

function main() {
  // load Entities
  let entities = initEntities(ENTITIES);
  registerStatusHandler(entities);
  // subscribeMqtt(entities);

  print('Anwendung gestartet');

}

main();
