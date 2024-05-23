/**
* Smart LightSwitch for Shelly
*
* a Shelly-Script for a smart time switch or stairwell timer  
*
* Autor:   Marco Grießhammer (https://github.com/mgrie)
* Date:    23.05.2024
* Version: 0.5
* Github:  https://github.com/mgrie/shelly-scripts/blob/main/smart-lightswitch.js
*
* Key functions:
*  - time switch
*  - toogle off / cancel timer
*  - 'Pump' (double Press, triple Press, longpress) for a longer auto off delay
*  - configurable continious light
*  - Timer animation and countdown in Shelly App
*  - External triggers via MQTT
*  - AutoConfig
*  - Multiple entities
*
* Installation and first start:
*  - Try default values, if youre not sure
*  - Known gotchas: 
*	* wrong cabling - use 'invert input' if your shelly detects 'longpress' on 'singlepress'
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
	 
  entities: [
    {
      inputId: 0,
      inputType: "button",
      switchId: 0,
      switchType: "button",
      
      // Values: auto off delay in seconds || 'null' for continious light
      time1: 2*60, // 2 minutes
      time2: 5*60, // 5 minutes
      time3: 10*60, // 10 minutes
      timelong: null, // continious light
      
      // Values: topic as string || 'null' for disable MQTT	    
      mqttTopic: "shelly/mydevice/light",
    }
  ]
};

////// CORE FUNCTIONS //////

/**
* AutoConfig: Detatch Input and Output
*/
function autoConfig(entityConfig){
  Shelly.call("Switch.SetConfig", {"id": entityConfig.switchId, "config": {"in_mode": "detached", "initial_state": "off", "input_mode": entityConfig.switchType, "auto_on": false, "auto_off": false}}, 
    function (result, error_code, error_message) {
      if (error_code !== 0) {
        print("Error setting input mode: " + error_message);
      }
      else {
        Shelly.call("Input.SetConfig", {"id": entityConfig.inputId, "config": {"type": entityConfig.inputType, "enable": true}}, 
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

/**
* Check current switch status
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
function registerHandlers(config){
  Shelly.addEventHandler(function(e, config) {
    
    // Handle Input Button
    if (e.component === "input:" + config.inputId) {
      switch (e.info.event) {
        case "single_push":
          toogleSwitch(config.switchId, config.time1);
          break;
        case "double_push":
          toogleSwitch(config.switchId, config.time2);
          break;
        case "triple_push":
          toogleSwitch(config.switchId, config.time3);
          break;
        case "long_push":
          toogleSwitch(config.switchId, config.timelong);
          break;
      }
    }
  
    // External switch off dedection: reset auto off value
    if (e.component === "switch:" + config.switchId) {
      // Explicit, could be undefined!
      if(e.info.state === false){
        setAutoOffFalse(config.switchId);
      }  
    }
  }, config);  
}

/**
* start optional MQTT Trigger
**/
function startMqttTrigger(config){
 
  if(!MQTT.isConnected()){
    print('MQTT not connected');
    return;
  }
  
  MQTT.subscribe(config.mqttTopic, function(topic, message, switchId) {
    var data = JSON.parse(message);
    switch(data.action){
      case "on":
        setSwitchOn(switchId, data.delay);
        break;
      case "off":
        setSwitchOff(switchId);
        break;
      case "toogle":
        toogleSwitch(switchId, data.delay);
        break; 
      }
  }, config.switchId);   
}

////// Main Program //////

function main(){

  // AutoConfig
  if(CONFIG.autoConfig){
      CONFIG.entities.forEach(function(entityConfig) {
        autoConfig(entityConfig);
      });
  } else {
    print('autoConfig disabled');
  }
  
  // Start main handlers  
  CONFIG.entities.forEach(function(entityConfig) {
    registerHandlers(entityConfig );
  });
    
  // Start MQTT Triggers
  CONFIG.entities.forEach(function(entityConfig) {
      if(entityConfig.mqttTopic){
        startMqttTrigger(entityConfig);
      } else {
        print('MQTT Trigger not enabled');
      }
  });
    
  print("SmartLightSwitch Script: running");  
}

main();
