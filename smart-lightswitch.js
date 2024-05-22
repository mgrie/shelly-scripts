/**
* Smart LightSwitch for Shelly
*
* Autor: Marco Grießhammer (https://github.com/mgrie)
* Date: 22.05.2024
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
  /**
  * Values:
  *  - auto off delay in seconds
  *  - 'null' for continious light
  **/
  time1: 2*60, // 2 minutes
  time2: 5*60, // 5 minutes
  time3: 10*60, // 10 minutes
  timelong: null, // continious light
  
  autoInit: true,
	
  /**
  * Values:
  *  - MQTT Topic
  *  - null: disable external Trigger
  **/
  mqttTopic: "shelly/garage/light"
};

////// CORE FUNCTIONS //////

/**
* Check currentr switch status
**/
function isSwitchOn(){
	return Shelly.getComponentStatus("switch:0").output;
}

/**
* setAutoOffFalse
**/
function setAutoOffFalse(callback){
  Shelly.call("Switch.SetConfig", {'id': 0, 'config': {'auto_off': false}}, callback);
}

/**
*' setAutoOffDelay with optional delay time
**/
function setAutoOffDelay(delay, callback){
	if(delay > 0){
		Shelly.call("Switch.SetConfig", {'id': 0, 'config': {'auto_off': true, 'auto_off_delay': delay}}, callback);
	} else {
		setAutoOffFalse(callback);
	}
}

/**
* setSwitchOn with optional delay time
**/
function setSwitchOn(delay, callback){
	setAutoOffDelay(delay, function(ud){
		Shelly.call("Switch.set", {'id': 0, 'on': true}, callback);
	});
}

/**
*' setSwitchOff
**/
function setSwitchOff(callback){
	Shelly.call("Switch.set", {'id': 0, 'on': false}, callback);
}

////// ABSTRACT FUNCTIONS //////

/**
* toogleSwitch
*
* Toogle Switch to on or off with optional auto off delay
**/
function toogleSwitch(delay, callback){
  if(isSwitchOn()){
    setSwitchOff(callback);
  } else {
	setSwitchOn(delay, callback);
  }  
}

////// HANDLERS //////

/**
* register Event Handler
**/
function registerHandlers(){
  Shelly.addEventHandler(function(e) {
  
    // Handle Input Button
    if (e.component === "input:0") {
      switch (e.info.event) {
        case "single_push":
          toogleSwitch(CONFIG.time1);
          break;
        case "double_push":
          toogleSwitch(CONFIG.time2);
          break;
        case "triple_push":
          toogleSwitch(CONFIG.time3);
          break;
        case "long_push":
          toogleSwitch(CONFIG.timelong);
          break;
      }
    }
  
    // External switch off dedection: reset auto off value
    if (e.component === "switch:0") {
      // Explicit, could be undefined!
      if(e.info.state === false){
        setAutoOffFalse();
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
        setSwitchOn(data.delay);
        break;
      case "off":
        setSwitchOff();
        break;
      case "toogle":
        toogleSwitch(data.delay);
        break; 
      }
  });   
}

function autoInit(){
  if(!CONFIG.autoInit){
    print('autoInit disabled');
    return;
  }

  Shelly.call("Switch.SetConfig", {"id": 0, "config": {"in_mode": "detached", "initial_state": "off"}}, 
    function (result, error_code, error_message) {
      if (error_code !== 0) {
        print("Error setting input mode: " + error_message);
      }
      else {
        Shelly.call("Switch.SetConfig", {"id": 0, "config": {"input_mode": "button"}}, 
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
  autoInit();  
  registerHandlers();
  startMqttTrigger();
  print("SmartLightSwitch Script: running");  
}

main();
