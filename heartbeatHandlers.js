/*jslint node:true */
'use strict';

var http = require('http');
var logger = require('./logger');

var lastbeats = {};

function checkHeartbeat(beat) {

    if (beat.serverTime === lastbeats[beat.sign].serverTime) {
        logger.log('server', beat.sign, 2, 'checkHeartbeat',
            'No heartbeat (uptime was ' +
                logger.formatDuration(lastbeats[beat.sign].uptime) + ')');
        lastbeats[beat.sign].up = false;
    }
}

function heartbeat(pathname, id, response, postData) {
    id = id.id;
    try {
        var beat = JSON.parse(postData);

        beat.serverTime = Date.now();
        beat.up = true;

        if (!lastbeats.hasOwnProperty(beat.sign)) {
            if (beat.uptime < 1000) {
                logger.log('server', beat.sign, 2, 'checkHeartbeat',
                    'New sign activated');
            } else {
                logger.log('server', beat.sign, 4, 'checkHeartbeat',
                    'First heartbeat from existing sign');
            }
        } else if (lastbeats[beat.sign].serverTime +
                lastbeats[beat.sign].heartbeatRate < Date.now()) {
            logger.log('server', beat.sign, 2, 'checkHeartbeat',
                'Sign is back online');
        } else if (lastbeats[beat.sign].uptime > beat.uptime) {
            logger.log('server', beat.sign, 4, 'checkHeartbeat',
                'Sign has reset (uptime was '
                    + logger.formatDuration(lastbeats[beat.sign].uptime)
                    + ')');
        }

        lastbeats[beat.sign] = beat;

        setTimeout(function () {checkHeartbeat(beat); }, beat.heartbeatRate);

        response.writeHead(200, {"Content-Type": "text/plain"});
        response.write('ok');

        response.end();
    } catch (err) {
        logger.log('server', 'server', 2,
            'heartbeatHandlers.heartbeat', 'Failed: ' + err);
    }
}

function getUptimes(maximumDowntime) {
    var i, times = [];
    try {
        maximumDowntime = maximumDowntime || 0;
        for (i in lastbeats) {
            if (lastbeats.hasOwnProperty(i)) {
                if (lastbeats[i].up) {
                    times.push({
                        sign: lastbeats[i].sign,
                        up: true,
                        time: lastbeats[i].uptime
                    });
                } else if (maximumDowntime === 0 ||
                        new Date() - lastbeats[i].timestamp < maximumDowntime) {
                    times.push({
                        sign: lastbeats[i].sign,
                        up: false,
                        time: Date.now() - lastbeats[i].timestamp
                    });
                }
            }
        }
        times.sort(function (a, b) {
            if (a.sign < b.sign) {return -1; }
            if (a.sign > b.sign) {return 1; }
            return 0;
        });
        return times;
    } catch (err) {
        logger.log('server', 'server', 2,
            'heartbeatHandlers.getUptimes', 'Failed: ' + err);
        return [];
    }
}

exports.heartbeat = heartbeat;
exports.getUptimes = getUptimes;
