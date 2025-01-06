/// <reference path="../../shelly-script.d.ts" />

/**
 * Smart HAVAC for Shelly Pro Gen2 and Shelly Gen3
 *
 * Autor:   Marco Grießhammer (https://github.com/mgrie)
 * Date:    2025-01-06
 * Version: 0.5
 * Github:  https://github.com/mgrie/shelly-scripts/blob/main/smart-havac.js
 *
 * ToDo: Make MQTT optional

Example Home Assistant Config

virtual component docu

push current temp example
 
 */

// Configuration
// ToDo: Rename entities?
const ENTITIES = [
  {
    valveId: 0,
    hysteresis: 0.2,
    currentTempId: 'number:200',
    targetTempId: 'number:201'
  },
  {
    valveId: 1,
    hysteresis: 0.2,
    currentTempId: 'number:202',
    targetTempId: 'number:203'
  },
  {
    valveId: 2,
    hysteresis: 0.2,
    currentTempId: 'number:204',
    targetTempId: 'number:205'
  },
  {
    valveId: 3,
    hysteresis: 0.2,
    currentTempId: 'number:206',
    targetTempId: 'number:207'
  }  
];

// set dynamic at initEnv()
let ENV = {
  mqttTopicPrefix: undefined,
  mqttClientId: undefined
};

// logger
function log(message){
  try {
      if(typeof message === 'object' ){
          message = JSON.stringify(message);
      } else if (typeof message !== 'string'){
          message = message.toString();
      }
   
      print(message);

      // Shelly.emitEvent("log", message);
      
      if(MQTT.isConnected()) {
          MQTT.publish(ENV.mqttTopicPrefix + "/log", message);
      }
  } catch (error) {
      print("Error: " + JSON.stringify(error));
  }
}

function initEnv(callback){
  Shelly.call('MQTT.GetConfig', {}, function(result, error_code, error_message, userdata){
    if(error_code === 0 && result){
      ENV.mqttTopicPrefix = result.topic_prefix;
      ENV.mqttClientId = result.client_id;
    }
    // ToDo: wait 20 seconds for MQTT Connection after device reboot?
    callback();
  });
}

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
     log('New valve state: ' + nextValveState);
     // switch valve state on/off
     Shelly.call("Switch.set", {'id': entity.valveId, 'on': nextValveState});
  }   
  
  sendMqttStatusMessage(entity.valveId, targetTemp, currentTemp, nextValveState);
}

function sendMqttStatusMessage(valveId, targetTemp, currentTemp, valveState) {
  var message = {
    target_T: targetTemp,
    current_T: currentTemp,
    action: valveState ? 'heating' : 'off',
    clientId: DYNCONFIG.mqttClientId,
    valveId: valveId
  };
  // ToDo: Check if MQTT is enabled?
  MQTT.publish(DYNCONFIG.mqttTopicPrefix +  '/havac/status/'  + valveId, JSON.stringify(message) );
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

// subscribeMqtt for incomming havac commands
function subscribeMqtt(entities){
  MQTT.subscribe(DYNCONFIG.mqttTopicPrefix + '/havac/set/#', function(topic, message, entities){
    log(message);

    const valveId =  parseInt(topic.charAt(topic.length - 1));
    const data = JSON.parse(message);

    /*

    ToDo: Error handling, check parameters

    not like this :)
    if(!valveId) return;
    if(!data) return;
    
    */

    let entity = null;

    // ToDo: use a map instead of iterate?
    for (let i = 0; i < entities.length; i++) {
      log(JSON.stringify(entities[i]));
      if (entities[i].valveId === valveId) {
        entity = entities[i];
        break;
      }
    }
    
    log(JSON.stringify(entity));

    if(!entity) return;
    if(data.targetTemp){
      log('set target temp to ' + data.targetTemp);
      entity.targetTempHandler.setValue(data.targetTemp);
    }
  }, entities);
};

function main() {
  log("starting smart HAVAC");

  // load Entities
  let entities = initEntities(ENTITIES);
  
  registerStatusHandler(entities);
  subscribeMqtt(entities);

  log('smart havac startet');

}

initEnv(main);
