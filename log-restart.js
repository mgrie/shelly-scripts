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

function main(){
  Shelly.call('Sys.GetStatus', {}, function(result, error_code, error_message){
    if(error_code === 0 && result){
      if(result.uptime < 300){
        result.message = 'Device restart detected';
      } else {
        result.message = 'Script restarted';
      }
      log(result);
    } else {
      log({error: error_code, message: error_message});
    }
  })
}

init(main);
