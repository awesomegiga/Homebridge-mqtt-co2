'use strict';

var mqtt = require('mqtt');
var Service, Characteristic;

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory("homebridge-mqtt-co2", "mqtt-co2", AirQualityAccessory);
}

function AirQualityAccessory(log, config) {
  this.log = log;
  this.name = config["name"];
  this.url = config['url'];
  this.topic_co2_level= config['topic_co2_level'];
  this.updateInterval = config['update_Interval'];
  this.co2Threshold = config['co2_Threshold'];



  this.client_Id 		= 'mqttjs_' + Math.random().toString(16).substr(2, 8);7
  this.options = {
    keepalive: 10,
    clientId: this.client_Id,
    protocolId: 'MQTT',
    protocolVersion: 4,
    clean: true,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000,
    will: {
      topic: 'WillMsg',
      payload: 'Connection Closed abnormally..!',
      qos: 0,
      retain: false
      },
    username: config["username"],
    password: config["password"],
    rejectUnauthorized: false
  };

  var co2CurrentLevel = 0;
  var co2PeakLevel = 5000;
  var co2Detected = false;
  var co2LevelUpdated = false;

  this.service = new Service.CarbonDioxideSensor(this.name);

  this.service
  .getCharacteristic(new Characteristic.CarbonDioxideDetected())
  .on('get', this.getCo2Detected.bind(this));

  this.service
  .getCharacteristic(new Characteristic.CarbonDioxideLevel())
  .on('get', this.getCo2Level.bind(this));

  this.service
  .addCharacteristic(new Characteristic.CarbonDioxidePeakLevel())
  .on('get', this.getCo2PeakLevel.bind(this));

  this.service
  .addCharacteristic(new Characteristic.StatusTampered())
  .on('get', this.co2LevelUpdated.bind(this));

  this.informationService = new Service.AccessoryInformation();

  this.informationService
      .setCharacteristic(Characteristic.Manufacturer, "Winsen")
      .setCharacteristic(Characteristic.Model, "MH-Z14A")
      .setCharacteristic(Characteristic.SerialNumber, "XXXXXX");


  var that = this;

  setInterval(function () {
    if (that.co2LevelUpdated === true)
    {
      that.service
      .setCharacteristic(Characteristic.StatusTampered, false);
      that.co2LevelUpdated = false;
      that.log('CO2 level updated recently (No Obstruction Detected)');
    }
    else
    {
      that.service
      .setCharacteristic(Characteristic.StatusTampered, true);
      that.log('CO2 level not updated since ',  that.updateInterval*2,' minutes (Obstruction Detected)');
    }
  }, (that.updateInterval*2)*60*1000);

  this.client  = mqtt.connect(this.url, this.options);
  this.client.subscribe(this.topic_co2_level);


  this.client.on('message', function (topic, message) {
  data = JSON.parse(message);
  if (data === null) {return null}
  if (topic === that.topic_co2_level)
  {
    that.co2CurrentLevel = parseFloat(data);
    that.co2LevelUpdated = true;
    that.log('- MQTT : CO2 concentration =', that.co2CurrentLevel, 'ppm');
    that.setCo2Detected();
  }
  });
}

AirQualityAccessory.prototype.getCo2Level = function(callback) {
  callback(null, this.co2CurrentLevel);
}

AirQualityAccessory.prototype.getCo2PeakLevel = function(callback) {
  callback(null, this.co2PeakLevel);
}


AirQualityAccessory.prototype.setCo2Detected = function() {
  if (this.co2CurrentLevel >= this.co2Threshold){
    this.co2Detected = true;
    this.log('Abnormal Co2 level detected');
  }
  else{
    this.co2Detected = false;
  }
  this.service
  .setCharacteristic(Characteristic.CarbonDioxideDetected, this.co2Detected.bind(this));
}

AirQualityAccessory.prototype.getCo2Detected = function(callback) {
    this.log('CO2 concentration =', this.co2CurrentLevel, 'ppm');
    callback(null, this.co2Detected);
}

AirQualityAccessory.prototype.getServices = function() {
  return [this.service, this.informationService];
}
