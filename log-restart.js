/// <reference path="../../shelly-script.d.ts" />

let DYNCONFIG = {
  mqttTopicPrefix: undefined,
  mqttClientId: undefined
};
let TIMER_HANDLE_INIT = undefined;
let TESTCOUNT = 0;

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
    TIMER_HANDLE_INIT = Timer.set(2000, true, function(){    
      if(MQTT.isConnected){
        if(TIMER_HANDLE_INIT) Timer.clear(TIMER_HANDLE_INIT);
        log('MQTT Ready');
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
    waitForMqtt(function(){
      // wait another second
      Timer.set(1000, false, callback);
    });
  });
}

function main(){
    // ToDo: Get restart Timestamp etc.
    log('Restart detected!');  
}

init(main);
