/// <reference path="../../shelly-script.d.ts" />

let DYNCONFIG = {
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
          MQTT.publish(DYNCONFIG.mqttTopicPrefix + "/log", message);
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
      DYNCONFIG.mqttTopicPrefix = result.topic_prefix;
      DYNCONFIG.mqttClientId = result.client_id;
    }
    waitForMqtt(callback);
  });
}

function main(){
  Shelly.call('Sys.GetStatus', {}, function(result, error_code, error_message){
    if(error_code === 0 && result){
      if(result.uptime < 300){
        log({message: 'Device restart detected', uptime: result.uptime});
      } else {
        log({message: 'Script restarted', uptime: result.uptime});
      }
    } else {
      log({error: error_code, message: error_message});
    }
  })
}

init(main);
