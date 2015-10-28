/*jslint node:true */
'use strict';

var http    = require('http');
var fs      = require('fs');
var path    = require('path');
var mime    = require('mime');
var logger  = require('./logger');
var _und    = require('underscore');
var cache   = {};
var configs;

/**
 * return a 500 - internal server error.
 * @param  {[type]} response response handle for web request
 */
function send500(response) {
    response.writeHead(500, {'Content-Type': 'text/plain'});
    response.write('Error 500: Internal server error.');
    response.end();
}

/**
 * return a 404 - file not found.
 * @param  {[type]} response response handle for web request
 */
function send404(response) {
    response.writeHead(404, {'Content-Type': 'text/plain'});
    response.write('Error 404: resource not found.');
    response.end();
}

function buildAndSendResponse(path, id, response) {
    var config;
    if (!configs.signConfigs[id]) {
        send404(response);
    } else {
        if (configs.signConfigs[id].base) {

            config = _und.defaults(configs.signConfigs[id].values, configs.signConfigs.bases[configs.signConfigs[id].base]);
        } else {
            config = configs.signConfigs[id].values;
        }
        response.writeHead(200, {"Content-Type": "text/plain"});
        response.write(JSON.stringify(config));
        response.end();
    }
}

function getSignConfig(path, id, response) {
    logger.log('server', id, 5, 'configHandlers.checkForConfigs',
        'Request for path ' + path + ' id ' + id);
    if (!configs) {
        fs.exists('./configs.json', function (exists) {
            if (exists) {
                fs.readFile('./configs.json', function (err, data) {
                    if (err) {
                        logger.log('server', id, 1,
                            'configHandlers.checkForConfigs',
                            'Error loading configs');
                        send500(response);
                    } else {
                        configs = JSON.parse(data);
                        buildAndSendResponse(path, id, response);
                    }
                });
            } else {
                logger.log('server', id, 1,
                    'configHandlers.checkForConfigs',
                    'Could not find configs');
                send500(response);
            }
        });
    }
    buildAndSendResponse(path, id, response);
}

exports.getSignConfig = getSignConfig;