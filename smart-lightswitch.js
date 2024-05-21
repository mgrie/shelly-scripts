print("Start SmartLightSwitch Script");

let CONFIG = {
  time1: 5, // 2 Minuten
  time2: 5*60, // 5 Minuten
  time3: 10*60, // 10 Minuten
  timelong: null // Dauerlicht
};

let timerHandle = null;

function buttonEvent(time){
  print("Start Timer: " + time);
    
  if(!Shelly.getComponentStatus("switch:0").output){
    switchLightOn(time);
  } else {
    switchLightOff();
  }  
}

function stopTimer(){
  if(timerHandle !== null){
    print("Stop Timer");
    Timer.clear(timerHandle);
    timerHandle = null;
  }
}

function switchLightOn(time){
  print("switchLight On");
  
  Shelly.call("Switch.set", {'id': 0, 'on': true});
 
  if(time !== null){
    timerHandle = Timer.set(
      time*1000, 
      false, 
      function(ud){
        print("End Timer");
        switchLightOff();
      },
      null
    );  
  } else {
    print("Dauerlicht!");
  }

}

function switchLightOff(){
    print("switchLight Off");
    // stopTimer();
    Shelly.call("Switch.set", {'id': 0, 'on': false});  
}

Shelly.addEventHandler(function(e) {
  
  // Input Button
  if (e.component === "input:0") {
    if (e.info.event === "single_push") {
      print("Button was pushed");
      buttonEvent(CONFIG.time1);
    }
    
    if (e.info.event === "double_push") {
      print("Button was double pushed");
      buttonEvent(CONFIG.time2);
    }
    
    if (e.info.event === "triple_push") {
      print("Button was triple pushed");
      buttonEvent(CONFIG.time3);
    }
    
    if (e.info.event === "long_push") {
      print("Button was long pushed");
      buttonEvent(CONFIG.timelong)
    }
  }
  
  // Output Light Switch
  if (e.component === "switch:0") {
    if(!e.info.state && timerHandle !== null){
      stopTimer();
    }
  }
  
});

print("Script is running");
