/**
* Smart LightSwitch for Shelly
*
* Autor: Marco Grießhammer (https://github.com/mgrie)
* Date: 23.05.2024
*
* Key functions:
*  - 'Pump' (double Press, triple Press, longpress) for a longer auto off delay
*  - configurable continious light
*  - External Triggers via MQTT
*
* MQTT Payload:
*  {
*    action: <string>, // on || off || toogle
*    delay: <int>      // delay in seconds or null for continious light
*  }
*
**/

print("SmartLightSwitch Script: startup");

let CONFIG = {
  autoConfig: true,
	
  /**
  * Values:
  *  - MQTT Topic
  *  - null: disable external Trigger
  **/
  mqttTopic: "shelly/mydevice/light",
  
  inputId: 0,
  switchId: 0,
      /**
      * Values:
      *  - auto off delay in seconds
      *  - 'null' for continious light
      **/
  time1: 2*60, // 2 minutes
  time2: 5*60, // 5 minutes
  time3: 10*60, // 10 minutes
  timelong: null, // continious light
};

////// CORE FUNCTIONS //////

/**
* Check currentr switch status
**/
function isSwitchOn(switchId){
	return Shelly.getComponentStatus("switch:" + switchId).output;
}

/**
* setAutoOffFalse
**/
function setAutoOffFalse(switchId, callback){
  Shelly.call("Switch.SetConfig", {'id': switchId, 'config': {'auto_off': false}}, callback);
}

/**
*' setAutoOffDelay with optional delay time
**/
function setAutoOffDelay(switchId, delay, callback){
	if(delay > 0){
		Shelly.call("Switch.SetConfig", {'id': switchId, 'config': {'auto_off': true, 'auto_off_delay': delay}}, callback);
	} else {
		setAutoOffFalse(switchId, callback);
	}
}

/**
* setSwitchOn with optional delay time
**/
function setSwitchOn(switchId, delay, callback){
	setAutoOffDelay(switchId, delay, function(ud){
		Shelly.call("Switch.set", {'id': switchId, 'on': true}, callback);
	});
}

/**
*' setSwitchOff
**/
function setSwitchOff(switchId, callback){
	Shelly.call("Switch.set", {'id': switchId, 'on': false}, callback);
}

////// ABSTRACT FUNCTIONS //////

/**
* toogleSwitch
*
* Toogle Switch to on or off with optional auto off delay
**/
function toogleSwitch(switchId, delay, callback){
  if(isSwitchOn(switchId)){
    setSwitchOff(switchId, callback);
  } else {
	setSwitchOn(switchId, delay, callback);
  }  
}

////// HANDLERS //////

/**
* register Event Handler
**/
function registerHandlers(){
  Shelly.addEventHandler(function(e) {
    
    // Handle Input Button
    if (e.component === "input:" + CONFIG.inputId) {
      switch (e.info.event) {
        case "single_push":
          toogleSwitch(CONFIG.switchId, CONFIG.time1);
          break;
        case "double_push":
          toogleSwitch(CONFIG.switchId, CONFIG.time2);
          break;
        case "triple_push":
          toogleSwitch(CONFIG.switchId, CONFIG.time3);
          break;
        case "long_push":
          toogleSwitch(CONFIG.switchId, CONFIG.timelong);
          break;
      }
    }
  
    // External switch off dedection: reset auto off value
    if (e.component === "switch:" + CONFIG.switchId) {
      // Explicit, could be undefined!
      if(e.info.state === false){
        setAutoOffFalse(CONFIG.switchId);
      }  
    }
  });  
}

/**
* Optional: External MQTT trigger
**/
function startMqttTrigger(){
  
  if(CONFIG.mqttTopic == null){
    print('MQTT Trigger not enabled');
    return;
  }
  
  if(!MQTT.isConnected()){
    print('MQTT not connected');
    return;
  }
  
  MQTT.subscribe(CONFIG.mqttTopic, function(topic, message, userdata) {
    var data = JSON.parse(message);
    switch(data.action){
      case "on":
        setSwitchOn(CONFIG.switchId, data.delay);
        break;
      case "off":
        setSwitchOff(CONFIG.switchId);
        break;
      case "toogle":
        toogleSwitch(CONFIG.switchId, data.delay);
        break; 
      }
  });   
}

function autoConfig(){
  if(!CONFIG.autoConfig){
    print('autoConfig disabled');
    return;
  }

  let switchId = CONFIG.switchId;
  let inputId = CONFIG.inputId; 

  Shelly.call("Switch.SetConfig", {"id": switchId, "config": {"in_mode": "detached", "initial_state": "off"}}, 
    function (result, error_code, error_message) {
      if (error_code !== 0) {
        print("Error setting input mode: " + error_message);
      }
      else {
        Shelly.call("Switch.SetConfig", {"id": switchId, "config": {"input_mode": "button"}}, 
          function (result, error_code, error_message) {
                  if (error_code !== 0) {
                    print("Error setting input mode: " + error_message);
                  }
          }
        );
      }
    } 
  );  
}

function main(){
  autoConfig();  
  registerHandlers();
  startMqttTrigger();
  print("SmartLightSwitch Script: running");  
}

main();
