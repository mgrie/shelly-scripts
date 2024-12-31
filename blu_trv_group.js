/// <reference path="../../shelly-script.d.ts" />

function log(message){
  print(message);
  MQTT.publish('shellyblugwg3-lehrerzimmer/log', message);
}
 
log('Start script');


let entities = {
  'bthomesensor:225' : {
    name: 'Target Temp Lehrerzimmer west',
    trvId: 201
  },
  'bthomesensor:233' : {
    name: 'Target Temp Lehrerzimmer nord',
    trvId: 202
  },
}

function setNewTargetTemparature(masterId, target_C){
  for (const key in entities) {
    if (entities.hasOwnProperty(key)) {
      if(key !== masterId){
        log("Zieltemperatur " + target_C +  " setzen für: " + entities[key].name); 
        log("TRV Id: " + entities[key].trvId)


        Shelly.call("BluTrv.call", { id: entities[key].trvId, method: 'Trv.SetTarget', params: {id:0, target_C: target_C}}, function(result, error_code, error_message){
          if(error_code) log(error_code);
          if(error_message) log(JSON.stringify(error_message));
          if(result) log(JSON.stringify(result));
        });

      }
    }
  }
}


Shelly.addStatusHandler(function(event, ud){
  if(!event) return;
  
  let entity = entities[event.component];

  if(entity){
    if(event.delta && event.delta.value) {
      log('Status ' + entity.name + ' target temp: ' + event.delta.value);

      setNewTargetTemparature(event.component, event.delta.value);
    }
  }
});


Shelly.addEventHandler(function(event, ud){
  if(!event) return;
  
  let entity = entities[event.component];

  if(entity){
    log('Event ' + entity.name + ': ' + JSON.stringify(event));
  }
});
