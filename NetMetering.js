const totalActEnergyHandle = Virtual.getHandle("number:200");
const totalActRetEnergyHandly = Virtual.getHandle("number:201");
let lastDay = new Date().getDate();

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

function checkDayChange() {
  let isDayChange = false;
  let now = new Date();
  let currentDay = now.getDate();

  if (currentDay !== lastDay) {
    log("Tageswechsel erkannt!");
    isDayChange = true;
    lastDay = currentDay;
  }
  return isDayChange;
}

function main() {
  log("starting net metering");

  totalActEnergyHandle.setValue(0);
  totalActRetEnergyHandly.setValue(0);  

  Shelly.addEventHandler(function(event_data){    
    if(event_data.component === "emdata:0" && event_data.name === "emdata"){
      if(checkDayChange()){
        totalActEnergyHandle.setValue(0);
        totalActRetEnergyHandly.setValue(0);        
      }
      
      if(event_data.info && event_data.info.data && event_data.info.data.values) {
        let values = event_data.info.data.values[0];
        let deltaActEnergy = values[0] + values[16] + values[32] - values[2] - values[18] - values[34];
       
        totalActEnergyHandle.setValue(totalActEnergyHandle.getValue() + (deltaActEnergy > 0 ? deltaActEnergy : 0));
        totalActRetEnergyHandly.setValue(totalActRetEnergyHandly.getValue() + (deltaActEnergy < 0 ? -deltaActEnergy : 0));  
      }
    }  
  });

  log('net metering startet');
}

initEnv(main);
