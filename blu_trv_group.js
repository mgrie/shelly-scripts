/// <reference path="../../shelly-script.d.ts" />

let entities = {
  'bthomesensor:225' : {
    name: 'Target Temp Lehrerzimmer west',
    trvId: 201
  },
  'bthomesensor:233' : {
    name: 'Target Temp Lehrerzimmer nord',
    trvId: 202
  },
}

let SYNCTRV = {
  masterId: 201,
  slaveId: 202,
  lastValvePosition: null
}

let ENV = {
  mqttTopicPrefix: undefined,
  mqttClientId: undefined
};

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
    callback();
  });
}

function setNewTargetTemparature(masterId, target_C){
  for (const key in entities) {
    if (entities.hasOwnProperty(key)) {
      if(key !== masterId){
        log("Zieltemperatur " + target_C +  " setzen für: " + entities[key].name); 
        log("TRV Id: " + entities[key].trvId)


        Shelly.call("BluTrv.call", { id: entities[key].trvId, method: 'Trv.SetTarget', params: {id:0, target_C: target_C}}, function(result, error_code, error_message){
          if(error_code) 
            log({error_code: error_code, error_message: error_message});
          if(result) log(result);
        });
      }
    }
  }
}

function initDevice(callback){
  log('initDevice');
  callback();
}

function registerHandlers(){
  log('registerHandlers');
  
  Shelly.addEventHandler(function(event, ud){
    if(!event) return;
    
    let entity = entities[event.component];
  
    if(entity){
      log('Event ' + entity.name + ': ' + JSON.stringify(event));
    }

    if(event.component === 'blutrv:' + SYNCTRV.masterId){
      Shelly.call('BluTrv.Call', {id:SYNCTRV.masterId, method: 'Shelly.GetStatus', params:{id:0}}, function(result, error_code, error_message, synctrv){
        
        if(error_code > 0) {
          print('ErrorCode: ' + error_code + '; Message: ' + error_message);
        }
        
        let newpos = result['trv:0'].pos;
        if(newpos != synctrv.lastValvePosition){
          print('sync to slave: ' + newpos);
          Shelly.call('BluTrv.Call', {id:synctrv.slaveId, method: 'TRV.SetPosition', params:{id:0, pos: newpos}}, function(result, error_code, error_message, newpos){
            if(error_code > 0) {
              print('ErrorCode: ' + error_code + '; Message: ' + error_message);
            }
            SYNCTRV.lastValvePosition = newpos;
          }, newpos);
        }
      }, SYNCTRV);
      
    }
  });

  Shelly.addStatusHandler(function(event, ud){
    if(!event) return;
    
    let entity = entities[event.component];
  
    if(entity){
      if(event.delta && event.delta.value) {
        log('Status ' + entity.name + ' target temp: ' + event.delta.value);
  
        setNewTargetTemparature(event.component, event.delta.value);
      }
    }
  });  
}


initEnv(initDevice(registerHandlers));
