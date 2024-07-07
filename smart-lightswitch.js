/**
* Smart LightSwitch for Shelly
*
* Autor:   Marco Grießhammer (https://github.com/mgrie)
* Date:    2024-07-06
* Version: 0.7
* Github:  https://github.com/mgrie/shelly-scripts/blob/main/smart-lightswitch.js
*
* Key functions:
*  - 'Pump' (double Press, triple Press, longpress) for a longer auto off setup
*  - configurable actions ('on' for classic mode / large buildings, 'toogle' for small buildings or single rooms)
*  - configurable continious light
*  - auto off alert (flash indicator)
*  - External Triggers via MQTT
*  - AutoConfig
*  - Multiple entities
*
* MQTT Payload, equal to button config:
*  {
*    action: <string>,   // on || off || toogle
*    delay: <int>        // delay in seconds or null for continious light
*    autoOffAlert: <int> // flash alert before autoOff in seconds, set null to disable
*  }
*
**/

print("SmartLightSwitch Script: startup");

/********************* BEGIN CONFIGURATION *************************/

let CONFIG = {
  autoConfig: true,
	 
  entities: [
    {
      inputId: 0,
      inputType: "button",
      switchId: 0,
      switchType: "button",
      
      /**
      * Values:
      *  delay: auto off delay in seconds, null for continious light
      *  action: toogle, on, off
      *  autoOffAlert: flash alert before autoOff in seconds, set null to disable
      **/
      singlepush: {
        action: 'toogle', // values: toogle, on, off
        delay: 2*60,  // 2*60, // 2 minutes 
        autoOffAlert: 15 // 15 seconds
      },
      doublepush: {
        action: 'toogle', // values: toogle, on, off
        delay: 5*60, // 5 minutes
        autoOffAlert: 15 // 15 seconds
      },
      triplepush: {
        action: 'toogle', // values: toogle, on, off
        delay: 10*60, // 10 minutes
        autoOffAlert: 15 // 15 seconds
      },
      longpush: {
        action: 'toogle', // values: toogle, on, off
        delay: null, // continious light
        autoOffAlert: null, // disable
      },
      
      /**
      * Values:
      *  - MQTT Topic
      *  - null: disable external Trigger
      **/
      mqttTopic: "shelly/mydevice/light",
    }
  ]
};

/********************* END CONFIGURATION *************************/

let AUTO_OFF_ALERT_HANDLES = [];

////// CORE FUNCTIONS //////

/**
* Get the current switch state
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

function switchFlash(switchId, nextAutoOffDelay){  
  print("Execute switchFlash");    
  // Turn off switch 
  Shelly.call("Switch.set", {'id': switchId, 'on': false}, function(ud){
    // Performance Hack, immidiate call
    Shelly.call("Switch.set", {'id': switchId, 'on': true}, function(ud){    
      // set nextAutoOffDelay
      setAutoOffDelay(switchId, nextAutoOffDelay, function(ud){
        // switch on again!
        Shelly.call("Switch.set", {'id': switchId, 'on': true});
      });  
    });
  });
}

/**
* setSwitchOn with optional delay time
**/
function setSwitchOn(switchId, delay, autoOffAlert, callback){
  // Performance hack, immediatly set light on
  Shelly.call("Switch.set", {'id': switchId, 'on': true}, function(ud){
    // set autoOffAlert Timer
    if(delay > autoOffAlert){
      timeout = (delay - autoOffAlert) * 1000;
      AUTO_OFF_ALERT_HANDLES[switchId] = Timer.set(timeout, false, function(ud){
        switchFlash(switchId, autoOffAlert);
      });
    }      
      
    // call slow setAutoOffDelay
    setAutoOffDelay(switchId, delay, function(ud){
        // switch on again!
		Shelly.call("Switch.set", {'id': switchId, 'on': true}, callback);
	});
  });
}

/**
*' setSwitchOff
**/
function setSwitchOff(switchId, callback){
    if(AUTO_OFF_ALERT_HANDLES[switchId]) {
      Timer.clear(AUTO_OFF_ALERT_HANDLES[switchId]);
      AUTO_OFF_ALERT_HANDLES[switchId] = null;
    }
    
	Shelly.call("Switch.set", {'id': switchId, 'on': false}, callback);
}

////// ABSTRACT FUNCTIONS //////

/**
* switchAction
**/
function switchAction(switchId, data, callback){
  switch(data.action){
    case "on":
      setSwitchOn(switchId, data.delay, data.autoOffAlert, callback);
      break;
    case "off":
      setSwitchOff(switchId, callback);
      break;
    case "toogle":
      if(isSwitchOn(switchId)){
        setSwitchOff(switchId, callback);
      } else {
        setSwitchOn(switchId, data.delay, data.autoOffAlert, callback);
      } 
      break; 
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
          switchAction(config.switchId, config.singlepush);
          break;
        case "double_push":
          switchAction(config.switchId, config.doublepush);
          break;
        case "triple_push":
          switchAction(config.switchId, config.triplepush);
          break;
        case "long_push":
          switchAction(config.switchId, config.longpush);
          break;
      }
    }
  
    // External switch off dedection: reset auto off value
    if (e.component === "switch:" + config.switchId) {
      // Explicit, could be undefined!
      if(e.info.state === false){
        if(AUTO_OFF_ALERT_HANDLES[config.switchId]) {
          Timer.clear(AUTO_OFF_ALERT_HANDLES[config.switchId]);
          AUTO_OFF_ALERT_HANDLES[config.switchId] = null;
        }
        setAutoOffFalse(config.switchId);
      }  
    }
  }, config);  
}

/**
* Optional: External MQTT trigger
**/
function startMqttTrigger(config){
 
  if(!MQTT.isConnected()){
    print('MQTT not connected');
    return;
  }
  
  MQTT.subscribe(config.mqttTopic, function(topic, message, switchId) {
    var data = JSON.parse(message);
    switchAction(switchId, data);
  }, config.switchId);   
}

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
* 
*/
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
    // Pessimistic init
    setSwitchOff(entityConfig.switchId)
    
    registerHandlers(entityConfig);
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
