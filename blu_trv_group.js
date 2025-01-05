/// <reference path="../../shelly-script.d.ts" />

/**
 * BLU TRV Group for Shelly
 *
 * Autor:   Marco Grießhammer (https://github.com/mgrie)
 * Date:    2025-01-05
 * Version: 0.4 alpha
 * Github:  https://github.com/mgrie/shelly-scripts/blob/main/smart-lightswitch.js
 *
 * 
 * WARNING: Not tested with more than 1 Slaves. The Trv.SetPosition calls could be to fast for the device.
 */

const CONFIG = {
  autoconfig: true,
  master: {
      trvId: 201,
      targetTempSensor: 'bthomesensor:225'
    },
  slaves: [
    {
      trvId: 202,
      targetTempSensor: 'bthomesensor:233',
      lastValvePosition: null
    }
  ]
}

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

// init script environment
function initEnv(callback){
  Shelly.call('MQTT.GetConfig', {}, function(result, error_code, error_message, userdata){
    if(error_code) log({error_code, error_message});
    
    if(error_code === 0 && result){
      ENV.mqttTopicPrefix = result.topic_prefix;
      ENV.mqttClientId = result.client_id;
    }

    callback();
  });
}

// init device if autoconfig flag is set
function initDevice(callback){
  if(CONFIG.autoconfig){
    log('initDevice');

    //ToDo: enable master, disable slaves
  
  }

  callback();
}

function setNewTargetTemparature(sourceId, targetMap, target_C){
  for (const key in targetMap) {
    if (targetMap.hasOwnProperty(key)) {
      if(key !== sourceId){
        log("Set new target temperature " + target_C + " for TRV: " + targetMap[key]); 

        Shelly.call("BluTrv.call", { id: targetMap[key], method: 'Trv.SetTarget', params: {id:0, target_C: target_C}}, function(result, error_code, error_message){
          if(error_code) log({error_code, error_message});
          if(result) log(result);
        });
      }
    }
  }
}

function syncSlaves(slaves, newValvePosition){
  for(slave in slaves){

    if(newValvePosition != slave.lastValvePosition){
      log('Set valve position of ' + slave.trvId + ' to: ' + newValvePosition);
      Shelly.call('BluTrv.Call', {id:slave.trvId, method: 'TRV.SetPosition', params:{id:0, pos: newpos}}, function(result, error_code, error_message, ud){
        if(error_code) {
          log({error_code, error_message});
        } 
        else {
          ud.slave.lastValvePosition = ud.newValvePosition;
        }
      }, {slave, newValvePosition});
    }
  }
}

function registerHandlers(){
  log('registerHandlers');

  // create map for target temperature triggers
  let targetMap = {};
  targetMap[CONFIG.master.targetTempSensor] = CONFIG.master.trvId;
  CONFIG.slaves.forEach(function(slave){
    targetMap[slave.targetTempSensor] = slave.trvId;
  });

  Shelly.addStatusHandler(function(event, targetMap){
    if(!event) return;
    
    let targetSrc = targetMap[event.component];
  
    // trigger: sync target temparature
    if(targetSrc){
      if(event.delta && event.delta.value) {
        log('Target temperature of ' + event.component + ' set to: ' + event.delta.value);
  
        setNewTargetTemparature(event.component, targetMap, event.delta.value);
      }
    }
  }, targetMap);

  Shelly.addEventHandler(function(event, config){
    if(!event) return;
    
    // trigger: sync valve position
    if(event.component === 'blutrv:' + config.master.trvId){
      Shelly.call('BluTrv.Call', {id:config.master.trvId, method: 'Shelly.GetStatus', params:{id:0}}, function(result, error_code, error_message, slaves){
        
        if(error_code) {
          log({error_code, error_message});
        } else {
          let newValvePosition = result['trv:0'].pos;
          syncSlaves(slaves, newValvePosition);
        }

      }, config.slaves);
      
    }
  }, CONFIG);
}

initEnv(function() {
  initDevice(registerHandlers);
})
