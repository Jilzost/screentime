/*jslint node:true */
'use strict';

var http    = require('http');
var fs      = require('fs');
var path    = require('path');
var mime    = require('mime');
var logger  = require('./logger');
var _und    = require('underscore');
var config = require('config');
var cache   = {};
//var configs;

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

function getSignConfig(path, id, response) {
    var vals;
    if (!config.signConfigs[id]) {
        send404(response);
    } else {
        if (config.signConfigs[id].base) {

            vals = _und.defaults(config.signConfigs[id].values, config.signConfigs.bases[config.signConfigs[id].base]);
        } else {
            vals = config.signConfigs[id].values;
        }
        response.writeHead(200, {"Content-Type": "text/plain"});
        response.write(JSON.stringify(vals));
        response.end();
    }
}

exports.getSignConfig = getSignConfig;