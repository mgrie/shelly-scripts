/**
* Smart LightSwitch for Shelly
*
* Autor: Marco Grießhammer (https://github.com/mgrie)
* Date: 21.05.2024
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
	
  /**
  * Values:
  *  - MQTT Topic
  *  - null: disable external Trigger
  **/
  mqttTopic: "shelly/garage/light"
};

function toogleSwitch(delay, callback){
  if(isSwitchOn()){
    setSwitchOff(callback);
  } else {
	setSwitchOn(delay, callback);
  }  
}

function isSwitchOn(){
	return Shelly.getComponentStatus("switch:0").output;
}

function setAutoOffFalse(callback){
  Shelly.call("Switch.SetConfig", {'id': 0, 'config': {'auto_off': false}}, callback);
}

function setAutoOffDelay(delay, callback){
	if(delay > 0){
	    // print('Set AutoOff Delay: ' + delay);
		Shelly.call("Switch.SetConfig", {'id': 0, 'config': {'auto_off': true, 'auto_off_delay': delay}}, callback);
	} else {
		setAutoOffFalse(callback);
	}
}

function setSwitchOn(delay, callback){
    // print("Set Switch On, Delay: " + delay);
	setAutoOffDelay(delay, function(ud){
		Shelly.call("Switch.set", {'id': 0, 'on': true}, callback);
	});
}

function setSwitchOff(callback){
	Shelly.call("Switch.set", {'id': 0, 'on': false}, callback);
}

Shelly.addEventHandler(function(e) {
  
  // Input Button
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
  
  // Dedect physical switch off and reset auto off value
  if (e.component === "switch:0") {
    // Explicit, could be undefined!
    if(e.info.state === false){
      setAutoOffFalse();
    }  
  }
});

// Optional MQTT Trigger
if(MQTT.isConnected() && CONFIG.mqttTopic){
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

/*
function testMqtt(){
  var message = {
    action: "on", // on || off || toogle
    delay: 120
  }
  MQTT.publish(CONFIG.mqttTopic, JSON.stringify(message), 0, false);
}
*/

print("SmartLightSwitch Script: running");
