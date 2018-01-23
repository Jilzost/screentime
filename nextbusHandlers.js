/*jslint node:true */
'use strict';

var http    = require('http');
var fs      = require('fs');
var path    = require('path');
var mime    = require('mime');
var logger  = require('./logger');
var _und    = require('underscore');
var config  = require('config');
var xml2js  = require('xml2js');
var cron = require('cron');

var cache   = {
    routes: {},
    departures: {}, //not implemented
    alerts: {} //not implemented
};
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

function sendResponse(path, options, ourResponse, ourBody) {
    ourResponse.writeHead(200, {'Content-Type': 'application/json'});
    ourResponse.write(ourBody);
    ourResponse.end();
}

//For use when routeConfig has been run on one route only
function parseOneRoute(options, theirBody) {
    var routes, r, i = 10000000;
    try {
        if (theirBody.body.Error) {
            logger.log('server', 'server', 2,
                  'nextbusHandlers.parseOneRoute', 'Failed, NextBus error: ' + theirBody.body.Error[0]._);
        }
        if (!cache.routes[options.agency]) {
            cache.routes[options.agency] = {};
        }

        routes = theirBody.body.route;
        logger.log('server', 'server', 2,
              'nextbusHandlers.parseOneRoute', 'options pre-loop: ' + options);
        _und(routes).each(function (route) {
            logger.log('server', 'server', 2,
                  'nextbusHandlers.parseOneRoute', 'options  in-loop: ' + options);
            r = {
                txid: route.$.tag,
                name: route.$.shortTitle || route.$.title.length > 12 ? route.$.tag : route.$.title,
                color: route.$.oppositeColor === 'ffffff' ? '#ffffff' : '#' + route.$.color,
                sortOrder: i,
                fromRouteConfig: true
            };
            if (!cache.routes[options.agency][r.txid]) {
                cache.routes[options.agency][r.txid] = r;
            } else {
                cache.routes[options.agency][r.txid].color = r.color;
                cache.routes[options.agency][r.txid].fromRouteConfig = true;
            }
        });
    } catch (err) {
        logger.log('server', 'server', 2,
              'nextbusHandlers.parseOneRoute', 'Failed: ' + err);
    }
}

function parseRoutes(path, options, ourResponse, theirBody, fromRouteConfig) {
    var i = 10000000, routes, ourBody = [], routeCache = {}, r, color;
    try {
        if (theirBody.body.Error) {
            logger.log('server', 'server', 2,
                  'nextbusHandlers.parseRoutes', 'Failed, NextBus error: ' + theirBody.body.Error[0]._);
        }
        routes = theirBody.body.route;
        _und(routes).each(function (route) {
            if (route.$.color) {
                color = route.$.oppositeColor === 'ffffff' ? '#ffffff' : '#' + route.$.color;
            } else {
//                color = false;
                color = '#ffffff';
            }
            r = {
                txid: route.$.tag,
                name: route.$.shortTitle || route.$.title.length > 12 ? route.$.tag : route.$.title,
                color: color,
                sortOrder: i,
                fromRouteConfig: fromRouteConfig
            };
            _und(ourBody).push(r);
            routeCache[r.txid] = r;
            i += 1;
        });

        cache.routes[options.agency] = routeCache;
        ourBody = JSON.stringify(ourBody);
        sendResponse(path, options, ourResponse, ourBody);
    } catch (err) {
        logger.log('server', 'server', 2,
              'nextbusHandlers.parseRoutes', 'Failed: ' + err);
        send500(ourResponse);
    }
}

//Used if routeConfig fails
function routeList(path, options, ourResponse) {
    var agency = options.agency;
    return http.get({
        host: 'webservices.nextbus.com',
        path: '/service/publicXMLFeed?command=routeList&a=' + agency,
    }, function (theirResponse) {
      // Continuously update stream with data
        var body = '';
        theirResponse.on('data', function (d) {
            body += d;
        });
        theirResponse.on('end', function () {
            try {
                xml2js.parseString(body,
                    function (err, result) {
                        parseRoutes(path, options, ourResponse, result);
                    });
            } catch (err) {
                logger.log('server', 'server', 2,
                        'nextbusHandlers.routes.onEnd', 'Failed: ' + err);
                send500(ourResponse);
            }
        });
        theirResponse.on('error', function (err) {
            logger.log('server', 'server', 2,
                'nextbusHandlers.routeList', 'Failed: ' + err);
            send500(ourResponse);
        });
    });
}

function routes(path, options, ourResponse) {
    var agency = options.agency;
    return http.get({
        host: 'webservices.nextbus.com',
        path: '/service/publicXMLFeed?command=routeConfig&a=' + agency,
    }, function (theirResponse) {
      // Continuously update stream with data
        var body = '';
        theirResponse.on('data', function (d) {
            body += d;
        });
        theirResponse.on('end', function () {
            try {
                if (body.length < 1000) {
                    routeList(path, options, ourResponse);
                } else {
                    xml2js.parseString(body,
                        function (err, result) {
                            parseRoutes(path, options, ourResponse, result, true);
                        });
                }
            } catch (err) {
                logger.log('server', 'server', 2,
                        'nextbusHandlers.routes.onEnd', 'Failed: ' + err);
                send500(ourResponse);
            }
        });
        theirResponse.on('error', function (err) {
            logger.log('server', 'server', 2,
                'nextbusHandlers.routes', 'Failed: ' + err);
            send500(ourResponse);
        });
    });
}

function cacheOneRoute(options) {
    var params = '&a=' + options.agency + '&r=' + options.route;
    cache.routes[options.agency][options.route].fromRouteConfig = true;
    return http.get({
        host: 'webservices.nextbus.com',
        path: '/service/publicXMLFeed?command=routeConfig' + params
    }, function (theirResponse) {
      // Continuously update stream with data
        var body = '';
        theirResponse.on('data', function (d) {
            body += d;
        });
        theirResponse.on('end', function () {
            try {
                if (body.length >= 1000) {
                    xml2js.parseString(body,
                        function (err, result) {
                            parseOneRoute(options, result);
                        });
                }
            } catch (err) {
                logger.log('server', 'server', 2,
                        'nextbusHandlers.cacheOneRoute.onEnd', 'Failed: ' + err);
            }
        });
        theirResponse.on('error', function (err) {
            logger.log('server', 'server', 2,
                'nextbusHandlers.cacheOneRoute', 'Failed: ' + err);
        });
    });
}

function parseDepartures(path, options, ourResponse, theirBody) {
    var ourBody = [], routes, cachedRoutes = {}, cachedRoute;
    try {
        if (theirBody.body.Error) {
            logger.log('server', 'server', 2,
                  'nextbusHandlers.parseOneRoute', 'Failed, NextBus error: ' + theirBody.body.Error[0]._);
        }
        if (cache.routes[options.agency]) {
            cachedRoutes = cache.routes[options.agency];
        }
        routes = theirBody.body.predictions;
        _und(routes).each(function (route) {
            _und(route.direction).each(function (direction) {
                _und(direction.prediction).each(function (prediction) {
                    if (cachedRoutes[route.$.routeTag]) {
                        cachedRoute = cachedRoutes[route.$.routeTag];
                    } else {
                        cachedRoute = {
                            txid: route.$.routeTag,
                            name: route.$.routeTitle
                        };
                    }
                    if (!cachedRoute.fromRouteConfig) {
                        cacheOneRoute({agency: options.agency, route: cachedRoute.txid});
                    }
                    _und(ourBody).push({
                        route: cachedRoute,
                        direction: 'N/A',
                        destinationTitle: direction.$.title,
                        tripId: prediction.$.tripTag,
                        predictedTime: prediction.$.epochTime,
                        locationName: route.$.stopTitle
                    });
                });
            });
        });
        ourBody = JSON.stringify(ourBody);
        sendResponse(path, options, ourResponse, ourBody);
    } catch (err) {
        logger.log('server', 'server', 2,
              'nextbusHandlers.parseDepartures', 'Failed: ' + err);
        send500(ourResponse);
    }
}

function departures(path, options, ourResponse) {
    var agency = options.agency,
        stop = options.stop,
        useShortTitles = options.useShortTitles || 'true',
        cmdPath = '/service/publicXMLFeed?command=predictions',
        fullPath;

    fullPath = cmdPath + '&a=' + agency +
        '&stopId=' + stop + '&useShortTitles=' + useShortTitles;

    return http.get({
        host: 'webservices.nextbus.com',
        path: fullPath,
    }, function (theirResponse) {
      // Continuously update stream with data
        var body = '';
        theirResponse.on('data', function (d) {
            body += d;
        });
        theirResponse.on('end', function () {
            try {
                xml2js.parseString(body,
                    function (err, result) {
                        parseDepartures(path, options, ourResponse, result);
                    });
            } catch (err) {
                logger.log('server', 'server', 2,
                        'nextbusHandlers.departures.onEnd', 'Failed: ' + err);
                send500(ourResponse);
            }
        });
        theirResponse.on('error', function (err) {
            logger.log('server', 'server', 2,
                'nextbusHandlers.departures', 'Failed: ' + err);
            send500(ourResponse);
        });
    });
}

function alerts(path, options, response) {
    response.writeHead(200, {"Content-Type": "text/plain"});
    response.write('');
    response.end();
}

function emptyRoutes() {
    cache.routes = {};
}

function startCacheJobs() {
    var routesJob = new cron.CronJob('15 02 3 * * *', function () {emptyRoutes(); }, null, true);
}

startCacheJobs();

exports.routes = routes;
exports.departures = departures;
exports.alerts = alerts;
