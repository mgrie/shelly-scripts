/// <reference path="../../shelly-script.d.ts" />

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

function waitForMqtt(callback){
  if(MQTT.isConnected){
    callback();
  } else {
    let timerHandle = Timer.set(2000, true, function(){
      if(MQTT.isConnected){
        Timer.clear(timerHandle);
        callback();
      }
    });
  }
}

function init(callback){
  Shelly.call('MQTT.GetConfig', {}, function(result, error_code, error_message, userdata){
    if(error_code === 0 && result){
      ENV.mqttTopicPrefix = result.topic_prefix;
      ENV.mqttClientId = result.client_id;
    }
    waitForMqtt(function(){
      // wait another second
      Timer.set(1000, false, function(){
        callback();
      });
    });
  });
}

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

function setNewTargetTemparature(masterId, target_C){
  for (const key in entities) {
    if (entities.hasOwnProperty(key)) {
      if(key !== masterId){
        log("Zieltemperatur " + target_C +  " setzen für: " + entities[key].name); 
        log("TRV Id: " + entities[key].trvId)


        Shelly.call("BluTrv.call", { id: entities[key].trvId, method: 'Trv.SetTarget', params: {id:0, target_C: target_C}}, function(result, error_code, error_message){
          if(error_code) log(error_code);
          if(error_message) log(JSON.stringify(error_message));
          if(result) log(JSON.stringify(result));
        });

      }
    }
  }
}

function main(){
  Shelly.addEventHandler(function(event, ud){
    if(!event) return;
    
    let entity = entities[event.component];
  
    if(entity){
      log('Event ' + entity.name + ': ' + JSON.stringify(event));
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


init(main);
