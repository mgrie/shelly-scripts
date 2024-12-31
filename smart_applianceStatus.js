/// <reference path="../../shelly-script.d.ts" />
// created from vscode

let log = function(message){
  
    try {
        if(typeof message === 'object' ){
            message = JSON.stringify(message);
        } else if (typeof message !== 'string'){
            message = message.toString();
        }
     
        print(message);

        // Shelly.emitEvent("log", message);
        
        if(MQTT.isConnected()) {
            MQTT.publish("shelly-waschmaschine-marcella/jsdebug", message);
        }
    } catch (error) {
        print("Error: " + JSON.stringify(error));
    }
  }

log("Script 'ApplianceStatus' start");

const DEVICE_STATE = {
    ON: 'on',
    OFF: 'off',
    STANDBY: 'standby'
};

const DEVICE_EVENT = {
    NOTHING: 'nothing',
    UPDATE: 'update',
    CHANGE: 'change'
};

// production "pm1:0"
// debug "script:2"
const EVENT_COMPONENT = "pm1:0";
// production "power_update"
// debug "current_change"
const EVENT_NAME = "power_update";

const THIS_COMPONENT = "script:" + Shelly.getCurrentScriptId();

const DEVICE_OFF_MAX_HANDLE = Virtual.getHandle("number:211");
const DEVICE_STANDBY_MAX_HANDLE = Virtual.getHandle("number:210");
const VHANDLE_APPLIANCE_STATUS = Virtual.getHandle("enum:200");
const VHANDLE_APPLIANCE_TIMESPAN = Virtual.getHandle("number:201");
const VHANDLE_APPLIANCE_TOTALPOWER = Virtual.getHandle("number:200");

VHANDLE_APPLIANCE_STATUS.setValue(DEVICE_STATE.OFF);

const CHANGE_TIME_THRESHOLD = 60;

let scriptStartTime = Date.now() / 1000;

let current_state = {
    status: DEVICE_STATE.OFF,
    event: DEVICE_EVENT.NOTHING,
    last_apower: 0,
    lastChange: scriptStartTime,
    lastStateVerification: scriptStartTime
};

let current_messurement = {
    startTotalEnergy: null,
    startTime: null
}

function checkStateChangeAndFireEvent(power, ts){
    if(!ts){
        log("Error, ts not set!");
        return;
    }

    let actualDeviceStatus;
    if(power < DEVICE_OFF_MAX_HANDLE.getValue()){
        actualDeviceStatus = DEVICE_STATE.OFF;
    } else if(power < DEVICE_STANDBY_MAX_HANDLE.getValue()){
        actualDeviceStatus = DEVICE_STATE.STANDBY;
    } else {
        actualDeviceStatus = DEVICE_STATE.ON;
    }

    current_state.last_apower = power;

    // state verification
    if(current_state.status === actualDeviceStatus){
        current_state.lastStateVerification = ts;
        current_state.event = DEVICE_EVENT.UPDATE;
    }  else {
        // fast standby detection
        if(current_state.status === DEVICE_STATE.OFF && actualDeviceStatus === DEVICE_STATE.STANDBY){
            current_state.event = DEVICE_EVENT.CHANGE;
            current_state.lastChange = ts;
            current_state.lastStateVerification = ts;
            current_state.status = actualDeviceStatus;
        // check if threshold reached
        } else if(current_state.lastStateVerification + CHANGE_TIME_THRESHOLD < ts){
            current_state.status = actualDeviceStatus;
            current_state.lastChange = ts;
            current_state.lastStateVerification = ts;
            current_state.event = DEVICE_EVENT.CHANGE;
        // wait for threshold
        } else {
            current_state.event = DEVICE_EVENT.NOTHING;
        }
    }

    Shelly.emitEvent(current_state.event, current_state.status);
}


Shelly.addEventHandler(function(event, userdata){

    // Power event
    if(event && event.info.component === EVENT_COMPONENT && event.info.event === EVENT_NAME){
        checkStateChangeAndFireEvent(event.info.data.apower, event.info.ts);
    }
      
    // Script events
    if(event && event.info.component === THIS_COMPONENT && event.info.event === DEVICE_EVENT.CHANGE){
        VHANDLE_APPLIANCE_STATUS.setValue(event.info.data);

        Shelly.call("PM1.GetStatus", {id:0}, function(result, error_code, error_message, status){
            if(status === DEVICE_STATE.ON){
                current_messurement.startTime = result.aenergy.minute_ts;
                current_messurement.startTotalEnergy = result.aenergy.total;    
            } else {
                if(current_messurement.startTime && current_messurement.startTotalEnergy){
                    let timespan = result.aenergy.minute_ts - current_messurement.startTime;
                    let energyspan = result.aenergy.total - current_messurement.startTotalEnergy;

                    log("Zeitmessung: " + timespan);
                    VHANDLE_APPLIANCE_TIMESPAN.setValue(timespan/60);
                    log("Energiemessung: " + energyspan);
                    VHANDLE_APPLIANCE_TOTALPOWER.setValue(energyspan/1000);
                } else {
                    current_messurement.startTime = null;
                    current_messurement.startTotalEnergy = null;    
                }
            }
        }, event.info.data);
    }
}, null);

// Additional loop prevents deadlock and triggers state changes
Timer.set(1000 * CHANGE_TIME_THRESHOLD, true, function(){
    let ts = Date.now() / 1000;
    if(current_state.lastStateVerification + CHANGE_TIME_THRESHOLD < ts){
        checkStateChangeAndFireEvent(current_state.last_apower, ts);
    }
});


function getAverage(oldAverage, averageCounter, currentAmount){
    let newAverage = ((oldAverage * averageCounter) + currentAmount) / ++averageCounter;

    return {
        counter: averageCounter,
        average: newAverage
    }
}

//ToDo: average Power
//ToDo: lastPower
//ToDo: last action (Date)
