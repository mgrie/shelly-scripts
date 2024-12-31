/// <reference path="../../shelly-script.d.ts" />

Timer.set(20000, false, function(){
  MQTT.publish('shellyblugwg3-lehrerzimmer/log', 'Restart detected!');
})

