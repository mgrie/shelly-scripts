print("Start SmartLightSwitch Script");

let CONFIG = {
  time1: 2*60, // 2 Minuten
  time2: 5*60, // 5 Minuten
  time3: 10*60, // 10 Minuten
  timelong: null // Dauerlicht
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
  // print('Set AutoOff false');
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
    // print("Set Switch Off");
	Shelly.call("Switch.set", {'id': 0, 'on': false}, callback);
}

Shelly.addEventHandler(function(e) {
  
  // Input Button
  if (e.component === "input:0") {
    switch (e.info.event) {
      case "single_push":
        // print("Button was pushed");
        toogleSwitch(CONFIG.time1);
        break;
      case "double_push":
        //print("Button was double pushed");
        toogleSwitch(CONFIG.time2);
        break;
      case "triple_push":
        //print("Button was triple pushed");
        toogleSwitch(CONFIG.time3);
        break;
      case "long_push":
        //print("Button was long pushed");
        toogleSwitch(CONFIG.timelong);
        break;
    }
  }
  
  // Output Light Switch
  if (e.component === "switch:0") {
    // could be undefined!
    if(e.info.state === false){
      // print('Switch Off Dedection');
      setAutoOffFalse();
    }  
  }
});

print("Script is running");
