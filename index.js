/*jslint node:true */
'use strict';

var server = require("./server");
var router = require("./router");
var fileRequestHandlers = require("./fileRequestHandlers");
var heartbeatHandlers = require("./heartbeatHandlers");
var configHandlers = require("./configHandlers");
var logHandlers = require("./logHandlers");
var logger = require("./logger");
var sampleHandlers = require("./sampleHandlers");
var nextbusHandlers = require("./nextbusHandlers");
var speechSampleHandlers = require("./speechSampleHandlers");
var socketServer = require("./socketServer");


var handle = {};

handle["/"] = fileRequestHandlers.sendFile;
handle["/index.html"] = fileRequestHandlers.sendFile;
handle["/index.htm"] = fileRequestHandlers.sendFile;
handle["/favicon.ico"] = fileRequestHandlers.sendFile;
handle["/stylesheet.css"] = fileRequestHandlers.sendFile;
handle["/sign/software/mespeak/mespeak_config.json"] = fileRequestHandlers.sendFile;
handle["/sign/software/mespeak/voices/en/en-us.json"] = fileRequestHandlers.sendFile;

handle["/nextbus/routes"] = nextbusHandlers.routes;
handle["/nextbus/departures"] = nextbusHandlers.departures;
handle["/getsignconfig"] = configHandlers.getSignConfig;
handle["/postheartbeat"] = heartbeatHandlers.heartbeat;
handle["/postlog"] = logHandlers.receiveLog;
handle["/postsample"] = sampleHandlers.newSamplePage;
handle["/postsamplestat"] = sampleHandlers.newSampleStat;
handle["/postspeechsample"] = speechSampleHandlers.newSpeechSample;

handle["/sample"] = sampleHandlers.showSample;
handle["/samples"] = sampleHandlers.showSamples;

handle["/speechsample"] = speechSampleHandlers.showSample;
handle["/speechsamples"] = speechSampleHandlers.showSamples;

handle["/speak.mp3"] = socketServer.speak;


server.start(router.route, handle);
logger.startLogging();
