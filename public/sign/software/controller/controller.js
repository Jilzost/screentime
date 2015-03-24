/*jslint devel: true indent: 4 */
/*global b, c, XMLHttpRequest, SpeechSynthesisUtterance, speechSynthesis, document, window */

//Supported datasources formats:
// - MBTA-realtime: the MBTA's real-time information API

//
//
//  ********************* BEGIN CONTROLLER  *********************
//  
// 

var Entry = function (source, sign, logLevel, process, message, sourceTime) {
    'use strict';
    this.logTime = new Date();
    this.source = source;
    this.sign = sign;
    this.sourceTime = sourceTime || new Date();
    this.logLevel = logLevel;
    this.process = process;
    this.message = message;
};

var log = {};
log.countingEntriesSince = Date.now();
log.entriesCounted = 0;
log.unsentEntries = 0;
log.send = function (logLevel, sourceFunctionName, message) {
    'use strict';
    var unsent, entry, xhr;
    try {
        if (logLevel <= b.logging.level) {
            if (log.entriesCounted < b.logging.maxEntries) {
                log.entriesCounted += 1;
                if (b.logging.destination === 'console') {
                    console.log(logLevel + ',' + sourceFunctionName + ',' + message);
                } else {
                    entry = new Entry('sign', 'DEFAULT_SIGN_CONFIG',
                            logLevel, sourceFunctionName, message);
                    xhr = new XMLHttpRequest();
                    xhr.open('POST', 'postlog', true);
                    xhr.send(JSON.stringify(entry));
                }
            } else if (log.countingEntriesSince + b.logging.allowedEvery > Date.now()) {
                log.unsentEntries += 1;
            } else {
                log.countingEntriesSince = Date.now();
                log.entriesCounted = 0;
                if (log.unsentEntries > 0) {
                    unsent = log.unsentEntries;
                    log.criticalError('log.send', unsent +
                        ' log entries were not sent due to overflow.');
                    log.unsentEntries = 0;
                }
            }
        }
    } catch (err) {
        console.error('Failed to log, ' + err);
    }
};

log.info = function (sourceFunctionName, message) {
    'use strict';
    log.send(4, sourceFunctionName, message);
};

log.warning = function (sourceFunctionName, message) {
    'use strict';
    log.send(3, sourceFunctionName, message);
};

log.error = function (sourceFunctionName, message) {
    'use strict';
    log.send(2, sourceFunctionName, message);
};

log.criticalError = function (sourceFunctionName, message) {
    'use strict';
    log.send(1, sourceFunctionName, message);
};

log.errorPieces = function (errorMsg, url, lineNumber, column, errorObj) {
    'use strict';
    log.send(2, 'errorPieces', 'Error: ' + errorMsg + ' Script: ' + url
                + ' Line: ' + lineNumber + ' Column: ' + column
                + ' StackTrace: ' +  errorObj);
};

log.heartbeat = function (signId, uptime, heartbeatRate) {
    'use strict';
    if (b.logging.level !== 0) {
        if (b.logging.destination !== 'console') {
            var xhr = new XMLHttpRequest();
            xhr.open('POST', 'postheartbeat', true);
            xhr.send(JSON.stringify({signId: signId, timestamp: Date.now(), uptime: uptime, heartbeatRate: heartbeatRate }));
        }
    }
};

Object.prototype.matches = function (template) {
    'use strict';
    var i;
    try {
        for (i in template) {
            if (template.hasOwnProperty(i)) {
                if (this[i] !== template[i]) {
                    return false;
                }
            }
        }
        return true;
    } catch (err) {
        log.warning('Object.prototype.matches', err);
        return false;
    }
};

Object.prototype.matchesOneOf = function (templates) {
    'use strict';
    var i;
    try {
        for (i = 0; i < templates.length; i += 1) {
            if (this.matches(templates[i])) {
                return true;
            }
        }
    } catch (err) {
        log.warning('Object.prototype.matchesOneOf', err);
    }
    return false;
};

Array.prototype.pushUnique = function (item) {
    'use strict';
    try {
        if (this.indexOf(item) === -1) {
            this.push(item);
            return true;
        }
    } catch (err) {
        log.warning('Array.prototype.pushUnique', err);
    }
    return false;
};

String.prototype.cap = function () {
    /*  Adds capability to string to capitalize first letter. 
     *  
     */
    'use strict';
    return this.charAt(0).toUpperCase() + this.slice(1);
};

window.onerror = function (errorMsg, url, lineNumber, column, errorObj) {
    'use strict';
    log.errorPieces(errorMsg, url, lineNumber, column, errorObj);
};





var d = {};
var f = {};
var v = {};
var generators = {};
var visualizers = {};
var vocalizers = {};
var allVisualElements = [
    'featuredAlerts',
    'departures',
    'currentAlerts',
    'upcomingAlerts',
    'elevatorAlerts',
    'welcome'];

var SampleStat = function (samplePageData) {
    'use strict';
    this.sign = samplePageData.sign;
    this.serverId = samplePageData.serverId;
    this.countSinceLastShared = samplePageData.countSinceLastShared;
    this.lastShown = samplePageData.lastShown;
};

var SamplePageData = function (sign, localId, serverId, content, firstShown, lastShown, lastShared, count, countSinceLastShared) {
    'use strict';
    this.sign = sign;
    this.localId = localId;
    this.serverId = serverId || -1;
    this.content = content;
    this.firstShown = firstShown;
    this.lastShown = lastShown;
    this.lastShared = lastShared;
    this.count = count;
    this.countSinceLastShared = countSinceLastShared;
};

log.samplepages = [];
log.samplepagedata = [];
log.lastSampleSent = Date.now();
log.sampleComputeTime = 1;

log.sendSampleStats = function () {
    'use strict';
    var i, xhr;
    //For each sample:
    for (i = 0; i < log.samplepagedata.length; i += 1) {
        //If it has a serverid, and it has a countsincelastshared, 
        if (log.samplepagedata[i].serverId >= 0 && log.samplepagedata[i].countSinceLastShared > 0) {
            //Send it and set its statistics accordingly. 
            xhr = new XMLHttpRequest();
            xhr.open('POST', 'postsamplestat', true);

            xhr.send(JSON.stringify(new SampleStat(log.samplepagedata[i])));
            log.samplepagedata[i].lastShared = new Date();
            log.samplepagedata[i].countSinceLastShared = 0;
        }
    }
};

log.shareSample = function (index) {
    'use strict';
    var xhr;
    try {
        xhr = new XMLHttpRequest();
        xhr.open('POST', 'postsample');
        xhr.onload = (function (index) {
            return function (e) {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        log.samplepagedata[index].serverId = JSON.parse(xhr.responseText);
                        log.samplepagedata[index].lastShared = new Date();
                        log.samplepagedata[index].countSinceLastShared = 0;

                    } else {
                        log.error('log.shareSample', JSON.stringify(e));
                    }
                    log.sendSampleStats();
                }
            };
        }(index));
        xhr.onerror = (function (index) {
            return function (e) {
                log.warning('log.shareSample', 'Could not share sample number ' + index + ' because ' + JSON.stringify(e));
            };
        }(index));
        xhr.send(JSON.stringify(log.samplepagedata[index]));
    } catch (err) {
        log.error('log.shareSample' + err);
    }
};

log.shareSamplesAndStats = function () {
    'use strict';
    var i, mostShows = 0, mostShown;
    //1. Find the most-shown sample that has never been sent.
    for (i = 0; i < log.samplepagedata.length; i += 1) {
        if (log.samplepagedata[i].serverId === -1 &&
                log.samplepagedata[i].count >= mostShows) {
            mostShown = i;
            mostShows = log.samplepagedata[i].count;
        }
    }
    //2a. If there is one, send it, then send the latest sample count.
    if (mostShows > 0) {
        log.shareSample(mostShown);
    } else {
    //2b. If there isn't one, go straight to latest sample count. 
        log.sendSampleStats();
    }
    log.lastSampleSent = Date.now();
};

log.sample = function () {
    'use strict';
    var index,
        head,
        body,
        foot,
        samplepage,
        searchStartTime;

    if (!b.logging.sendSamples) { return true; }

    //TODO: the following hard-codes one stylesheet link. Need systematic way to 
    //manage files and versions. 

    head = '<!DOCTYPE html>' +
        '<html lang="en"><head><title>ScreenTime</title>' +
        '<link rel=\'stylesheet\' href=\'style\'></link></head>' +
        '<body>';
    body = document.body.innerHTML;
    foot = '</body></html>';
    searchStartTime = Date.now();

    samplepage = head + body.replace(/^.*display: none.*$/gm, '') + foot;

    samplepage = samplepage.replace(/<td class="minutes_away">[02-9]/g,
        '<td class="minutes_away">2');
    samplepage = samplepage.replace(/<td class="minutes_away">1[02-9]/g,
        '<td class="minutes_away">12');
    samplepage = samplepage.replace(/<td class="minutes_away">2[02-9]/g,
        '<td class="minutes_away">22');
    samplepage = samplepage.replace(/<div id="clock">[\d\:]{4,5}<\/div>/,
        '<div id="clock">11:11</div>');

    index = log.samplepages.indexOf(samplepage);
    if (index === -1) {
        log.samplepages.push(samplepage);
        index = log.samplepages.indexOf(samplepage);
        log.samplepagedata[index] = new SamplePageData('DEFAULT_SIGN_CONFIG',
            index, -1, samplepage, new Date(), new Date(), new Date(0), 1, 1);
    } else {
        log.samplepagedata[index].lastShown = new Date();
        log.samplepagedata[index].count += 1;
        log.samplepagedata[index].countSinceLastShared += 1;
    }

    if (Date.now() - searchStartTime > log.sampleComputeTime) {
        log.sampleComputeTime = Date.now() - searchStartTime;
        log.warning('log.sample', 'Compute time took ' + log.sampleComputeTime
             + ' ms for ' + log.samplepagedata.length + ' samples');
    }

    if (log.lastSampleSent + b.logging.shareSamplesEvery < Date.now()) {
        log.shareSamplesAndStats();
    }
};

var carousels = [
    //'welcome', 'featuredAlerts', 'departures', 'currentAlerts', 'upcomingAlerts', 'elevatorAlerts'
    //Welcome slide only
    {
        conditions: [
            {
                visualElements: ['featuredAlerts', 'departures', 'currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                areEmpty: true
            }
        ],
        slides: [
            {
                carouselId: 1,
                visualElements: ['welcome'],
                duration: 10
            }
        ]
    },
    //all information fits
    {
        conditions: [
            {
                visualElements: ['featuredAlerts', 'departures', 'currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                fitOnDisplay: true,
                areEmpty: false
            }
        ],
        slides: [
            {
                carouselId: 2,
                visualElements: ['featuredAlerts', 'departures', 'currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //featured on its own screen; all other information fits
    //featuredAlerts screen will be shown ONLY if there is content
    {
        conditions: [
            {
                visualElements: ['departures', 'currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                areEmpty: false,
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 3,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //departures remain on top; current & upcoming alerts below them, then elevator alerts below them
    {
        conditions: [
            {
                visualElements: ['departures', 'currentAlerts', 'upcomingAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures'],
                areEmpty: false
            },
            {
                visualElements: ['elevatorAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['currentAlerts', 'upcomingAlerts'],
                areEmpty: false
            }
        ],
        slides: [
            {
                carouselId: 4,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'currentAlerts', 'upcomingAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //departures remain on top; current, then upcoming, then elevator alerts below them
    {
        conditions: [
            {
                visualElements: ['departures'],
                areEmpty: false
            },
            {
                visualElements: ['elevatorAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['currentAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['upcomingAlerts'],
                areEmpty: false
            },

            {
                visualElements: ['departures', 'currentAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures', 'upcomingAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 5,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'currentAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'upcomingAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //departures remain on top; current, then upcoming below them (no elevator)
    {
        conditions: [
            {
                visualElements: ['departures'],
                areEmpty: false
            },
            {
                visualElements: ['elevatorAlerts'],
                areEmpty: true
            },
            {
                visualElements: ['currentAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['upcomingAlerts'],
                areEmpty: false
            },

            {
                visualElements: ['departures', 'currentAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures', 'upcomingAlerts'],
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 6,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'currentAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'upcomingAlerts'],
                duration: 10
            }
        ]
    },
    //departures remain on top; current, then elevator below them (no upcoming)
    {
        conditions: [
            {
                visualElements: ['departures'],
                areEmpty: false
            },
            {
                visualElements: ['elevatorAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['currentAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['upcomingAlerts'],
                areEmpty: true
            },

            {
                visualElements: ['departures', 'currentAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 7,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'currentAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //departures remain on top; upcoming, then elevator below them (no current)
    {
        conditions: [
            {
                visualElements: ['departures'],
                areEmpty: false
            },
            {
                visualElements: ['elevatorAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['currentAlerts'],
                areEmpty: true
            },
            {
                visualElements: ['upcomingAlerts'],
                areEmpty: false
            },

            {
                visualElements: ['departures', 'upcomingAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 8,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'upcomingAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //departures on one screen, all alerts on other screen
    {
        conditions: [
            {
                visualElements: ['currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 9,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures'],
                duration: 10
            },
            {
                visualElements: ['currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //departures on one screen with elevators, current / upcoming on next screen
    {
        conditions: [
            {
                visualElements: ['departures', 'elevatorAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['currentAlerts', 'upcomingAlerts'],
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 10,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                duration: 10
            },
            {
                visualElements: ['currentAlerts', 'upcomingAlerts'],
                duration: 10
            }
        ]
    },
    //departures on one screen, current / upcoming on next screen, elevators on last screen
    {
        conditions: [
            {
                visualElements: ['currentAlerts', 'upcomingAlerts'],
                fitOnDisplay: true
            },
        ],
        slides: [
            {
                carouselId: 11,
                visualElements: ['featuredAlerts'],
                duration: 8
            },
            {
                visualElements: ['departures'],
                duration: 8
            },
            {
                visualElements: ['currentAlerts', 'upcomingAlerts'],
                duration: 8
            },
            {
                visualElements: ['elevatorAlerts'],
                duration: 8
            }
        ]
    },
    //departures on one screen, current on next screen, upcoming / elevators on last screen
    {
        conditions: [
            {
                visualElements: ['upcomingAlerts', 'elevatorAlerts'],
                fitOnDisplay: true
            },
        ],
        slides: [
            {
                carouselId: 12,
                visualElements: ['featuredAlerts'],
                duration: 8
            },
            {
                visualElements: ['departures'],
                duration: 8
            },
            {
                visualElements: ['currentAlerts'],
                duration: 8
            },
            {
                visualElements: ['upcomingAlerts', 'elevatorAlerts'],
                duration: 8
            }
        ]
    },
    //everything on its own screen (no featured)
    {
        conditions: [
            {
                visualElements: ['featuredAlerts'],
                areEmpty: true
            }
        ],
        slides: [
            {
                carouselId: 13,
                visualElements: ['departures'],
                duration: 10
            },
            {
                visualElements: ['currentAlerts'],
                duration: 7
            },
            {
                visualElements: ['upcomingAlerts'],
                duration: 7
            },
            {
                visualElements: ['elevatorAlerts'],
                duration: 7
            }
        ]
    },
    //everything on its own screen (including featured)
    {
        conditions: [
            {
                visualElements: ['featuredAlerts'],
                areEmpty: false
            }
        ],
        slides: [
            {
                carouselId: 14,
                visualElements: ['featuredAlerts'],
                duration: 7
            },
            {
                visualElements: ['departures'],
                duration: 7
            },
            {
                visualElements: ['currentAlerts'],
                duration: 7
            },
            {
                visualElements: ['upcomingAlerts'],
                duration: 5
            },
            {
                visualElements: ['elevatorAlerts'],
                duration: 5
            }
        ]
    }
];

var Route = function (modeName, routeId, routeName, hide, color, sortOrder) {
    'use strict';
    this.modeName = modeName;
    this.routeId = routeId;
    this.routeName = routeName;
    this.hide = (hide === 'true');
    this.color = color;
    this.sortOrder = sortOrder;
};

var AlertBools = function () {
    'use strict';
    this.isService = false;
    this.isElevator = false;
    this.isSubway = false;
    this.isLocal = false;
    this.isCurrent = false;
    this.isSoon = false;
    this.isSevere = false;
    this.isSystemwide = false;
    this.isFeatured = false;
};

var Alert = function (alertId, affectedIds, affectedNames, affectedDirection, lifecycle, timeframeText, startTime, endTime, disruptionType, summary, description, formattedDescription, details, formattedDetails, alertBools) {
    'use strict';
    this.alertId = alertId;
    this.affectedIds = affectedIds;
    this.affectedNames = affectedNames;
    this.affectedDirection = affectedDirection;
    this.lifecycle = lifecycle;
    this.timeframeText = timeframeText;
    this.startTime = startTime;
    this.endTime = endTime;
    this.disruptionType = disruptionType;
    this.summary = summary;
    this.description = description;
    this.formattedDescription = formattedDescription;
    this.details = details  || '';
    this.formattedDetails = formattedDetails;
    this.isService = alertBools.isService;
    this.isElevator = alertBools.isElevator;
    this.isSubway = alertBools.isSubway;
    this.isLocal = alertBools.isLocal;
    this.isCurrent = alertBools.isCurrent;
    this.isSoon = alertBools.isSoon;
    this.isSevere = alertBools.isSevere;
    this.isSystemwide = alertBools.isSystemwide;
    this.isFeatured = alertBools.isFeatured;
};

var Departure = function (route, direction, tripId, destinationTitle, destinationSubtitle, scheduledTime, predictedTime) {
    'use strict';
    this.route = route;
    this.direction = direction;
    this.tripId = tripId;
    this.destinationTitle = destinationTitle;
    this.destinationSubtitle = destinationSubtitle;
    this.scheduledTime = scheduledTime || 0;
    this.predictedTime = predictedTime || 0;
    if (this.predictedTime === 0) {
        this.time = this.scheduledTime;
        this.isPrediction = false;
    } else {
        this.time = this.predictedTime;
        this.isPrediction = true;
    }
    this.isSoon = (Date.now() - 60000 < this.time && this.time < Date.now() + 5940000);
    this.minsAway = function () {
        return Math.max(Math.floor((this.time - Date.now()) / 60000), 0);
    };
    this.vocalize = function () {
        var text = '', minutes = this.minsAway();
        if (this.route.modeName === 'Bus') {
            text += 'Route ';
        }
        text += this.route.routeName.replace('/', ' ') + ' ' + this.destinationTitle + ', ';
        text += minutes + (minutes === 1 ? ' minute' : ' minutes');
        return text;
    };
};

var Datasource = function (dconfig) {
    'use strict';
    this.id = dconfig.id;
    this.format = dconfig.format;
    this.maxAge =  dconfig.maxAge;
    this.URL = dconfig.URL;
    this.isReady = false;
    this.lastUpdated = 0;
    this.data = {};
};

Datasource.prototype = {
    //Datasource.prototype handleUpdateError()
    //Logs a warning or error of update failing.
    //If data is now TWICE as old as it should be, remove it.
    handleUpdateError: function (e1, e2) {
        'use strict';
        if (this.lastUpdated + (this.maxAge * 2) < Date.now()) {
            log.error('Datasource.handleUpdateError',
                'Could not update. Data too old now. '
                + this.ident + ': ' + e1 + ' ' + e2);
            this.isReady = false;
            this.data = {};
        } else {
            log.warning('Datasource.handleUpdateError',
                'could not update. Will use old data. '
                + this.id + ': ' + e1 + '; ' + e2);
        }
    },
    //Datasource.prototype update_MBTA_realtime()
    //Updates a datasource with format MBTA-realtime.
    //Calls handleUpdateError if update fails.
    update_MBTA_realtime: function () {
        'use strict';
        var xhr = new XMLHttpRequest();
        xhr.open('GET', this.URL);
        xhr.onload = (function (datasource) {
            return function (e) {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        datasource.data = JSON.parse(xhr.responseText);
                        datasource.lastUpdated = Date.now();
                        datasource.isReady = true;
                    } else {
                        datasource.handleUpdateError(xhr.statusText, e);
                    }
                }
            };
        }(this));
        xhr.onerror = (function (datasource) {
            return function (e) {
                datasource.handleUpdateError('xhr.onerror', e);
            };
        }(this));
        xhr.send();
    },
    //Datasource.prototype update()
    //Updates the datasource.
    update: function (forceUpdate) {
        'use strict';
        try {
            if (forceUpdate || this.lastUpdated + this.maxAge < Date.now()) {
                switch (this.format) {
                case 'MBTA_realtime':
                    this.update_MBTA_realtime();
                    break;
                default:
                    log.criticalError('Datasource.update',
                        this.ident + ' has unsupported format ' + this.format);
                }
            }
        } catch (err) {
            log.warning('Datasource.update, ', err);
        }
    }
};

generators.defaultGenerator = function () {
    'use strict';
    log.warning('defaultGenerator', 'run instead of ' + this.generatorFunction);
    return this.data;
};

generators.objectsMatchATemplate = function () {
    'use strict';
    var i,
        source = f[this.requiredFacets.source].data,
        outputList = [];
    try {
        for (i = 0; i < source.length; i += 1) {
            if (source[i].matchesOneOf(this.parameters.templates)) {
                outputList.push(source[i]);
            }
        }
        return outputList;
    } catch (err) {
        log.error('generators.objectMatchATemplate', err);
        return [];
    }
};

generators.routesFromMBTARealtime = function () {
    'use strict';
    var i = 0,
        m,
        r,
        modes = d[this.requiredDatasources.MBTARealtimeRoutes].data.mode,
        newRoute,
        routeList = [],
        byId = {},
        byName = {},
        pickColor = function (modeName, routeName) {
            switch (routeName) {
            case 'Green Line':
                return '#33FF33';
            case 'Red Line':
            case 'Mattapan Trolley':
                return '#FF332C';
            case 'Blue Line':
//                return '#688ABE';return '#4040FF';
                return '#80AAFF';
            case 'Orange Line':
                return '#E87200';
            //case 'CT1':
            //case 'CT2':
            //case 'CT3':
            //    return '00FFFF';
            case 'SL1':
            case 'SL2':
            case 'SL3':
            case 'SL4':
            case 'SL5':
            case 'SL6':
            case 'Silver Line Waterfront':
                return '#D0D0FF';
            default:
                switch (modeName) {
                case 'Bus':
                    return '#FFFF7C';
                case 'Commuter Rail':
                    return '#F81EFF';
                case 'Boat':
                    return '#66CCFF';
                default:
                    return '#FFFFFF';
                }
            }
        };

    try {
        for (m = 0; m < modes.length; m += 1) {
            newRoute = new Route('Systemwide', 'mode_' + modes[m].mode_name,
                modes[m].mode_name, false, pickColor(modes[m].mode_name, ''), i);
            i += 1;
            routeList.push(newRoute);
        }
    } catch (err) {
        log.error('generators.routesFromMBTARealtime', '(mode loop 1) ' + err);
    }

    try {
        for (m = 0; m < modes.length; m += 1) {
            for (r = 0; r < modes[m].route.length; r += 1) {
                newRoute = new Route(modes[m].mode_name, modes[m].route[r].route_id,
                        modes[m].route[r].route_name, modes[m].route[r].route_hide,
                        pickColor(modes[m].mode_name, modes[m].route[r].route_name),
                        i);
                i += 1;
                routeList.push(newRoute);
            }
        }
    } catch (err) {
        log.error('generators.routesFromMBTARealtime', '(mode loop 2) ' + err);
    }

    for (r = 0; r < routeList.length; r += 1) {
        byId[routeList[r].routeId] = routeList[r];
        byName[routeList[r].routeName] = routeList[r];
    }
    return {list: routeList, byId: byId, byName: byName};
};

generators.alertsFromMBTARealtime = function () {
    'use strict';
    var i,
        j,
        source = d[this.requiredDatasources.mbtaRealtimeAlerts].data.alerts,
        localRoutes = f[this.requiredFacets.localRoutes].data,
        agencyRoutes = f[this.requiredFacets.agencyRoutes].data,
        newAlerts = [],
        affectedIds,
        affectedNames,
        affectedDirection,
        bools,
        startTime,
        endTime,
        formattedDescription,
        formattedDetails,
        newAffectedId,
        newAffectedName,
        bannerExists = false;
    for (i = 0; i < source.length; i += 1) {
        try {
            if (source[i].hasOwnProperty('banner_text')) {
                bannerExists = true;

                affectedIds = [];
                affectedNames = [];
                affectedDirection = '';
                bools = new AlertBools();
                bools.isFeatured = true;

                for (j = 0; j < source[i].affected_services.services.length; j += 1) {
                    if (source[i].affected_services.services[j].hasOwnProperty('route_id')) {
                        newAffectedId = source[i].affected_services.services[j].route_id;
                        newAffectedName = source[i].affected_services.services[j].route_name;
                    } else {
                        newAffectedId = 'mode_' + source[i].affected_services.services[j].mode_name;
                        newAffectedName = source[i].affected_services.services[j].mode_name;
                    }
                    affectedIds.pushUnique(newAffectedId);
                    affectedNames.pushUnique(newAffectedName);
                }

                if (source[i].effect_periods.length > 0) {
                    startTime = source[i].effect_periods[0].effect_start * 1000;
                    endTime = source[i].effect_periods[source[i].effect_periods.length - 1].effect_end * 1000;
                } else {
                    startTime = Date(0);
                    endTime = Date(0);
                }

                if (source[i].alert_lifecycle === 'New') {
                    bools.isCurrent = true;
                } else if (source[i].alert_lifecycle === 'Upcoming' && startTime < Date.now() + 604800000) {
                    bools.isSoon = true;
                }
                if (source[i].severity === 'Severe') {bools.isSevere = true; }

                formattedDescription = source[i].banner_text;

                for (j = affectedNames.length - 1; j >= 0; j -= 1) {
                    if (agencyRoutes.byName.hasOwnProperty(affectedNames[j])) {
                        formattedDescription = formattedDescription.replace(new RegExp(affectedNames[j], 'gi'),
                                '<span style="color:' + agencyRoutes.byName[affectedNames[j]].color
                                + '">' + affectedNames[j] + '</span>');
                    }
                }
                formattedDescription = formattedDescription.replace(/[w\.]{0,4}mbta\.com\/[\w\/-_\.]{10,}/, 'mbta.com');
                newAlerts.push(new Alert('banner_' + source[i].alert_id, affectedIds, affectedNames,
                    affectedDirection, source[i].alert_lifecycle, source[i].timeframe_text, startTime,
                    endTime, source[i].effect_name, source[i].service_effect_text,
                    source[i].banner_text, formattedDescription, '', '', bools));
            }
        } catch (err) {
            log.warning('generators.alertsFromMBTARealtime', 'could not parse banner alert, ' + err);
        }
    }
    for (i = 0; i < source.length; i += 1) {
        try {
            affectedIds = [];
            affectedNames = [];
            affectedDirection = '';
            bools = new AlertBools();
            bools.isService = (source[i].affected_services.services.length > 0);
            if (bools.isService) {
                for (j = 0; j < source[i].affected_services.services.length; j += 1) {
                    if (source[i].affected_services.services[j].hasOwnProperty('route_id')) {
                        newAffectedId = source[i].affected_services.services[j].route_id;
                        newAffectedName = source[i].affected_services.services[j].route_name;
                        if (source[i].affected_services.services[j].hasOwnProperty('direction_name') &&
                                affectedDirection !== 'both') {
                            if (affectedDirection === '') {
                                affectedDirection = source[i].affected_services.services[j].direction_name;
                            } else if (affectedDirection !== source[i].affected_services.services[j].direction_name) {
                                affectedDirection = 'both';
                            }
                        }
                    } else {
                        bools.isSystemwide = true;
                        newAffectedId = 'mode_' + source[i].affected_services.services[j].mode_name;
                        newAffectedName = source[i].affected_services.services[j].mode_name;
                    }
                    affectedIds.pushUnique(newAffectedId);
                    affectedNames.pushUnique(newAffectedName);
                    if (localRoutes.byName.hasOwnProperty(newAffectedName)) {
                        bools.isLocal = true;
                    }
                    if (source[i].affected_services.services[j].mode_name === 'Subway') {
                        bools.isSubway = true;
                    }
                }
            } else {
                for (j = 0; j < source[i].affected_services.elevators.length; j += 1) {
                    if (source[i].affected_services.elevators[j].elev_type === 'Elevator') {
                        bools.isElevator = true;
                    }
                    if (source[i].affected_services.elevators[j].stops.length > 0) {
                        if (source[i].affected_services.elevators[j].stops[0].hasOwnProperty('parent_station_name')) {
                            affectedNames.pushUnique(source[i].affected_services.elevators[j].stops[0].parent_station_name);
                        } else if (source[i].affected_services.elevators[j].stops[0].hasOwnProperty('stop_name')) {
                            affectedNames.pushUnique(source[i].affected_services.elevators[j].stops[0].stop_name);
                        }
                    } else {
                        affectedNames.pushUnique(source[i].affected_services.elevators[j].elev_name);
                    }
                    affectedIds.pushUnique('access_' + source[i].affected_services.elevators[j].elev_id);
                }
            }
            if (source[i].effect_periods.length > 0) {
                startTime = source[i].effect_periods[0].effect_start * 1000;
                endTime = source[i].effect_periods[source[i].effect_periods.length - 1].effect_end * 1000;
            } else {
                startTime = Date(0);
                endTime = Date(0);
            }

            if (source[i].alert_lifecycle === 'New') {
                bools.isCurrent = true;
            } else if (source[i].alert_lifecycle === 'Upcoming' && startTime < Date.now() + 604800000) {
                bools.isSoon = true;
            }
            if (source[i].severity === 'Severe') {bools.isSevere = true; }
            if (!bannerExists) {
                bools.isFeatured = (bools.isSubway && bools.isLocal && bools.isCurrent && bools.isSevere);
            }
            formattedDescription = source[i].header_text;
            if (source[i].hasOwnProperty('description_text')) {
                formattedDetails = source[i].description_text.replace(/(\r\n|\n|\r)/gm, '<br>');
                formattedDetails = formattedDetails.replace(/<br><br>/gm, '<p>');
            } else {
                formattedDetails = '';
            }
            for (j = affectedNames.length - 1; j >= 0; j -= 1) {
                if (agencyRoutes.byName.hasOwnProperty(affectedNames[j])) {
                    formattedDescription = formattedDescription.replace(new RegExp(affectedNames[j], 'gi'),
                            '<span style="color:' + agencyRoutes.byName[affectedNames[j]].color
                            + '">' + affectedNames[j] + '</span>');
                }
            }

            newAlerts.push(new Alert(source[i].alert_id, affectedIds, affectedNames, affectedDirection,
                source[i].alert_lifecycle, source[i].timeframe_text, startTime, endTime,
                source[i].effect_name, source[i].service_effect_text,
                source[i].header_text, formattedDescription, source[i].description_text,
                formattedDetails, bools));

        } catch (err) {
            log.warning('generators.alertsFromMBTARealtime', 'could not parse a alert');
        }
    }

    return newAlerts;
};

generators.extractCurrentServiceAlertsCombiningDelaysAndSort = function () {
    'use strict';
    var i,
        a = f[this.requiredFacets.alerts].data,
        r = f[this.requiredFacets.routes].data,
        alertsOut = [],
        delayAlerts = [],
        createCombinedDelayAlert = function (alerts) {
            var j,
                k,
                delayedRoutes = {},
                delayedRouteList = [],
                busDelays = 0,
                otherDelays = 0,
                remainingDelays,
                description,
                formattedDescription,
                formatDelay = function (delay) {
                    if (delay.affectedDirection === 'both'
                            || delay.affectedDirection === '') {
                        if (delay.isSevere) {
                            return (delay.routeName + ' (severe)');
                        } // else
                        return delay.routeName;
                    } //else
                    if (delay.isSevere) {
                        return (delay.routeName + ' (' + delay.affectedDirection + ', severe)');
                    } //else
                    return (delay.routeName + ' (' + delay.affectedDirection + ')');
                };
            //Cycle through each alerts' each route name.
            //For each one, if it doesn't exist, add it;
            //If it does exist, modify as needed.
            //Then export to an array and sort by sortOrder.
            //Finally craft the text of the alert and return it. 
            try {
                for (j = 0; j < alerts.length; j += 1) {
                    for (k = 0; k < alerts[j].affectedNames.length; k += 1) {
                        if (!r.byName[alerts[j].affectedNames[k]].hide) {
                            if (!delayedRoutes.hasOwnProperty(alerts[j].affectedNames[k])) {
                                delayedRoutes[alerts[j].affectedNames[k]] = r.byName[alerts[j].affectedNames[k]];
                                delayedRoutes[alerts[j].affectedNames[k]].affectedDirection = alerts[j].affectedDirection;
                                delayedRoutes[alerts[j].affectedNames[k]].isSevere = alerts[j].isSevere;
                                if (delayedRoutes[alerts[j].affectedNames[k]].modeName === 'Bus') {
                                    busDelays += 1;
                                } else {otherDelays += 1; }
                            } else {
                                if (alerts[j].isSevere) {delayedRoutes[alerts[j].affectedNames[k]].isSevere = true; }
                                if (delayedRoutes[alerts[j].affectedNames[k]].affectedDirection !== alerts[j].affectedDirection) {
                                    delayedRoutes[alerts[j].affectedNames[k]].affectedDirection = 'both';
                                }
                            }
                        }
                    }
                }

                for (j in delayedRoutes) {
                    if (delayedRoutes.hasOwnProperty(j)) {
                        delayedRouteList.push(delayedRoutes[j]);
                    }
                }
                delayedRouteList.sort(function (a, b) {return a.sortOrder - b.sortOrder; });

                description = 'Delays on ';
                formattedDescription = 'Delays on ';
                if (otherDelays > 0) {
                    description += 'the ';
                    formattedDescription += 'the ';
                    remainingDelays = otherDelays + ((busDelays > 0) ? 1 : 0);
                    for (j = 0; j < delayedRouteList.length; j += 1) {
                        if (delayedRouteList[j].modeName !== 'Bus') {
                            remainingDelays -= 1;
                            formattedDescription += '<span style="color:' + delayedRouteList[j].color + '">';
                            switch (remainingDelays) {
                            case 0:
                                description += formatDelay(delayedRouteList[j]);
                                formattedDescription += formatDelay(delayedRouteList[j]) + '</span>';
                                break;
                            case 1:
                                description += formatDelay(delayedRouteList[j]) + ' and ';
                                formattedDescription += formatDelay(delayedRouteList[j]) + '</span> and ';
                                break;
                            default:
                                description += formatDelay(delayedRouteList[j]) + ', ';
                                formattedDescription += formatDelay(delayedRouteList[j]) + '</span>, ';
                                break;
                            }
                        }
                    }
                }

                if (busDelays > 0) {
                    description += (busDelays === 1) ? 'route ' : 'routes ';
                    formattedDescription += (busDelays === 1) ? 'route ' : 'routes ';
    //resume
                    remainingDelays = busDelays;
                    for (j = 0; j < delayedRouteList.length; j += 1) {
                        if (delayedRouteList[j].modeName === 'Bus') {
                            remainingDelays -= 1;
                            formattedDescription += '<span style="color:' + delayedRouteList[j].color + '">';
                            switch (remainingDelays) {
                            case 0:
                                description +=  formatDelay(delayedRouteList[j]);
                                formattedDescription +=  formatDelay(delayedRouteList[j]) + '</span>';
                                break;
                            case 1:
                                description += formatDelay(delayedRouteList[j]) + ' and ';
                                formattedDescription += formatDelay(delayedRouteList[j]) + '</span> and ';
                                break;
                            default:
                                description += formatDelay(delayedRouteList[j]) + ', ';
                                formattedDescription += formatDelay(delayedRouteList[j]) + '</span>, ';
                                break;
                            }
                        }
                    }
                }

                return new Alert(0, [], [], '', 'New', '', 0, 0, 'Delays', '', description, formattedDescription, '', '', new AlertBools());
            } catch (err) {
                log.warning('generators.extractCurrentServiceAlertsCombiningDelaysAndSort', '(Could not create delayed route list)' + err);
                return new Alert(0, [], [], '', 'New', '', 0, 0, 'Delays', '', 'Visit our website for more information.', 'Visit our website for more information.', '', '', new AlertBools());
            }
        };

    try {
        // 1. extract current service alerts into delay and non-delay categores. 
        for (i = 0; i < a.length; i += 1) {
            if (a[i].isService === true && a[i].isCurrent === true &&
                    (a[i].isLocal === true || a[i].isSubway === true)) {
                if (a[i].disruptionType === 'Delay' && a[i].isSystemwide === false
                        && (a[i].isLocal === false || a[i].isSubway === false)) {
                    delayAlerts.push(a[i]);
                } else {
                    alertsOut.push(a[i]);
                }
            }
        }

        // 2. sort the non-delay alerts.  
        alertsOut.sort(function (a, b) {return r.byId[a.affectedIds[0]].sortOrder - r.byId[b.affectedIds[0]].sortOrder; });

        // 3. combine the delay alerts into one new alert and append it.
        if (delayAlerts.length > 0) {
            alertsOut.push(createCombinedDelayAlert(delayAlerts));
        }

        return alertsOut;
    } catch (err) {
        log.error('generators.extractCurrentServiceAlertsCombiningDelaysAndSort', err);
        return [];
    }
};

generators.extractUpcomingServiceAlertsAndSort = function () {
    'use strict';
    var i,
        alertsOut = [],
        a = f[this.requiredFacets.alerts].data,
        r = f[this.requiredFacets.routes].data;

    try {
        for (i = 0; i < a.length; i += 1) {
            if (a[i].matchesOneOf([{isLocal: true, isSoon: true}, {isSubway: true, isSoon: true}])) {
                alertsOut.push(a[i]);
            }
        }
        alertsOut.sort(function (a, b) {
            if (a.startTime !== b.startTime) {return a.startTime - b.startTime; }
            if (a.endTime !== b.endTime) {return a.endTime - b.endTime; }
            return r.byId[a.affectedIds[0]].sortOrder - r.byId[b.affectedIds[0]].sortOrder;
        });
        return alertsOut;
    } catch (err) {
        log.error('generators.extractUpcomingServiceAlertsAndSort', err);
        return [];
    }
};

generators.extractElevatorAlertsAndSort = function () {
    'use strict';
    var i,
        a = f[this.requiredFacets.alerts].data,
        alertsOut = [];

    try {
        for (i = 0; i < a.length; i += 1) {
            if (a[i].isElevator) {
                alertsOut.push(a[i]);
            }
        }
        alertsOut.sort(function (a, b) {
            if (a.affectedNames[0] < b.affectedNames[0]) {return -1; }
            if (a.affectedNames[0] > b.affectedNames[0]) {return 1; }
            return 0;
        });
        return alertsOut;
    } catch (err) {
        log.error('generators.extractElevatorAlertsAndSort', err);
        return [];
    }
};

generators.departuresFromMBTARealtime = function () {
    'use strict';
    var i, j, k, l,
        m = d[this.requiredDatasources.MBTARealtimeTimes].data.mode,
        r = f[this.requiredFacets.routes].data,
        departures = [],
        destination = {
            title: '',
            subtitle: ''
        },
        destinationFilter = false,
        deriveDestination = function (modeName, routeName, direction, stoptime) {
            var dest = {title: '', subtitle: '' },
                testVia = /\svia\s/,
                getBeforeVia = /\svia\s[\W\w]+$/,
                getAfterVia = /^[\W\w]+\svia\s/,
                testParens = /\(/,
                getBeforeParens = /\([\W\w]+$/,
                getAfterParens = /^[\W\w]+\(/,
                getAfterTo = /^[\W\w]+\sto\s/,
                getBeforeSpace = /\s[\W\w]+$/;
            try {
                if (modeName !== 'Commuter Rail') {
                    if (stoptime.hasOwnProperty('trip_headsign')) {
                        if (testVia.test(stoptime.trip_headsign)) {
                            //Non-commuter rail, has headsign with "via"
                            dest.title = stoptime.trip_headsign.replace(getBeforeVia, '');
                            dest.subtitle = stoptime.trip_headsign.replace(getAfterVia, 'via ');
                            return dest;
                        }
                        if (testParens.test(stoptime.trip_headsign)) {
                            //Non-commuter rail, has headsign with "()"
                            dest.title = stoptime.trip_headsign.replace(getBeforeParens, '');
                            dest.subtitle = stoptime.trip_headsign.replace(getAfterParens, '(');
                            return dest;
                        }
                        //Non-commuter rail, one-line destination
                        dest.title = stoptime.trip_headsign;
                        return dest;
                    }
                    //Non-commter rail, no headsign text
                    dest.title = stoptime.trip_name.replace(getAfterTo, '');
                    return dest;
                }
                if (stoptime.hasOwnProperty('trip_headsign')) {
                    //commuter rail, with headsign
                    dest.title = stoptime.trip_headsign;
                    dest.subtitle = 'Train ' + stoptime.trip_name.replace(getBeforeSpace, '');
                    return dest;
                }
                if (direction === 'Outbound') {
                    //commuter rail, outbound, no headsign
                    dest.title = 'Outbound';
                    dest.subtitle = routeName;
                    return dest;
                }
                //commuter rail, inbound, no headsign
                dest.title = 'South Station'; //FURTHER WORK this only works on the south side. 
                return dest;
            } catch (err) {
                log.warning('departuresFromMBTARealtime', '(could not derive destination) ' + err);
                return {title: direction, subtitle: '' };
            }
        };

    if (this.hasOwnProperty('parameters') && this.parameters.hasOwnProperty('destinationFilter')) {
        destinationFilter = this.parameters.destinationFilter;
    }

    //cycle through mode - route - direction - trip
    for (i = 0; i < m.length; i += 1) {
        for (j = 0; j < m[i].route.length; j += 1) {
            for (k = 0; k < m[i].route[j].direction.length; k += 1) {
                for (l = 0; l < m[i].route[j].direction[k].trip.length; l += 1) {
                    try {
                        //generate "destinationTitle" and "destinationSubtitle"
                        destination = deriveDestination(m[i].mode_name, m[i].route[j].route_name, m[i].route[j].direction[k].direction_name, m[i].route[j].direction[k].trip[l]);
                        //if this is not an arrival
                        if (!(destinationFilter && destinationFilter.test(destination.title))) {
                            //if (!m[i].route[j].direction[k].trip[l].hasOwnProperty('pre_dt')) {destination.subtitle = 'Time shown is based on schedule'; }
                            departures.push(new Departure(r.byId[m[i].route[j].route_id],
                                m[i].route[j].direction[k].direction_name,
                                m[i].route[j].direction[k].trip[l].trip_id,
                                destination.title, destination.subtitle,
                                m[i].route[j].direction[k].trip[l].sch_dep_dt * 1000,
                                m[i].route[j].direction[k].trip[l].pre_dt * 1000));
                        }
                    } catch (err) {
                        log.warning('generators.departuresFromMBTARealtime', '(could not parse a departure) ' + err);
                    }
                }
            }
        }
    }
    return departures;
};

generators.append = function () {
    'use strict';
    var i,
        one = f[this.requiredFacets.one].data,
        two = f[this.requiredFacets.two].data,
        both = [];

    try {
        for (i = 0; i < one.length; i += 1) {
            both.push(one[i]);
        }

        for (i = 0; i < two.length; i += 1) {
            both.push(two[i]);
        }

        return both;
    } catch (err) {
        log.error('generators.append', err);
        return one;
    }
};

generators.nextDeparturesFromDepartures = function () {
    'use strict';
    var groupId, //so we can find the next bus route-direction, the next CR direction-destination, the next subway route-destination, etc.
        i,
        j,
        deps = f[this.requiredFacets.departures].data,
        depCandidate,
        depSubSort, //so we can sort subway by route name, commuter rail by direction, bus by route sortorder, etc. 
        nextDeps = [],
        //r = f[this.requiredFacets.routes].data,
        routeDirHasPrediction = {},
        serviceGroup = {};

    try {
        //identify route-directions that have predictions
        for (i = 0; i < deps.length; i += 1) {
            if (deps[i].isPrediction && deps[i].isSoon) {
                routeDirHasPrediction[deps[i].route.routeName + deps[i].direction] = true;
            }
        }

        //put into groups by groupId. Exclude any scheduled departures if that route-dir has real-time deps. 
        for (i = 0; i < deps.length; i += 1) {
            if (deps[i].isSoon) {
                if (deps[i].isPrediction ||
                        !routeDirHasPrediction.hasOwnProperty(deps[i].route.routeName + deps[i].direction)) {
                    switch (deps[i].route.modeName) {
                    case 'Commuter Rail':
                        groupId = 'Rail' + deps[i].direction + deps[i].destinationTitle;
                        depSubSort = deps[i].direction + deps[i].destinationTitle;
                        break;
                    case 'Subway':
                        groupId = deps[i].route.routeName + deps[i].direction + deps[i].destinationTitle;
                        depSubSort = deps[i].route.routeName + deps[i].direction;
                        break;
                    default:
                        groupId = deps[i].route.routeName + deps[i].direction;
                        depSubSort = deps[i].route.sortOrder;
                    }
                    deps[i].groupId = groupId; //FUTURE WORK alter this so it's not making changes to deps (which is going back and affecting the source data)
                    deps[i].depSubSort = depSubSort;
                    if (!serviceGroup.hasOwnProperty(groupId)) {serviceGroup[groupId] = []; }
                    serviceGroup[groupId].push(deps[i]);
                }
            }
        }

        //find the "next" for each groupId
        try {
            for (i in serviceGroup) {
                if (serviceGroup.hasOwnProperty(i)) {
                    depCandidate = 'none';
                    for (j = 0; j < serviceGroup[i].length; j += 1) {
                        if ((depCandidate === 'none') ||
                                (serviceGroup[i][j].isPrediction &&
                                    (!depCandidate.isPrediction || serviceGroup[i][j].time < depCandidate.time)) ||
                                (!serviceGroup[i][j].isPrediction &&
                                    (!depCandidate.isPrediction && serviceGroup[i][j].time < depCandidate.time))) {
                            depCandidate = serviceGroup[i][j];
                        }
                    }
                    nextDeps.push(depCandidate);
                }
            }
        } catch (err) {
            log.warning('generators.nextDeparturesFromDepartures', '(could not find next departure of a groupId)' + err);
        }

        //order the results
        nextDeps.sort(function (a, b) {
            //if the modes are different use routesortorder.
            //if the modes are the same use depSubSort.
            //if depSubSort is the same use direction. 
            //if direction is the same use time. 
            if (a.route.modeName !== b.route.modeName) {return a.route.sortOrder - b.route.sortOrder; }
            if (a.depSubSort !== b.depSubSort) {
                if (a.depSubSort < b.depSubSort) {return -1; }
                if (a.depSubSort > b.depSubSort) {return 1; }
                return 0;
            }
            if (a.direction !== b.direction) {
                if (a.direction < b.direction) {return -1; }
                if (a.direction > b.direction) {return 1; }
                return 0;
            }
            return a.time - b.time;
        });

        return nextDeps;
    } catch (err) {
        log.error('generators.nextDeparturesFromDepartures', err);
        return [];
    }
};

visualizers.defaultVisualizer = function () {
    'use strict';
    log.warning('visualizers.defaultVisualizer', 'defaultVisualizer was run.');
    return '';
};

vocalizers.defaultVocalizer = function () {
    'use strict';
    log.warning('vocalizers.defaultVocalizer', 'defaultVocalizer was run.');
    return [];
};


visualizers.static = function () {
    'use strict';
    return this.parameters.text;
};

vocalizers.static = function () {
    'use strict';
    return [];
};

visualizers.alerts = function () {
    'use strict';
    var i,
        a = f[this.requiredFacets.alerts].data,
        title = this.parameters.title,
        content = '';

    try {
        if (!a.hasOwnProperty('length') || a.length === 0) { return ''; }

        content = '<div class="' + title.format + '">' + title.text
                + '</div>';

        for (i = 0; i < a.length; i += 1) {
            content += '<div class="alert">';
            if (a[i].isSoon) {
                content += '<div class="AlertTimeframe">' + a[i].timeframeText.cap() + '</div>: ';
            }

            content +=  a[i].formattedDescription + '</div>';
        }

        return content;
    } catch (err) {
        log.error('visualizers.alerts', err);
        return '';
    }
};

vocalizers.alerts = function () {
    'use strict';
    var i,
        a = f[this.requiredFacets.alerts].data,
        title = this.parameters.title,
        content = [];

    try {
        if (!a.hasOwnProperty('length') || a.length === 0) { return []; }

        content.push(title.text);

        for (i = 0; i < a.length; i += 1) {
            content.push(a[i].description);
        }
        return content;
    } catch (err) {
        log.error('vocalizers.alerts', err);
        return [];
    }
};


visualizers.featuredAlerts = function () {
    'use strict';
    var i,
        a = f[this.requiredFacets.alerts].data,
        title = this.parameters.title,
        content = '';

    try {
        if (!a.hasOwnProperty('length') || a.length === 0) { return ''; }

        content = '<div class="' + title.format + '">' + title.text
                + '</div>';

        for (i = 0; i < a.length; i += 1) {
            content += '<div class="featuredAlert" id="featuredAlert_' + i + '">';
            content += '<div class="featuredAlertDescription"><p>';
            content +=  a[i].formattedDescription + '</div>';
            content += '<div class="featuredAlertDetails">';
            content +=  a[i].formattedDetails + '</div></div>';
        }

        return content;
    } catch (err) {
        log.error('visualizers.featuredAlerts', err);
        return '';
    }
};

vocalizers.featuredAlerts = function () {
    'use strict';
    var i,
        a = f[this.requiredFacets.alerts].data,
        title = this.parameters.title,
        content = [];

    try {
        if (!a.hasOwnProperty('length') || a.length === 0) { return []; }

        content.push(title.text + '.');

        for (i = 0; i < a.length; i += 1) {
            content.push(a[i].description);
        }
        return content;
    } catch (err) {
        log.error('vocalizers.featuredAlerts', err);
        return [];
    }

};


visualizers.departures = function () {
    'use strict';
    var i,
        d = f[this.requiredFacets.departures].data,
        title = this.parameters.title,
        content = '',
        formatDeparture = function (d) {
            var row = '', mins;
            mins = d.minsAway();
            //row += '<span style="color:' + d.route.color + '">';
            row += '<tr class="' + d.route.modeName + '" style="color:' + d.route.color + '">';
            if (d.route.modeName === 'Subway') {
                row += '<td class="route">' + d.route.routeName.split(' ')[0] + '</td>' +
                        '<td class="destination">' + d.destinationTitle + '<br>' + '<span class="destinationSubtitle">' + d.destinationSubtitle + '</span></td>' +
                        '<td class="minutes_away">' + mins + '</td>';
            } else if (d.route.modeName === 'Bus') {
                row += '<td class="route">' + d.route.routeName + '</td>' +
                        '<td class="destination">' + d.destinationTitle + '<br>' + '<span class="destinationSubtitle">' + d.destinationSubtitle + '</span></td>' +
                        '<td class="minutes_away">' + mins + '</td>';
            } else if (d.route.modeName === 'Commuter Rail') {
                row += '<td class="route">' + 'Rail' + '</td>' +
                    '<td class="destination">' + d.destinationTitle + '<br>' + '<span class="destinationSubtitle">' + d.destinationSubtitle + '</span></td>' +
                    '<td class="minutes_away">' + mins + '</td>';
            } else {
                row += '<td class="route">' + '</td>' +
                    '<td class="destination">' + d.destinationTitle + '<br>' + '<span class="destinationSubtitle">' + d.destinationSubtitle + '</span></td>' +
                    '<td class="minutes_away">' + mins + '</td>';
            }
            row += '</tr>';
            return row;
        };

    if (!d.hasOwnProperty('length') || d.length === 0) { return ''; }

    try {
        content = '<div class="' + title.format + '">' + title.text
                + '</div>';

        content += '<table id="departurestable">' + '<tr><th class="route">Route</th><th class="destination">Destination</th><th class="minutes_away">Mins</th></tr>';

        for (i = 0; i < d.length; i += 1) {
            content += formatDeparture(d[i]);
        }

        this.pendingpagecontent += '</table>';

        return content;
    } catch (err) {
        log.error('visualizers.departures', err);
        return '';
    }
};

vocalizers.departures = function () {
    'use strict';
    var i,
        d = f[this.requiredFacets.departures].data,
        title = this.parameters.title,
        content = [];

    if (!d.hasOwnProperty('length') || d.length === 0) { return ''; }

    try {
        content.push(title.text + ':');

        for (i = 0; i < d.length; i += 1) {
            content.push(d[i].vocalize());
        }

        return content;
    } catch (err) {
        log.error('vocalizers.departures', err);
        return [];
    }
};

var Facet = function (fconfig) {
    'use strict';
    try {
        this.generatorFunction = fconfig.generatorFunction;
        this.alwaysUpdate = fconfig.alwaysUpdate;
        this.requiredDatasources = fconfig.requiredDatasources || {};
        this.requiredFacets = fconfig.requiredFacets  || {};
        this.parameters = fconfig.parameters  || {};

        if (generators[this.generatorFunction] === undefined) {
            log.criticalError('Facet', 'unknown generator ' + fconfig.generatorFunction);
            this.generate = generators.defaultGenerator;
        } else {
            this.generate = generators[this.generatorFunction];
        }
        this.data = {};
        this.isReady = false;
        this.lastUpdated = new Date(0);
    } catch (err) {
        log.error('Facet', err);
    }
};

Facet.prototype = {
    //Updates the aspect.
    update: function (forceUpdate) {
        'use strict';
        var i,
            willUpdate = forceUpdate || this.alwaysUpdate,
            dependentsReady = true;

        try {
            for (i in this.requiredDatasources) {
                if (this.requiredDatasources.hasOwnProperty(i)) {
                    if (d[this.requiredDatasources[i]].lastUpdated > this.lastUpdated) {
                        willUpdate = true;
                    }
                    if (!d[this.requiredDatasources[i]].isReady) {
                        dependentsReady = false;
                        log.info('Facet.update', d[this.requiredDatasources[i]].id + ' not ready');
                    }
                }
            }

            for (i in this.requiredFacets) {
                if (this.requiredFacets.hasOwnProperty(i)) {
                    if (f[this.requiredFacets[i]].lastUpdated > this.lastUpdated) {
                        willUpdate = true;
                    }
                    if (!f[this.requiredFacets[i]].isReady) {
                        dependentsReady = false;
                    }
                }
            }
        } catch (err) {
            log.warning('Facet', '(could not update) ' + err);
            dependentsReady = false;
        }

        if (dependentsReady) {
            if (willUpdate) {
                try {
                    this.data = {};
                    this.data = this.generate();
                    this.isReady = true;
                    this.lastUpdated = Date.now();
                } catch (err) {
                    log.error('Facet', err);
                    this.isReady = false;
                    this.data = {};
                }
            }
        } else {
            this.isReady = false;
            this.data = {};
        }
    }
};

var VisualElement = function (vconfig) {
    'use strict';
    try {
        this.visualizer = vconfig.visualizer;
        this.div = vconfig.div;
        this.div_render = vconfig.div + '_render';
        this.requiredFacets = vconfig.requiredFacets  || {};
        this.parameters = vconfig.parameters  || {};

        if (visualizers[this.visualizer] === undefined) {
            log.criticalError('VisualElement', 'Unknown visualizer ' + this.visualizer);
            this.visualize = visualizers.defaultVisualizer;
        } else {
            this.visualize = visualizers[this.visualizer];
        }
        if (vocalizers[this.visualizer] === undefined) {
            log.criticalError('VisualElement', 'Unknown vocalizer ' + this.visualizer);
            this.vocalize = vocalizers.defaultVocalizer;
        } else {
            this.vocalize = vocalizers[this.visualizer];
        }



        this.lastUpdated = new Date(0);
        this.content = '';
        this.hasContent = false;
        this.height = 0;
        this.fontSize = 100;
    } catch (err) {
        log.error('VisualElement, ' + err);
    }
};

VisualElement.prototype = {
    render: function () {
        'use strict';
        var fontSize = 100, screenHeight;

        try {
            screenHeight = window.innerHeight;
            this.content = this.visualize();
            document.getElementById(this.div_render).innerHTML = this.content;
            document.getElementById(this.div_render).style.display = 'block';
            document.getElementById(this.div_render).style.fontSize = fontSize + '%';

            while (screenHeight < document.getElementById(this.div_render).offsetHeight && fontSize > 0) {
                fontSize -= 1;
                document.getElementById(this.div_render).style.fontSize = fontSize + '%';
            }

            this.height = document.getElementById(this.div_render).offsetHeight;
            this.fontSize = fontSize;
            this.hasContent = (this.content !== '');
            document.getElementById(this.div_render).style.display = 'none';
        } catch (err) {
            log.warning('VisualElement', err);
            this.hasContent = false;
            document.getElementById(this.div_render).style.display = 'none';
        }
    },
    moveContentToPage: function () {
        'use strict';
        try {
            document.getElementById(this.div).innerHTML = this.content;
            document.getElementById(this.div).style.fontSize = this.fontSize + '%';
        } catch (err) {
            log.warning('VisualElement.moveContentToPage', err);
        }
    },
    show: function () {
        'use strict';
        try {
            document.getElementById(this.div).style.display = 'block';
        } catch (err) {
            log.warning('VisualElement.show', err);
        }
    },
    hide: function () {
        'use strict';
        try {
            document.getElementById(this.div).style.display = 'none';
        } catch (err) {
            log.warning('VisualElement.hide', err);
        }
    },
    showOrHide: function (show) {
        'use strict';
        if (show) { this.show(); } else { this.hide(); }
    },
    showIfHasContent: function () {
        'use strict';
        this.showOrHide(this.hasContent);
    }
};

var speechUtteranceChunker = function (utt, settings, callback) {
    'use strict';
    var newUtt, txt, chunk, x, chunkLength, pattRegex, chunkArr;
    settings = settings || {};
    txt = (settings && settings.offset !== undefined ? utt.text.substring(settings.offset) : utt.text);
    if (utt.voice && utt.voice.voiceURI === 'native') { // Not part of the spec
        newUtt = utt;
        newUtt.text = txt;
        newUtt.addEventListener('end', function () {
            if (speechUtteranceChunker.cancel) {
                speechUtteranceChunker.cancel = false;
            }
            if (callback !== undefined) {
                callback();
            }
        });
    } else {
        chunkLength = (settings && settings.chunkLength) || 160;
        pattRegex = new RegExp('^[\\s\\S]{' + Math.floor(chunkLength / 2) + ',' + chunkLength + '}[.!?,]{1}|^[\\s\\S]{1,' + chunkLength + '}$|^[\\s\\S]{1,' + chunkLength + '} ');
        chunkArr = txt.match(pattRegex);

        if (chunkArr[0] === undefined || chunkArr[0].length <= 2) {
            //call once all text has been spoken...
            if (callback !== undefined) {
                callback();
            }
            return;
        }
        chunk = chunkArr[0];
        newUtt = new SpeechSynthesisUtterance(chunk);
        for (x in utt) {
            if (utt.hasOwnProperty(x) && x !== 'text') {
                newUtt[x] = utt[x];
            }
        }
        newUtt.addEventListener('end', function () {
            if (speechUtteranceChunker.cancel) {
                speechUtteranceChunker.cancel = false;
                return;
            }
            settings.offset = settings.offset || 0;
            settings.offset += chunk.length - 1;
            speechUtteranceChunker(utt, settings, callback);
        });
    }

    if (settings.modifier) {
        settings.modifier(newUtt);
    }
    console.log(newUtt); //IMPORTANT!! Do not remove: Logging the object out fixes some onend firing issues.
    //placing the speak invocation inside a callback fixes ordering and onend issues.
    setTimeout(function () {
        speechSynthesis.speak(newUtt);
    }, 0);
};

var speakTextList = function (textList, i) {
    'use strict';
    var utterance;
    if (i < 0) { i = 0; }
    if (i < textList.length) {
        utterance = new SpeechSynthesisUtterance(textList[i]);
        speechUtteranceChunker(utterance, {},
            function () {
                speakTextList(textList, i + 1);
            });
    }
};

var clock = {};

clock.tick = function () {
    'use strict';
    var today = new Date(),
        h = today.getHours(),
        m = today.getMinutes();
    if (m < 0) { m = '0' + m; }
    if (h > 12) { h -= 12; }
    document.getElementById('clock').innerHTML = h + ":" + m;
};

var reactKey = function (evt) {
    'use strict';
    var i, textList = [];
    if (evt.keyCode === 83) {
        for (i = 0; i < allVisualElements.length; i += 1) {
            console.log(v[allVisualElements[i]].vocalize());
            textList = textList.concat(v[allVisualElements[i]].vocalize());
        }
        console.log(textList);
        speakTextList(textList, 0);
        //speechMessage = new SpeechSynthesisUtterance(text);
        //speechUtteranceChunker(speechMessage);
    }
};

document.onkeydown = function (key) { 'use strict'; reactKey(key); };


var chooseBestCarousel = function (heights) {
    'use strict';
    var i, j, k, passes, height, screenHeight, carousel;

    try {
        screenHeight = window.innerHeight;
        //iterate through carousels, in order. 
        //for each carousel:
        for (i = 0; i < carousels.length; i += 1) {
            //  set passes to true
            passes = true;
            //  iterate through conditions, in order.
            //  for each condition:
            try {
                for (j = 0; j < carousels[i].conditions.length; j += 1) {
                    //set height to 0
                    height = 0;
                    //iterate through visualElements, in order. 
                    //for each visualElement:
                    for (k = 0;
                                k < carousels[i].conditions[j].visualElements.length;
                                k += 1) {
                    //add height to total. 
                        height += heights[carousels[i].conditions[j].visualElements[k]];
                    }
                    //check against areEmpty, if exists.
                    if (carousels[i].conditions[j].hasOwnProperty('areEmpty')) {
                        passes = passes &&
                            ((carousels[i].conditions[j].areEmpty && (height === 0)) ||
                            (!carousels[i].conditions[j].areEmpty && (height !== 0)));
                    }
                    //check against fitOnDisplay, if exists.
                    if (carousels[i].conditions[j].hasOwnProperty('fitOnDisplay')) {
                        passes = passes &&
                            ((carousels[i].conditions[j].fitOnDisplay && (height <= screenHeight)) ||
                            (!carousels[i].conditions[j].fitOnDisplay && (height > screenHeight)));
                    }
                    //if either test fails set passes to false and exit loop.

                    if (!passes) {
                        j = carousels[i].conditions.length;
                    }
                }
            } catch (err) {
                log.warning('chooseBestCarousel', '(could not evaluate condition) ' + err);
                passes = false;
            }
    //  if passes, return slides.
            if (passes) {
                carousel = [];
                for (j = 0; j < carousels[i].slides.length; j += 1) {
                    //set height to 0
                    height = 0;
                    //iterate through visualElements, in order. 
                    //for each visualElement:
                    for (k = 0;
                                k < carousels[i].slides[j].visualElements.length;
                                k += 1) {
                    //add height to total. 
                        height += heights[carousels[i].slides[j].visualElements[k]];
                    }
                    if (height > 0) {
                        carousel.push(carousels[i].slides[j]);
                    }
                }
                return carousel;
            }
        }
        //if nothing passes, return empty object 
        return [];
    } catch (err) {
        log.error('chooseBestCarousel', err);
        return [];
    }
};

var controller = {
    completedLoops: 0,
    lastLoopTime: 0
};

controller.updateDatasets = function (forceUpdate) {
    'use strict';
    var i;
    for (i in d) {
        if (d.hasOwnProperty(i)) {
            try {
                if (d.hasOwnProperty(i)) {
                    d[i].update(forceUpdate);
                }
            } catch (err) {
                log.criticalError('controller.updateDatasets', err);
            }
        }
    }
};

controller.heartbeat = function () {
    'use strict';
    if (this.nextHeartbeat < Date.now()) {
        this.lastHeartbeat = this.nextHeartbeat;
        this.nextHeartbeat += this.heartbeatRate;
        log.heartbeat(c.file, this.lastHeartbeat - this.firstHeartbeat,
                this.heartbeatRate * 2.1);
    }
};

controller.displayOnly = function (visualElements) {
    'use strict';
    var i, visible;
    try {
        for (i = 0; i < allVisualElements.length; i += 1) {
            visible = (visualElements.indexOf(allVisualElements[i]) >= 0);
            v[allVisualElements[i]].moveContentToPage();
            v[allVisualElements[i]].showOrHide(visible);
        }
        log.sample();
    } catch (err) {
        log.error('controller.displayOnly', JSON.stringify(err));
        console.log(err);
    }
};

controller.loop = function () {
    'use strict';
    var carousel, i, heights = {}, ms, setDisplayOnlyTimeout;
    setDisplayOnlyTimeout = function (slides, ms) {
        setTimeout(function () {controller.displayOnly(slides); }, ms);
    };

    try {
        for (i in f) {
            if (f.hasOwnProperty(i)) {
                f[i].update(true);
            }
        }

        for (i in v) {
            if (v.hasOwnProperty(i)) {
                v[i].render();
                heights[v[i].div] = v[i].height;
            }
        }

        carousel = chooseBestCarousel(heights);

        if (carousel.hasOwnProperty('length') && carousel.length > 0) {
            ms = 0;
            for (i = 0; i < carousel.length; i += 1) {
                setDisplayOnlyTimeout(carousel[i].visualElements, ms);
                ms += carousel[i].duration * 1000;
            }
        }
        this.completedLoops += 1;
    } catch (err) {
        log.criticalError('Failed at controller.loop, ' + err);
        ms = 120000;
    } finally {
        setTimeout(function () {controller.loop(); }, ms);
        ms -= 5000;
        setTimeout(function () {controller.updateDatasets(); }, ms);
    }
    controller.heartbeat();
};

controller.init = function () {
    'use strict';
    var i;

    this.firstHeartbeat = Date.now();
    this.nextHeartbeat = this.firstHeartbeat;
    this.heartbeatRate = b.logging.heartbeatRate;
    this.heartbeat();

    try {
        for (i in c.datasources) {
            if (c.datasources.hasOwnProperty(i)) {
                d[c.datasources[i].id] = new Datasource(c.datasources[i]);
            }
        }

        controller.updateDatasets(true);

        for (i in c.facets) {
            if (c.facets.hasOwnProperty(i)) {
                f[i] = new Facet(c.facets[i]);
            }
        }

        for (i in c.visualElements) {
            if (c.visualElements.hasOwnProperty(i)) {
                v[i] = new VisualElement(c.visualElements[i]);
            }
        }

        this.completedLoops = 0;
        this.lastLoopTime = Date.now();
        v.welcome.render();
        controller.displayOnly(['welcome']);
        setTimeout(function () {controller.loop(); }, 10000);
    } catch (err) {
        log.criticalError('controller.init', '(will retry in 2.5 mins)', err);
        setTimeout(function () {controller.init(); }, 1500000);
    }
};


//init(): schedule clock.tick(), schedule watchdog.init(), start controller.init()
function init() {
    'use strict';
    setInterval(function () {clock.tick(); }, 500);
    //setTimeout(function () {watchdog.test(); }, 120000);
    controller.init();
}