/// <reference path="../../shelly-script.d.ts" />

/**
 * Smart HAVAC for Shelly
 *
 * Autor:      Marco Grießhammer (https://github.com/mgrie)
 * Date:       2025-01-06
 * Version:    0.5
 * Github:     https://github.com/mgrie/shelly-scripts/blob/main/smart-havac.js
 * Disclaimer: Use by your own risk!
 * 
 * Short Description:
 * -------------------------
 * Use a Shelly Pro Gen2 or Shelly Gen3 device with a 'Switch' component to control floor heating valves (on/off).
 * The current temperature must be pushed from external triggers, eg. Shelly H&T Gen3 action.
 * Set target temperature via virtual component slider by using Shelly Cloud, Shelly App or Webinterface.
 * Use Home Assistant via MQTT as UI and controller.
 * Additional logging via MQTT.
 *
 * ToDo: Make MQTT optional
 * ToDo: Shelly Blu H&T and MQTT Support for current temperature
 * ToDo: Better on/off handling and ECO Mode
 * Idea: use KVS to prevent virtual component limits
 * Idea: Use KVS for configuration
 *
 * Installation:
 * ----------------------
 *  - Create virtual components for target temperature (number slider) and current temperature (number label)
 *  - Configure the entities array as you need it
 *  - Push current temperature updates via RPC call. Example for Shelly H&T Gen 3 Action, push to 'number:200':
 *    http://192.168.xxx.xxx/rpc/Number.Set?id=200&value=$temperature
 */

/*******************************************************************************************************

Home Assistant example configuration for valveId 0:
(Replace values and MQTT prefix with your own)
===================================================

mqtt:      
  - climate:
      name: "FBH MQTT Höhle"
      unique_id: "mqt_8d6d36b1"
      action_topic: "shellypro4pm-fbh/havac/status/0"
      action_template: "{{ value_json.action }}"
      current_temperature_topic: "shellypro4pm-fbh/havac/status/0"
      current_temperature_template: "{{ value_json.current_T }}"
      max_temp: 30
      min_temp: 4
      precision: 0.5
      temp_step: 0.1
      temperature_state_topic: "shellypro4pm-fbh/havac/status/0"
      temperature_state_template: "{{ value_json.target_T }}"
      modes: ["heat", "off"]
      mode_state_topic: "shellypro4pm-fbh/havac/status/0"
      mode_state_template: "{{ 'off' if value_json.target_T == 4 else 'heat' }}"
      temperature_command_template: "{{ {'targetTemp': value } | to_json }}"
      temperature_command_topic: "shellypro4pm-fbh/havac/set/0"
      mode_command_topic: "shellypro4pm-fbh/havac/set/0"
      mode_command_template: "{% set target = 4 if value == 'off' else 21 %}{{ {'id': 0, 'src': 'homeassistant', 'method': 'BluTRV.Call', 'params': {'id': 200, 'method': 'TRV.SetTarget', 'params': {'id': 0, 'target_C': target}}} | to_json }}"

*******************************************************************************************************/

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
const ENV = {
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

// Init script environment
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

// HAVAC Loop per entity
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

// Send current status to external applications, e.g. Home Assistant
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

  // create a lookup map
  const componentMap = {};
  for (const entity of entites) {
    componentMap[entity.currentTempId] = entity;
    componentMap[entity.targetTempId] = entity;
  }

  Shelly.addStatusHandler(function(e, map){
    if(!e) return;

    // Detect virtual component changes (current temp, target temp) 
    let entity = map[e.component];
    if(entity){  
      // If something happens, trigger havacLoop :)
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

    // ToDo: use a map instead of iteration to find the entity?
    let entity = null;
    for (let i = 0; i < entities.length; i++) {
      log(JSON.stringify(entities[i]));
      if (entities[i].valveId === valveId) {
        entity = entities[i];
        break;
      }
    }
    
    log(JSON.stringify(entity));

    if(!entity) return;

    // Handle command set target temperature
    if(data.targetTemp){
      log('set target temp to ' + data.targetTemp);
      // set value only, loop is triggered by status event
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
