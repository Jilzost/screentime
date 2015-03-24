/*jslint node:true */
'use strict';

var http    = require('http');
var fs      = require('fs');
var path    = require('path');
var mime    = require('mime');
var logger = require('./logger');
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
function serveStatic(response, absPath) {
    if (cache[absPath]) {
        returnFile(response, absPath, cache[absPath]);
    } else {
        fs.exists(absPath, function (exists) {
            if (exists) {
                fs.readFile(absPath, function (err, data) {
                    if (err) {
                        logger.log('server', 'server', 2,
                            'fileRequestHandlers.serveStatic',
                            'serveStatic had error loading file ' + absPath,
                            new Date(), new Date(), false);
                        send500(response);
                    } else {
                        cache[absPath] = data;
                        returnFile(response, absPath, data);
                    }
                });
            } else {
                logger.log('server', 'server', 4,
                    'fileRequestHandlers.serveStatic',
                    'Could not find file ' + absPath,
                    new Date(), new Date(), false);
                send404(response);
            }
        });
    }
}

/**
 * Constructs a list of all the cache items that should be returned, 
 * according to the config and path received. 
 * Recursive: pathPiece can specify a path for a file or a group of paths
 * for a group of files.  
 * @param  {obj} configPiece The piece of the configuration requested; 
 *                           could be string or object with its own strings.
 * @param  {str} pathPiece   The newest piece of the path; is also
 *                              the part of configPiece requested.
 * @param  {str} pathSoFar   The path up to this point (parent dir of pathPiece). 
 * @return {[type]}             [description]
 */
function buildCacheItemList(configPiece, pathPiece, pathSoFar) {
    var i, listBuilder = [];
    try {
        if (!configPiece.hasOwnProperty(pathPiece)) {return []; }
        if (typeof configPiece[pathPiece] === 'string') {
            listBuilder.push(pathSoFar + '/' + pathPiece + '/' + configPiece[pathPiece]);
        } else {
            for (i in configPiece[pathPiece]) {
                if (configPiece[pathPiece].hasOwnProperty(i)) {
                    listBuilder = listBuilder.concat(
                        buildCacheItemList(configPiece[pathPiece], i,
                            pathSoFar + '/' + pathPiece)
                    );
                }
            }
        }
        return listBuilder;
    } catch (err) {
        logger.log('server', 'server', 2,
            'fileRequestHandlers.buildCacheItemList',
            'Failure building list: ' + err, new Date(), new Date(), false);
    }
}

/**
 * Serves files from the cache, loading if necessary, 
 * concatenating, and write one string repacement. 
 * @param  {[arr]} cacheItemList List of files to retrieve from cache
 * @param  {[type]} config        The requested configuration;
 *                                replaces DEFAULT_SIGN_CONFIG in response.
 * @param  {[type]} response      response handle for web request. 
 * @return {[type]}               [description]
 */
function buildAndSendList(cacheItemList, config, response) {
    var i, path, fileToReturn = '', neededPath = false;
    for (i = 0; i < cacheItemList.length; i += 1) {
        path = cacheItemList[i];
        if (!cache[path]) {
            i = cacheItemList.length;
            neededPath = path;
        }
    }
    if (neededPath) {
        fs.exists(neededPath, function (exists) {
            if (exists) {
                fs.readFile(neededPath, function (err, data) {
                    if (err) {
                        logger.log('server', 'server', 2,
                            'fileRequestHandlers.buildAndSendList',
                            'Error loading file ' + neededPath,
                            new Date(), new Date(), false);
                        send500(response);
                    } else {
                        cache[neededPath] = data;
                        buildAndSendList(cacheItemList, config, response);
                    }
                });
            } else {
                logger.log('server', 'server', 4,
                    'fileRequestHandlers.buildAndSendList',
                    'Could not find file ' + neededPath,
                    new Date(), new Date(), false);
                send404(response);
            }
        });
    } else {
        for (i = 0; i < cacheItemList.length; i += 1) {
            fileToReturn += cache[cacheItemList[i]];
        }
        fileToReturn = fileToReturn.replace(/DEFAULT_SIGN_CONFIG/g, config);
        returnFile(response, cacheItemList[i - 1], fileToReturn);
    }
}

/**
 * Handles a request with a config parameter. 
 * Loads configs if necessary, uses them to identify what files to return, 
 * and returns them. 
 * @param  {str} path     path requested. 
 * @param  {str} config   config parameter in request. 
 * @param  {[type]} response web request response handler. 
 */
function buildAndSendRequest(path, config, response) {
    var cacheItemList;
    logger.log('server', config, 5, 'fileRequestHandlers.buildAndSendRequest',
        'Request for path ' + path + ' config ' + config, new Date(),
        new Date(), false);
    if (!configs) {
        fs.exists('./public/sign/configs.json', function (exists) {
            if (exists) {
                fs.readFile('./public/sign/configs.json', function (err, data) {
                    if (err) {
                        logger.log('server', config, 1,
                            'fileRequestHandlers.buildAndSendRequest',
                            'Error loading configs', new Date(), new Date(),
                            true);
                        send500(response);
                    } else {
                        configs = JSON.parse(data);
                        buildAndSendRequest(path, config, response);
                    }
                });
            } else {
                logger.log('server', config, 1,
                    'fileRequestHandlers.buildAndSendRequest',
                    'Could not find configs', new Date(), new Date(), true);
                send500(response);
            }
        });
    } else {
        if (configs[config]) {
            cacheItemList = buildCacheItemList(configs[config], path.substring(1), './public/sign');
            buildAndSendList(cacheItemList, config, response);
        } else {
            logger.log('server', config, 3, 'fileRequestHandlers.buildAndSendRequest',
                'Could not find config ' + config, new Date(), new Date(), false);
            send404(response);
        }
    }
}

/**
 * Respond to a request for a file.
 * @param  {str} path     path requested
 * @param  {str} config   config requested (if applicable)
 * @param  {obj} response Web request response handle
 */
function sendFile(path, config, response) {
//TODO: "config" may no longer be necessary to handle at all. 
//Split handling into "sendFile" and "sendSignFile" in order to use
//DEFAULT_SIGN_CONFIG for sign-file requests where config was 
//not specfied.
    var absPath;
    if (config) {
        buildAndSendRequest(path, config, response);
    } else {
        if (path === '/' || path === '/index.htm') {
            absPath = './public/index.html';
        } else {
            absPath = './public' + path;
        }
        serveStatic(response, absPath);
    }
}

function sendSignFile(path, config, response) {
    config = config || 'DEFAULT_SIGN_CONFIG';
    buildAndSendRequest(path, config, response);
}

exports.sendFile = sendFile;
exports.sendSignFile = sendSignFile;
exports.send404 = send404;
exports.send500 = send500;
exports.returnFile = returnFile;
