/*jslint node:true */
'use strict';

var http    = require('http');
var fs      = require('fs');
var path    = require('path');
var mime    = require('mime');
var logger  = require('./logger');
var cache   = {};
var configs;

/**
 * return a 404 - file not found.
 * @param  {[type]} response response handle for web request
 */
function send404(response) {
    response.writeHead(404, {'Content-Type': 'text/plain'});
    response.write('Error 404: resource not found.');
    response.end();
}

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
 * returns a response.
 * @param  {[type]} response     response handle for web request
 * @param  {[type]} filePath     path to be returned
 * @param  {[type]} fileContents data to return
 */
function returnFile(response, filePath, fileContents) {
    response.writeHead(
        200,
        {"content-type": mime.lookup(path.basename(filePath))}
    );
    response.end(fileContents);
}

/**
 * Serves a file from the cache, loading it first if necessary.
 * @param  {[type]} response response handle for web request
 * @param  {[type]} absPath  path requested
 */
function serveStatic(response, absPath, id) {
    if (cache[absPath]) {
        returnFile(response, absPath, cache[absPath]);
    } else {
        fs.exists(absPath, function (exists) {
            if (exists) {
                fs.readFile(absPath, function (err, data) {
                    if (err) {
                        logger.log('server', 'server', 2,
                            'fileRequestHandlers.serveStatic',
                            'serveStatic had error loading file ' + absPath);
                        send500(response);
                    } else {
                        cache[absPath] = data;
                        returnFile(response, absPath, data);
                    }
                });
            } else {
                logger.log('server', id, 4,
                    'fileRequestHandlers.serveStatic',
                    'Could not find file ' + absPath);
                send404(response);
            }
        });
    }
}

/**
 * Respond to a request for a file.
 * @param  {str} path     path requested
 * @param  {str} id       id requested (if applicable)
 * @param  {obj} response Web request response handle
 */
function sendFile(path, id, response) {
//TODO: "id" may no longer be necessary to handle at all.
    var absPath;
    if (path === '/' || path === '/index.htm') {
        absPath = './public/index.html';
    } else if (path === '/sign') {
        absPath = './public/sign/sign/sign.html';
    } else {
        absPath = './public' + path;
    }
    serveStatic(response, absPath, id);
}

exports.sendFile = sendFile;
exports.send404 = send404;
exports.send500 = send500;
exports.returnFile = returnFile;
