/*jslint node:true */
'use strict';

var server = require("./server");
var router = require("./router");
var fileRequestHandlers = require("./fileRequestHandlers");
var heartbeatHandlers = require("./heartbeatHandlers");
var logHandlers = require("./logHandlers");
var logger = require("./logger");
var sampleHandlers = require("./sampleHandlers");

var handle = {};

handle["/"] = fileRequestHandlers.sendFile;
handle["/index.html"] = fileRequestHandlers.sendFile;
handle["/index.htm"] = fileRequestHandlers.sendFile;
handle["/favicon.ico"] = fileRequestHandlers.sendFile;
handle["/stylesheet.css"] = fileRequestHandlers.sendFile;

handle["/sign"] = fileRequestHandlers.sendSignFile;
handle["/body"] = fileRequestHandlers.sendSignFile;
handle["/style"] = fileRequestHandlers.sendSignFile;
handle["/software"] = fileRequestHandlers.sendSignFile;

handle["/postheartbeat"] = heartbeatHandlers.heartbeat;
handle["/postlog"] = logHandlers.receiveLog;
handle["/postsample"] = sampleHandlers.newSamplePage;
handle["/postsamplestat"] = sampleHandlers.newSampleStat;

handle["/sample"] = sampleHandlers.showSample;
handle["/samples"] = sampleHandlers.showSamples;

server.start(router.route, handle);
logger.startLogging();