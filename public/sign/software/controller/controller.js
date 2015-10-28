/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global b, c, XMLHttpRequest, SpeechSynthesisUtterance, speechSynthesis,
document, window, _, $, Backbone, agencyConfig, io, signConfig, meSpeak */
'use strict';
//
//  ********************* BEGIN CONTROLLER  *********************
//  


// 
// PLANS FOR NEXT STEPS
// 3. The post-processing -- from agency data to viewable groups of data. 
// (complete for departures)
// 4. Display!
// 

/**
 * Expand underscore library: 
 * Capitalizes first letter of string. 
 * @return {string} input string, with first letter capitalized. 
 */


_.mixin({
    capitalize: function (string) {
        return string.charAt(0).toUpperCase() + string.substring(1);
    }
});

_.mixin({
    mixedCase: function (string) {
        return string.charAt(0).toUpperCase() +
                string.substring(1).toLowerCase();
    }
});

var st = {};
st.agencies = {};
st.m = {};
st.c = {};
st.v = {};
st.lib = {};
st.lib.input = {};
st.lib.mbta = {};
st.lib.process = {};
st.lib.carousel = {};
st.screenViews = {};
st.screenModels = {};
st.screenshots = {};
st.sign = {};
st.logger = {};

st.logger.log = function (sourceFunctionName, message) {
    var unsent, entry, signId;

    signId = st.sign.get('signId') || 'UNKNOWN';

    try {
        st.logger.entriesCounted = st.logger.entriesCounted || 0;
        //Are we sure we haven't sent too many entries recently?
        if (st.logger.entriesCounted < 40) {
            st.logger.entriesCounted += 1;
            entry = {
                logTime: new Date(),
                sourceTime: new Date(),
                source: 'sign',
                sign: signId,
                logLevel: 3,
                process: sourceFunctionName,
                message: message
            };
            $.post('postlog', JSON.stringify(entry));
            st.logger.countingEntriesSince = st.logger.countingEntriesSince
                || Date.now();
        //We've sent too many entries; are we sure it's not time 
        //to start sending again?
        } else if (st.logger.countingEntriesSince + 300000 > Date.now()) {
            st.logger.unsentEntries = st.logger.unsentEntries || 0;
            st.logger.unsentEntries += 1;
        //resume sending log entries. 
        } else {
            st.logger.countingEntriesSince = Date.now();
            st.logger.entriesCounted = 0;
            if (st.logger.unsentEntries > 0) {
                unsent = st.logger.unsentEntries;
                entry = {
                    logTime: new Date(),
                    source: 'sign',
                    sign: signId,
                    logLevel: 3,
                    process: 'logger',
                    message: unsent + ' messages unsent due to overflow'
                };
                $.post('postlog', JSON.stringify(entry));
                st.logger.unsentEntries = 0;
            }
        }
    } catch (err) {
        console.error('Failed to log, ' + err);
    }
};

window.onerror = function (errorMsg, url, lineNumber, column, errorObj) {
    st.logger.log('errorPieces', 'Error: ' + errorMsg + ' Script: ' + url
                + ' Line: ' + lineNumber + ' Column: ' + column
                + ' StackTrace: ' +  errorObj);
};

/**
 * Breaks a speech utterance into smaller "chunks" before speaking them.
 * This works around a known bug in chrome, in which too log a piece
 * of text crashes the speech engine. 
 * @param  {SpeechSynthesisUtterance}   utt      The speech utterance. 
 * @param  {object}   settings Options.
 * @param  {Function} callback callback function.
 */
st.lib.speechUtteranceChunker = function (utt, settings, callback) {
    var newUtt, txt, chunk, x, chunkLength, pattRegex, chunkArr;
    settings = settings || {};
    txt = (settings && settings.offset !==
        undefined ? utt.text.substring(settings.offset) : utt.text);
    if (utt.voice && utt.voice.voiceURI === 'native') { // Not part of the spec
        newUtt = utt;
        newUtt.text = txt;
        newUtt.addEventListener('end', function () {
            if (st.lib.speechUtteranceChunker.cancel) {
                st.lib.speechUtteranceChunker.cancel = false;
            }
            if (callback !== undefined) {
                callback();
            }
        });
    } else {
        chunkLength = (settings && settings.chunkLength) || 160;
        pattRegex = new RegExp('^[\\s\\S]{' + Math.floor(chunkLength / 2) + ','
            + chunkLength + '}[.!?,]{1}|^[\\s\\S]{1,' + chunkLength
            + '}$|^[\\s\\S]{1,' + chunkLength + '} ');
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
            if (st.lib.speechUtteranceChunker.cancel) {
                st.lib.speechUtteranceChunker.cancel = false;
                return;
            }
            settings.offset = settings.offset || 0;
            settings.offset += chunk.length - 1;
            st.lib.speechUtteranceChunker(utt, settings, callback);
        });
    }

    if (settings.modifier) {
        settings.modifier(newUtt);
    }
    console.log(newUtt);
    //IMPORTANT!! Do not remove:
    //Logging the object out fixes some onend firing issues.
    //placing the speak invocation inside a callback fixes
    //ordering and onend issues.
    setTimeout(function () {
        speechSynthesis.speak(newUtt);
    }, 0);
};

/**
 * Speaks all the strings in an array, starting with item i.
 * (Calls st.lib.speechUtteranceChunker with a callback that increments i)
 * @param  {array} textList all items to speak (strings)
 * @param  {number} i        item to speak next
 */
st.lib.speakTextList = function (textList, i) {
    var utterance, testval;
    i = i || 0;
    if (i < 0) { i = 0; }
    if (st.sign.get('speech') === 'mespeak') {
        if (st.haltSpeech) {
            st.haltSpeech = false;
            st.speakingState = false;
            return;
        }
        if (i < textList.length) {
            st.speakingState = true;
            testval = meSpeak.speak(textList[i], {},
                    function () {
                    st.lib.speakTextList(textList, i + 1);
                });
        } else {
            st.speakingState = false;
        }
        return;
    }
    if (i < textList.length) {
        utterance = new SpeechSynthesisUtterance(textList[i]);
        st.lib.speechUtteranceChunker(utterance, {},
            function () {
                st.lib.speakTextList(textList, i + 1);
            });
    }
};

st.lib.input.successHandler = function (feed) {
    setTimeout(function () {feed.fetch(
        {
            success: function () {st.lib.input.successHandler(feed); },
            error: function () {st.lib.input.errorHandler(feed); }
        }
    ); }, feed.maxAge || 60000);
    feed.lastUpdated = Date.now();
};

st.lib.input.errorHandler = function (feed) {
    var waittime = (feed.maxAge || 60000) / 10,
        maxAge = (feed.maxAge || 60000),
        lastUpdated = feed.lastUpdated || 0;
    st.logger.log('st.lib.input', 'Failed to read data');
    if (lastUpdated + maxAge * 2 < Date.now()) {
        feed.reset();
        waittime = Math.min(waittime, 60000);
    }
    setTimeout(function () {feed.fetch(
        {
            success: function () {st.lib.input.successHandler(feed); },
            error: function () {st.lib.input.errorHandler(feed); }
        }
    ); }, waittime);
};

st.lib.mbta.pickRouteColor = function (modeName, routeName) {
    switch (routeName) {
    case 'Green Line B':
    case 'Green Line C':
    case 'Green Line D':
    case 'Green Line E':
        return '#33FF33';
    case 'Red Line':
    case 'Mattapan Trolley':
        return '#FF6464';
    case 'Blue Line':
        return '#80AAFF';
    case 'Orange Line':
        return '#E87200';
    case 'SL1':
    case 'SL2':
    case 'SL3':
    case 'SL4':
    case 'SL5':
    case 'SL6':
    case 'Silver Line SL1':
    case 'Silver Line SL2':
    case 'Silver Line SL3':
    case 'Silver Line SL4':
    case 'Silver Line SL5':
    case 'Silver Line SL6':
    case 'Silver Line Waterfront':
    case 'Silver Line':
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

st.lib.mbta.deriveDestination = function (modeName, routeName, dir, stoptime) {
    var dest = {title: '', subtitle: '' },
        testVia = /\svia\s/, //Does destination sign contain "via"?
        getBeforeVia = /\svia\s[\W\w]+$/, //Text before word "via"
        getAfterVia = /^[\W\w]+\svia\s/,  //Text after word "via"
        testParens = /\(/,   //Does destination sign contain a "("?
        getBeforeParens = /\([\W\w]+$/, //Text before (
        getAfterParens = /^[\W\w]+\(/,  //Text after (
        getAfterTo = /^[\W\w]+\sto\s/,  //Text after "... to "
        getBeforeSpace = /\s[\W\w]+$/;  //Text before " "
    if (modeName !== 'Commuter Rail') {
        if (stoptime.hasOwnProperty('trip_headsign')) {
            if (testVia.test(stoptime.trip_headsign)) {
                //Non-commuter rail, has headsign with "via"
                dest.title = stoptime.trip_headsign.replace(getBeforeVia, '');
                dest.subtitle =
                    stoptime.trip_headsign.replace(getAfterVia, 'via ');
                return dest;
            }
            if (testParens.test(stoptime.trip_headsign)) {
                //Non-commuter rail, has headsign with "()"
                dest.title =
                    stoptime.trip_headsign.replace(getBeforeParens, '');
                dest.subtitle =
                    stoptime.trip_headsign.replace(getAfterParens, '(');
                return dest;
            }
            //Non-commuter rail, one-line destination
            dest.title = stoptime.trip_headsign;
            return dest;
        }
        //Non-commuter rail, no headsign text at all
        dest.title = stoptime.trip_name.replace(getAfterTo, '');
        return dest;
    }
    if (stoptime.hasOwnProperty('trip_headsign')) {
        //commuter rail, with headsign
        dest.title = stoptime.trip_headsign;
        dest.subtitle = 'Train '
            + stoptime.trip_name.replace(getBeforeSpace, '');
        return dest;
    }
    dest.title = dir;
    dest.subtitle = routeName;
    return dest;
};

st.v.Clock = Backbone.View.extend({
    el: '#clock',
    initialize: function () {
        this.render = _.bind(this.render, this);
        setInterval(function (self) {
            return self.render;
        }(this), 1000);
    },
    render: function () {
        var today = new Date(),
            h = today.getHours(),
            m = today.getMinutes();
        if (m < 10) { m = '0' + m; }
        if (h > 12) { h -= 12; }
        this.$el.html(h + ':' + m);
    }
});

st.m.Heartbeat = Backbone.Model.extend({
    defaults: {
        url: '/heartbeathandler',
        sign: '',
        timestamp: Date(0),
        uptime: Date(0),
        heartbeatRate: 60000
    },
    initialize: function () {
        this.set({timestamp: Date.now()});
    }
});

st.m.Sign = Backbone.Model.extend({
    defaults: {
        startTime: Date(0),
        logging: true,
        heartbeat: true,
        signId: '',
        status: '', //FUTURE WORK Store sign's status and show as needed 
        heartbeatRate: 60000,
        lastUpdate: Date(0),
        lastHeartbeat: Date(0),
        agencies: {}, //FUTURE WORK move st.agencies here
        screenViews: {}, //FUTURE WORK move st.screenViews here
        screenData: {} //FUTURE WORK move st.screenData here
    },
    initialize: function () {
        this.set({startTime: Date.now()});
        this.sendHeartbeat = _.bind(this.sendHeartbeat, this);
        if (this.get('heartbeat')) {
            //FUTURE WORK is using function (self) best practice?
            setInterval(function (self) {
                return self.sendHeartbeat;
            }(this), this.get('heartbeatRate'));
        }
    },
    sendHeartbeat: function () {
    //FUTURE WORK there is much about sendHeartbeat that should be improved.
    //Really there should be a sign-state object, which is defined the
    //same way on both client and server, and the sign uses backbone's
    //native features to update it. 
    //FUTURE WORK the *2.1 is to provide a buffer so one hb can be missed,
    //but that should REALLY be handled server-side

    // if (this.get('lastUpdate') + this.get('heartbeatRate') < Date.now()) {
    //     return;
    // }

    //FUTURE WORK this should be moved into a separate error logging function

        var heartbeat = new st.m.Heartbeat(
            {
                sign: this.get('signId'),
                uptime: Date.now() - this.get('startTime'),
                heartbeatRate: this.get('heartbeatRate') * 2.1
            }
        );
        $.post('postheartbeat', JSON.stringify(heartbeat));
        this.set({lastHeartbeat: Date.now()});
    }
});

st.m.AgencyComponent = Backbone.Model.extend({
    defaults: {
        modelType: 'AgencyComponent',
        txid: '',
        name: ''
    },
    regexes: function () {
        return [new RegExp('\\b(' + this.escape('name') + ')\\b', 'gi')];
    }
});

st.c.AgencyComponents = Backbone.Collection.extend({
    model: st.m.AgencyComponent,
    agency: {}, //FUTURE WORK this might not do anything
    sourceType: '', //supported: MBTA-realtime//FUTURE WORK this might not do anything
    url: '',
    maxAge: 30000,//FUTURE WORK this might not do anything
    lastUpdated: 0,//FUTURE WORK this might not do anything
    upToDate: false, //Not up-to-date until it's been initialized.//FUTURE WORK this might not do anything
    comparator: 'sortOrder'
});

st.m.Route = st.m.AgencyComponent.extend({
    defaults: {
        modelType: 'Route',
        mode: 'Bus',
        name: '',      //1         Red line   Green Line C       
        longName: '',  //Route 1   Red Line   Green Line C branch
        trunkName: '', //1         Red Line   Green Line         
        branchName: '',//''        ''         C                  
        shortName: '', //1         Red        C                  
        color: '',
        isMode: false,
        isLocal: false,
        isHidden: false,
        sortOrder: 0,
    },
    initialize: function () {
        if (this.get('longName') === '') {
            if (this.get('mode') === 'Bus' &&
                    this.get('name').search(/Line/i) === -1) {
                this.set({longName: 'Route ' + this.get('name')});
            } else if (this.get('name').search(/Line\s\w/) !== -1) {
                this.set({longName: this.get('name') + ' branch'});
            } else {
                this.set({longName: this.get('name')});
            }
        }
        if (this.get('branchName') === '') {
            if (this.get('name').search(/Line\s\w/) !== -1) {
                this.set({
                    branchName: this.get('name').replace(/.*Line\s/, '')
                });
            }
        }
        if (this.get('trunkName') === '') {
            this.set({trunkName: this.get('name').replace(/Line.*/, 'Line')});
        }
        if (this.get('shortName') === '') {
            if (this.get('branchName') !== '') {
                //TODO take only the beginning? 
                //This includes a "Short name" of "waterfront"
                this.set({shortName: this.get('branchName')});
            } else if (this.get('mode') === 'Commuter Rail') {
                this.set({shortName: 'Rail'});
            } else if (this.get('mode') === 'Boat') {
                this.set({shortName: 'Boat'});
            } else {
                this.set({shortName: this.get('name').split(' ')[0]});
            }
        }
    },
    regexes: function () {
        var r = [],
            names = ['longName', 'name', 'trunkName', 'branchName',
                'shortName'];

        _(names).each(function (i) {
            if (this.get(i) !== undefined && this.escape(i) !== '') {
                _(r).push(new RegExp('\\b(' + this.escape(i) + ')\\b', 'gi'));
            }
        }, this);
        return _(r).uniq();
    }
});

st.c.Routes = st.c.AgencyComponents.extend({
    model: st.m.Route,
    comparator: 'sortOrder',
    maxAge: 86400000,
    parse: function (data) {
        var parseMBTARealtime = function (data) {
            var i = 0,
                rawRoutes = [];
            _(data.mode).each(function (mode) {
                _(rawRoutes).push({
                    txid: 'mode_' + mode.mode_name,
                    name: mode.mode_name,
                    mode: mode.mode_name,
                    color: st.lib.mbta.pickRouteColor(mode.mode_name, ''),
                    isMode: true,
                    sortOrder: i
                });
                i += 1;
            });

            _(data.mode).each(function (mode) {
                _(mode.route).each(function (route) {
                    _(rawRoutes).push({
                        txid: route.route_id,
                        name:   route.route_name,
                        mode:   mode.mode_name,
                        color: st.lib.mbta.pickRouteColor(mode.mode_name,
                                    route.route_name),
                        isHidden: route.route_hide,
                        sortOrder: i
                    });
                    i += 1;
                });
            });
            return rawRoutes;
        };

        switch (this.sourceType) { //TODO doesn't this need to be this.get('sourceType')?
        case 'MBTA-realtime':
            return parseMBTARealtime(data);
        default:
            st.logger.log('st.c.Routes', 'Unsupported data source ' + this.sourceType);
            return [];
        }
    },
});

st.m.Stop = st.m.AgencyComponent.extend({
    defaults: {
        modelType: 'Stop',
        color: '',
        childName: undefined,
        parentName: undefined,
        isLocal: false,
    },
    initialize: function () {
        if (this.get('name') === undefined || this.get('name') === '') {
            this.set({name: this.get('parentName') || this.get('childName')});
        }
    },
    regexes: function () {
        var r = [];
        if (this.get('parentName')) {
            _(r).push(new RegExp('\\b(' + this.escape('parentName') + ')\\b', 'gi'));
        }
        if (this.get('childName')) {
            _(r).push(new RegExp('\\b(' + this.escape('childName') + ')\\b', 'gi'));
        }
        if (this.get('name')) {
            _(r).push(new RegExp('\\b(' + this.escape('name') + ')\\b', 'gi'));
        }
        return r;
    }
});

st.m.AccessFeature = st.m.AgencyComponent.extend({
    defaults: {
        modelType: 'AccessFeature',
        color: '#80AAFF',
        type: '',
        stationName: '',
    }
});

st.m.Alert = Backbone.Model.extend({
    defaults: {
        modelType: 'Alert',
        txid: '',
        affecteds: undefined,
        affectedDirection: '',
        timeframe: '',
        startTime: Date(0),
        endTime: Date(0),
        disruptionType: '',
        summary: '',
        description: '',
        details: '',
        banner: '',
        isService: false,
        isElevator: false,
        isSubway: false,
        isLocal: false,
        isCurrent: false,
        isSoon: false,
        isUpcoming: false,
        isSevere: false,
        isSystemwide: false,
        isFeatured: false
    },
    initialize: function () {
        this.set({affecteds: new st.c.AgencyComponents()});
    },
    getFormatted: function (propName) {
        //have an array: Route, Stop, AccessFeature.
        //Use that to try routes; if there are no changes try stops; etc. 
        //Should each Route, Stop etc be able to produce its own list of regular
        //expressions? Should they have their own "highlight" function?
        var input = this.escape(propName),
            tests = ['Route', 'Stop', 'AccessFeature'],
            allRegexes,
            i,
            j,
            k,
            routeSuccess = false,
            success = false,

            affecteds = this.get('affecteds');

        allRegexes = _(tests).reduce(function (memo, test) {
            memo.push(affecteds.reduce(function (memo2, affected) {
                if (affected.get('modelType') === test) {
                    _(memo2).push({
                        regexes: affected.regexes(),
                        modelType: affected.get('modelType'),
                        color: affected.get('color')
                    });
                }
                return memo2;
            }, []));
            return memo;
        }, []);

        for (i = 0; i < allRegexes.length; i += 1) {
            if (!success) {
                for (j = 0; j < allRegexes[i].length; j += 1) {
                    routeSuccess = false;
                    for (k = 0; k < allRegexes[i][j].regexes.length; k += 1) {
                        if (!routeSuccess &&
                                allRegexes[i][j].regexes[k].test(input) &&
                                allRegexes[i][j].regexes[k].color !== '') {
                            success = true;
                            routeSuccess = true;
                            input = input.replace(allRegexes[i][j].regexes[k],
                                '<span style="color:' + allRegexes[i][j].color + '">' +
                                '$1' + '</span>');
                        }
                    }
                }
            }
        }
        return input;
    }
});

st.c.Alerts = Backbone.Collection.extend({
    model: st.m.Alert,
    maxAge: 60000, //FUTURE WORK this may not do anything. 
    order: 'txid',
    comparator: function (model) {
        switch (this.order) {
        case 'byRoute':
            return model.get('affecteds').first().get('sortOrder');
        case 'byTime':
            return model.get('startTime') * 10000000000000 +
                    model.get('endTime');
        case 'byElevatorStation':
            return model.get('stationName') || model.get('summary');
        case 'byElevatorTimeAndStation':
            return (model.get('isSoon') ? model.get('startTime') : '0000') +
                model.get('stationName') || model.get('summary');
        default:
            return model.get(this.order);
        }
    },
    parse: function (data) {
        var parseMBTARealtime = function (data) {
            var newAlerts = [], //Collection of new alerts is built here and returned
                newAlert,
                affected,
                getElevatorName = /^[^a-z]+-\s?/,
                getElevatorStation = /\s?-[\W\w]+$/;

            if (data.alerts === undefined) { return []; }

            _(data.alerts).each(function (source) {
                newAlert = new st.m.Alert({
                    txid: source.alert_id,
                    affectedDirection: '',
                    timeframe: source.timeframe_text,
                    disruptionType: source.effect_name,
                    summary: source.service_effect_text,
                    description: source.header_text,
                    details: source.description_text,
                    isService: (source.affected_services.services.length > 0),
                    isSevere: (source.severity === 'Severe'),
                    isCurrent: (source.alert_lifecycle === 'New'),
                    isUpcoming: (source.alert_lifecycle === 'Upcoming')
                });
                if (source.effect_periods.length > 0) {
                    newAlert.set({
                        startTime: _(source.effect_periods).first().effect_start * 1000,
                        endTime: _(source.effect_periods).last().effect_end * 1000
                    });
                }

                if (source.hasOwnProperty('banner_text')) {
                    newAlert.set({
                        isFeatured: true,
                        banner: source.banner_text
                    });
                }

                _(source.affected_services.elevators).each(function (el) {
                    affected = new st.m.AccessFeature({
                        txid: el.elev_id,
                        name: el.elev_name.replace(getElevatorName, ''),
                        type: el.elev_type,
                        stationName: _(el.stops).first().parent_station_name
                                ||  _(el.elev_name.replace(getElevatorStation, '')).mixedCase()
                    });
                    newAlert.get('affecteds').add(affected);
                    if (el.elev_type === 'Elevator') {
                        newAlert.set({isElevator: true});
                    }
                    if (newAlert.get('affectedElevator') === undefined) {
                        newAlert.set({
                            affectedElevatorId: affected.get('txid'),
                            affectedElevatorDescription: affected.get('name'),
                            affectedStation: affected.get('stationName')
                        });
                    }
                    _(el.stops).each(function (stop) {
                        affected = new st.m.Stop({
                            txid: stop.stop_id,
                            childName: stop.stop_name,
                            parentName: stop.parent_station_name
                        });
                        newAlert.get('affecteds').add(affected);
                    });
                });

                if (newAlert.get('isUpcoming') &&
                        ((newAlert.get('startTime') < Date.now() + 604800000 &&
                        source.severity === 'Severe') ||
                            (newAlert.get('startTime') < Date.now() + 432000000 &&
                                source.severity === 'Moderate') ||
                            (newAlert.get('startTime') < Date.now() + 432000000 &&
                                source.severity === 'Significant') ||
                            (newAlert.get('startTime') < Date.now() + 432000000 &&
                                newAlert.get('isElevator')) ||
                            (newAlert.get('startTime') < Date.now() + 259200000 &&
                                source.severity === 'Minor'))) {
                    newAlert.set({isSoon: true});
                }

                if (newAlert.get('isElevator')
                    && newAlert.get('startTime') < Date.now()
                    && newAlert.get('startTime') > Date.now() - 3628800000) {
                    newAlert.set({isCurrent: true});
                }

                _(source.affected_services.services).each(function (el) {
                    if (el.hasOwnProperty('route_id')) {
                        affected = new st.m.Route({
                            txid: el.route_id,
                            name:   el.route_name,
                            mode:   el.mode_name,
                            color: st.lib.mbta.pickRouteColor(el.mode_name, el.route_name),
                            isHidden: el.route_hide
                        });
                    } else {
                        affected = new st.m.Route({
                            txid: el.route_id,
                            name:   el.route_name,
                            mode:   el.mode_name,
                            color: st.lib.mbta.pickRouteColor(el.mode_name, ''),
                            isHidden: el.route_hide
                        });
                        newAlert.set({isSystemwide: true});
                    }

                    if (!newAlert.get('affecteds')
                            .findWhere({txid: affected.txid})) {
                        newAlert.get('affecteds').add(affected);
                    }

                    if (el.hasOwnProperty('stop_id') &&
                            !newAlert.get('affecteds').findWhere(
                                {txid: el.stop_id}
                            )) {
                        affected = new st.m.Stop({
                            txid: el.stop_id,
                            childName: el.stop_name,
                            parentName: el.parent_station_name,
                            color: st.lib.mbta.pickRouteColor(el.mode_name,
                                el.route_name)
                        });
                        newAlert.get('affecteds').add(affected);
                    }

                    if (el.hasOwnProperty('direction_name')) {
                        if (newAlert.get('affectedDirection') === '') {
                            newAlert.set({
                                affectedDirection: el.direction_name
                            });
                        } else if (newAlert.get('affectedDirection')
                                !== el.direction_name) {
                            newAlert.set({affectedDirection: 'both'});
                        }
                    }
                }, this);

                newAlerts.push(newAlert);
            }, this);

            if (!_(newAlerts).findWhere({isFeatured: true})) {
                _(newAlerts).each(function (al) {
                    al.isFeatured = (al.isSubway && al.isLocal
                            && al.isCurrent && al.isSevere);
                });
            }
            return newAlerts;
        };

        switch (this.sourceType) {
        case 'MBTA-realtime':
            return parseMBTARealtime(data, this.agency.routes);
        default:
            st.logger.log('st.c.Alerts', 'Unsupported data source ' + this.sourceType);
            return [];
        }
    }
});

/**
 * A departure from this location, scheduled and/or predicted. 
 */
st.m.Departure = Backbone.Model.extend({
    defaults: {
        modelType: 'Departure',
        route: undefined,
        direction: undefined,
        tripId: undefined,
        serviceGroup: undefined,
        locationName: '',
        destinationTitle: '',
        destinationSubtitle: '',
        scheduledTime: 0,
        predictedTime: 0,
        time: 0,
        isPrediction: false
    },
    initialize: function () {
        if (this.get('predictedTime') > 0) {
            this.set({time: this.get('predictedTime'),
                isPrediction: true});
        } else if (this.get('scheduledTime') > 0) {
            this.set({time: this.get('scheduledTime'),
                isPrediction: false});
        }
        if (this.get('serviceGroup') === undefined) {
            switch (this.get('route').get('mode')) {
            case 'Subway':
                this.set({
                    serviceGroup: this.get('route').get('trunkName') + '-' +
                            this.get('destinationTitle')
                });
                break;
            case 'Bus':
                this.set({
                    serviceGroup: this.get('route').get('name') + '-' +
                            this.get('direction')
                });
                break;
            case 'Commuter Rail':
                this.set({serviceGroup: this.get('destinationTitle')});
                break;
            case 'Boat':
                this.set({serviceGroup: this.get('destinationTitle')});
                break;
            default:
                this.set({serviceGroup: this.get('destinationTitle')});
                break;
            }
        }
    },
    /**
     * Departure is "soon" if it's no more than one minute in the past
     * and no more than 65 minutes in the future.
     * @return {Boolean} is departure soon.
     */
    isSoon: function () {
        return (Date.now() - 60000 < this.get('time') &&
                this.get('time') < Date.now() + 60000 * 65);
    },
    /**
     * Returns an integer number of minutes to display. 
     * @return {[type]} minutes away (integer)
     */
    minsAway: function () {
        return Math.max(Math.floor((this.get('time') - Date.now()) / 60000), 0);
    },
    //TODO the following should be moved to a view. 
    /**
     * Returns string suitable for speech synthesis. 
     * @return {string} String for speech synthesis. 
     */
    vocalize: function () {
        var text = '', minutes = this.minsAway();
        if (this.route.mode === 'Bus') {
            text += 'Route ';
        }
        text += this.route.name.replace('/', ' ') + ' ' + this.destinationTitle + ', ';
        text += minutes + (minutes === 1 ? ' minute' : ' minutes');
        return text;
    }
});

st.c.Departures = st.c.AgencyComponents.extend({
    model: st.m.Departure,
    order: 'routeOrder',
    comparator: function (a, b) {
        switch (this.order) {
        case 'routeOrder':
            return a.get('route').get('sortOrder') -
                    b.get('route').get('sortOrder');
        case 'predictionTimeOrder':
            if (a.get('isPrediction') && !b.get('isPrediction')) {return -1; }
            if (b.get('isPrediction') && !a.get('isPrediction')) {return 1; }
            return a.get('time') - b.get('time');
        case 'presentationOrder':
            if (a.get('route').get('trunkName') !==
                    b.get('route').get('trunkName')) {
                return a.get('route').get('sortOrder') -
                        b.get('route').get('sortOrder');
            }
            if (a.get('direction') > b.get('direction')) { return 1; }
            if (a.get('direction') < b.get('direction')) { return -1; }
            return a.get('time') - b.get('time');
        default:
            if (a.get(this.order) > b.get(this.order)) { return 1; }
            if (a.get(this.order) < b.get(this.order)) { return -1; }
            return 0;
        }
    },
    parse: function (data) {
        var parseMBTARealtime = function (deps, locationName) {
            var departures = [],
                destination;
            _(deps.mode).each(function (mode) {
                _(mode.route).each(function (route) {
                    _(route.direction).each(function (direction) {
                        _(direction.trip).each(function (trip) {
                        //generate "destinationTitle" and "destinationSubtitle"
                            destination = st.lib.mbta.deriveDestination(
                                mode.mode_name,
                                route.route_name,
                                direction.direction_name,
                                trip
                            );
                            departures.push({
                                route: new st.m.Route(
                                    {
                                        txid: route.route_id,
                                        name:   route.route_name,
                                        mode:   mode.mode_name,
                                        color: st.lib.mbta.pickRouteColor(
                                            mode.mode_name,
                                            mode.route_name
                                        )
                                    }
                                ),
                                direction: direction.direction_name,
                                tripId: trip.trip_id,
                                destinationTitle: destination.title,
                                destinationSubtitle: destination.subtitle,
                                scheduledTime: trip.sch_dep_dt * 1000,
                                predictedTime: trip.pre_dt * 1000,
                                locationName: locationName
                            });
                        });
                    });
                });
            });
            return departures;
        };
        switch (this.sourceType) {
        case 'MBTA-realtime':
            return parseMBTARealtime(data, (this.locationName || ''));
        default:
            st.logger.log('st.c.Departures', 'Unsupported data source ' + this.sourceType);
            return [];
        }
    }
});

st.lib.mbta.initializeAgency = function (newAgency) {
    var defaultParams = {
            api_key: newAgency.get('api_key'),
            format: 'json'
        },
        sourceNames = [],
        initializeComponent = function (config, agency) {
            var component = new config.constructor();
            component.agency = agency;
            component.sourceType = 'MBTA-realtime';
            if (config.fromAPI) {
                component.url = config.baseURL + config.command
                    + '?' + $.param(config.params);
            }
            return component;
        };

    newAgency.set({
        destinationFilter: new RegExp(newAgency.get('destinationFilter'))
    });

    /********************* routes *********************/
    newAgency.set({routesSource: initializeComponent({
        constructor: st.c.Routes,
        fromAPI: true,
        baseURL: newAgency.get('baseURL'),
        command: 'routes',
        params: defaultParams
    }, newAgency)});

    sourceNames.push('routesSource');

    newAgency.set('routes', initializeComponent({
        constructor: st.c.Routes,
        fromAPI: false,
    }, newAgency));

    newAgency.get('routes').listenTo(
        newAgency.get('routesSource'),
        'sync reset',
        function () {return st.lib.mbta.combineRoutesAndLocal(newAgency); }
    );

    if (newAgency.get('behavior_alertsForAllRoutes') === true) {
        newAgency.set({localRoutesCollections: ['routesSource']});
    } else {
        newAgency.set({localRoutesCollections: []});

        _(newAgency.get('stops')).each(function (stop) {
            var name = 'localRoutesSource_' + stop.stop_id;

            newAgency.get('localRoutesCollections').push(name);

            newAgency.set('localRoutesSource_' + stop.stop_id,
                initializeComponent({
                    constructor: st.c.Routes,
                    fromAPI: true,
                    baseURL: newAgency.get('baseURL'),
                    command: 'routesbystop',
                    params: _({stop: stop.stop_id}).defaults(defaultParams),
                }, newAgency));

            sourceNames.push('localRoutesSource_' + stop.stop_id);

            newAgency.get('routes').listenTo(
                newAgency.get(name),
                'sync reset',
                function () {
                    return st.lib.mbta.combineRoutesAndLocal(newAgency);
                }
            );

        });
    }

    /********************* alerts *********************/
    _(['alerts',
        'currentServiceAlertsCD',
        'featuredAlerts',
        'upcomingServiceAlerts',
        'elevatorAlerts'
        ]).each(function (a) {
        newAgency.set(a, initializeComponent({
            constructor: st.c.Alerts,
            fromAPI: false,
        }, newAgency));
    });
    newAgency.get('upcomingServiceAlerts').order = 'byTime';
    newAgency.get('elevatorAlerts').order = 'byElevatorStation';

    if (newAgency.get('behavior_suppressAlerts') !== true) {
        newAgency.set('alertsSource', initializeComponent({
            constructor: st.c.Alerts,
            fromAPI: true,
            baseURL: newAgency.get('baseURL'),
            command: 'alerts',
            params: _({
                include_access_alerts: 'true',
                include_service_alerts: 'true'
            }).defaults(defaultParams)
        }, newAgency));

        sourceNames.push('alertsSource');

        _(['alertsSource', 'routes']).each(function (target) {
            newAgency.get('alerts').listenTo(
                newAgency.get(target),
                'reset sync',
                function () {
                    return newAgency.get('alerts').reset(
                        st.lib.mbta.combineAlertsAndRoutes(
                            newAgency.get('alertsSource'),
                            newAgency.get('routes')
                        )
                    );
                }
            );
        });

        _([
            {
                collection: 'currentServiceAlertsCD',
                process: function () {
                    return st.lib.process
                        .currentServiceAlertsCD(newAgency.get('alerts'));
                }
            },
            {
                collection: 'featuredAlerts',
                process: function () {
                    return newAgency.get('alerts').where({isFeatured: true});
                }
            },
            {
                collection: 'upcomingServiceAlerts',
                process: function () {
                    return newAgency.get('alerts').filter(
                        function (al) {
                            return al.get('isSoon') &&
                                (al.get('isLocal') || al.get('isSubway'));
                        }
                    );
                }
            },
            {
                collection: 'elevatorAlerts',
                process: function () {
                    var x = [];
                    x = (newAgency.get('alerts').where(
                        {isElevator: true, isCurrent: true}
                    ));
                    x = x.concat(newAgency.get('alerts').where(
                        {isElevator: true, isSoon: true}
                    ));
                    // return newAgency.get('alerts').where({isElevator: true});
                    return x;
                }
            },
        ]).each(function (x) {
            newAgency.get(x.collection)
                .listenTo(newAgency.get('alerts'), 'reset sync', function () {
                    newAgency.get(x.collection).reset(x.process());
                });
        });
    }

    /********************* departures *********************/
    newAgency.set('departures', initializeComponent({
        constructor: st.c.Departures,
        fromAPI: false,
    }, newAgency));

    newAgency.set({departuresCollections: []});

    if (newAgency.get('behavior_suppressDepartures') !== true) {

        _(newAgency.get('stops')).each(function (stop) {
            var name = 'departuresSource_' + stop.stop_id;

            newAgency.set(name, initializeComponent({
                constructor: st.c.Departures,
                fromAPI: true,
                baseURL: newAgency.get('baseURL'),
                command: 'predictionsbystop',
                params: _({
                    stop: stop.stop_id,
                    include_service_alerts: 'false'
                }).defaults(defaultParams),
            }, newAgency));

            newAgency.get(name).locationName = stop.locationName;

            newAgency.get('departures').listenTo(
                newAgency.get(name),
                'sync reset',
                function () {
                    return st.lib.mbta.chooseNextDepartures(newAgency);
                }
            );

            newAgency.get('departuresCollections').push(name);
            sourceNames.push(name);
        });
    }

    /********************* start *********************/
    //Future improvement: 
    //this next section, in which the screenData collections are
    //subscribed to this new agency, was originally part of the screenData
    //model. But it exhibited strange behavior, likely owing to issues
    //with the context of some of the operations. It would make more sense 
    //there, but moving it here worked around the issue. 
    //
    //Future improvement:
    //Instead of maintaining many alert lists here, the agency could 
    //maintain one. The screenData would extract the alerts it needs
    //when it subscribed. 
    //The "combined delay" alert does not fit neatly in either location. 
    if (st.screenData !== undefined) {
        _(['featuredAlerts',
            'currentServiceAlertsCD', 'upcomingServiceAlerts',
            'elevatorAlerts', 'departures']).each(function (x) {
            st.screenData.get(x + 'Sources').push(
                newAgency.get(x)
            );

            st.screenData.get(x).listenTo(
                newAgency.get(x),
                'reset sync change',
                function () {
                    return st.screenData.refresh(x);
                }
            );
        });

        st.screenData.get('elevatorAlerts').order = 'byElevatorStation';

    }

    _(sourceNames).each(function (name) {
        newAgency.get(name).fetch({
            success: function () {
                st.lib.input.successHandler(newAgency.get(name));
            },
            error: function () {
                st.lib.input.errorHandler(newAgency.get(name));
            }
        });
    });


};

//FUTURE WORK this should be st.m.Agency
var Agency = Backbone.Model.extend({
    defaults: {
        name: undefined,
        sourceType: undefined,
        routes: undefined,
        departures: undefined,
        alerts: undefined,
    },
    initialize: function () {
        switch (this.get('sourceType')) {
        case 'MBTA-realtime':
            st.lib.mbta.initializeAgency(this);
            break;
        default:
            st.logger.log('Agency', 'Unsupported data source ' + this.get('sourceType'));
        }
    },
    combineRoutesAndLocal: function () {
        st.lib.process.combineRoutesAndLocal(this);
    }
});

st.lib.process.formatDelay = function (delay) {
    var branch,
        direction,
        severe;

    if (_(delay.branches).uniq().length === 1 &&
            _(delay.branches).first() !== '') {
        branch = _(delay.branches).first();
    }

    if (_(delay.directions).uniq().length === 1 &&
            _(delay.directions).first() !== '') {
        direction = _(delay.directions).first();
    }

    if (delay.isSevere) {
        severe = 'severe';
    }

    return delay.serviceName +
                (branch || direction || severe ? ' (' : '') +
                (branch || '') +
                (branch && direction ? ' ' : '') +
                (direction || '') +
                ((branch || direction) && severe ? ', ' : '') +
                (severe || '') +
                (branch || direction || severe ? ')' : '');
};

st.lib.process.combinedDelayAlert = function (alerts) {
    /**************************************************
     For each alert, for each not-hidden route: 
       Generate the serviceName. 
       Is there a delayBundle with this serviceName? 
         If not, create one. 
             serviceName (chop off everything after "line")
             branch list (show 2 at most)
             direction list (show 1 at most)
             isRoute (if bus and doesn't contain "line")
             severity
             sort order
         If there is, modify it if necessary. 
             add to branch list?
             add to direction list?
             change severity to true?
         
         Then create a list of each serviceName. 
    ***************************************************/
    var delays = [],
        routeDelays = [],
        lineDelays = [],
        delay,
        serviceName,
        isSevere,
        affectedDirection,
        remainingDelayed, //Remaining (not-yet-listed) delays
        description, //For alert being created,
        routes = new st.c.Routes(),
        newAlert;

    newAlert = new st.m.Alert({
        txid: 'CombinedDelayAlert',
        disruptionType: 'Delays',
        isCurrent: true,
        isService: true
    });

    alerts.each(function (a) {
        affectedDirection = a.get('affectedDirection');
        isSevere = a.get('isSevere');
        routes.add(a.get('affecteds').where({
            modelType: 'Route',
            isHidden: false
        }));
        routes.each(function (r) {
            newAlert.get('affecteds').add(r);
            serviceName = r.get('trunkName');
            if (!_(delays).findWhere({serviceName: serviceName})) {
                //New serviceName, new delay
                delay = {
                    serviceName: serviceName,
                    branches: [],
                    directions: [affectedDirection],
                    isRoute: (r.get('mode') === 'Bus' &&
                        r.get('name').search(/Line/) === -1),
                    isSevere: isSevere,
                    sortOrder: r.get('sortOrder')
                };
                if (r.get('branchName') !== '') {
                    delay.branches.push(r.get('branchName'));
                }
                delays.push(delay);
            } else {
                //Existing serviceName
                delay = _(delays).findWhere({serviceName: serviceName});
                if (r.get('branchName') !== '') {
                    delay.branches.push(r.get('branchName'));
                    delay.directions.push(affectedDirection);
                    delay.isSevere = delay.isSevere || isSevere;
                }
            }
        });
    });

    routeDelays = _(delays).where({isRoute: true});
    lineDelays = _(delays).where({isRoute: false});
    routeDelays.sort(function (a, b) {return a.sortOrder - b.sortOrder; });
    lineDelays.sort(function (a, b) {return a.sortOrder - b.sortOrder; });

    description = 'Delays on ';
    if (lineDelays.length > 0) {
        description += 'the ';
        remainingDelayed = lineDelays.length + ((routeDelays.length > 0) ? 1 : 0);
        _(lineDelays).each(function (d) {
            remainingDelayed -= 1;
            switch (remainingDelayed) {
            case 0:
                description += st.lib.process.formatDelay(d);
                break;
            case 1:
                if (lineDelays.length === 1) {
                    description += st.lib.process.formatDelay(d) + ' and ';
                } else {
                    description += st.lib.process.formatDelay(d) + ', and ';
                }
                break;
            default:
                description += st.lib.process.formatDelay(d) + ', ';
                break;
            }
        });
    }

        //Create list of bus delays
    if (routeDelays.length > 0) {
        description += (routeDelays.length === 1) ? 'route ' : 'routes ';
        remainingDelayed = routeDelays.length;
        _(routeDelays).each(function (d) {
            remainingDelayed -= 1;
            switch (remainingDelayed) {
            case 0:
                description +=  st.lib.process.formatDelay(d);
                break;
            case 1:
                description += st.lib.process.formatDelay(d) + ' and ';
                break;
            default:
                description += st.lib.process.formatDelay(d) + ', ';
                break;
            }
        });
    }

    description += '.';
    newAlert.set({description: description});

    return newAlert;
};

st.lib.process.currentServiceAlertsCD = function (alerts) {
    var alertsOut = new st.c.Alerts(),   //Output builder.
        delayAlerts = new st.c.Alerts();

    alertsOut.order = 'byRoute';

    alertsOut.add(alerts.filter(function (al) {
        return (al.get('isService') &&
                al.get('isCurrent') &&
                (al.get('isLocal') || al.get('isSubway') || al.get('isSystemwide')) &&
                (al.get('disruptionType') !== 'Delay' ||
                    al.get('isSystemwide') ||
                    (al.get('isLocal') && al.get('isSubway'))));
    }));

    delayAlerts.add(alerts.filter(function (al) {
        return (al.get('isService') &&
                al.get('isCurrent') &&
                (al.get('isLocal') || al.get('isSubway')) &&
                (!al.get('isLocal') || !al.get('isSubway')) &&
                al.get('disruptionType') === 'Delay' &&
                !al.get('isSystemwide'));
    }));

    if (delayAlerts.length > 0) {
        alertsOut.add(st.lib.process.combinedDelayAlert(delayAlerts));
    }

    return alertsOut.toArray();
};

st.lib.mbta.combineRoutesAndLocal = function (agency) {
    //TODO will need to handle array of localRoutes
    var routeList = [];
    if (agency.get('routesSource') === undefined) {
        //TODO it would be better if this built a route list from locals
        agency.get('routes').reset();
    } else {
        routeList = agency.get('routesSource').toArray();
        _(agency.get('localRoutesCollections')).each(function (l) {
            _(routeList).each(function (r) {
                if (agency.get(l).findWhere({txid: r.get('txid')})) {
                    r.set({isLocal: true}, {async: true});
                }
            });
        });
        agency.get('routes').reset(routeList);
    }
};

st.lib.mbta.combineAlertsAndRoutes = function (alerts, routes) {
    var alertList = alerts.toArray();
    _(alertList).each(function (t) {
        t.get('affecteds').each(function (a) {
            if (routes.findWhere({txid: a.get('txid')})) {
                a.set(routes.findWhere({txid: a.get('txid')}).toJSON());
            }

            if (a.get('isLocal')) {
                t.set({isLocal: true});
            }
        });
    });
    return alertList;
};

st.lib.mbta.chooseNextDepartures = function (agency) {
    var deps = new st.c.Departures(),
        nextDeps = new st.c.Departures();

    _(agency.get('departuresCollections')).each(function (d) {
        deps.push(agency.get(d).toArray()); //TODO need to test this
    });

    nextDeps.order = 'presentationOrder';
    deps.order = 'predictionTimeOrder';
    deps.sort();

    deps.each(function (dep) {
        if (agency.get('routes').findWhere(
                {
                    txid: dep.get('route').get('txid')
                }
            )) {
            dep.get('route').set(agency.get('routes').findWhere(
                {
                    txid: dep.get('route').get('txid')
                }
            ).toJSON());
        }
        if (dep.get('isPrediction') && dep.isSoon() &&
                !(agency.get('destinationFilter') &&
                    agency.get('destinationFilter').test(
                        dep.get('destinationTitle')
                    )
                )) {
            if (!nextDeps.findWhere({serviceGroup: dep.get('serviceGroup')})) {
                nextDeps.add(dep);
            }
        }
    });

    agency.get('departures').reset(nextDeps.toArray());
};

var ScreenData = Backbone.Model.extend({
    defaults: {
        featuredAlertsSources: [],
        departuresSources: [],
        currentServiceAlertsCDSources: [],
        upcomingServiceAlertsSources: [],
        elevatorAlertsSources: [],
        featuredAlerts: undefined,
        departures: undefined,
        currentAlerts: undefined,
        upcomingServiceAlerts: undefined,
        elevatorAlerts: undefined
    },
    initialize: function () {
        this.set('featuredAlerts', new st.c.Alerts());
        this.set('departures', new st.c.Departures());
        this.set('currentServiceAlertsCD', new st.c.Alerts());
        this.set('upcomingServiceAlerts', new st.c.Alerts());
        this.set('elevatorAlerts', new st.c.Alerts());
    },
    refresh: function (coll) {
        var newColl = [];
        _(this.get(coll + 'Sources')).each(function (c) {
            newColl = newColl.concat(c.toArray());
        });
        this.get(coll).reset(newColl);
    },
});

st.screenData = new ScreenData();

var ScreenModel = Backbone.Model.extend({
    defaults: {
        titleText: ''
    }
});

st.screenModels.departures = new ScreenModel({
    titleText: 'Departures',
    titleFormat: 'CSS_DeparturesTitle',
    routeColHeader: 'Route',
    destinationColHeader: 'Destination',
    minutesAwayColHeader: 'Mins',
    collection: st.screenData.get('departures')
});
st.screenModels.currentServiceAlertsCD = new ScreenModel({
    titleText: 'Service Updates',
    titleFormat: 'CSS_CurrentAlertsTitle',
    collection: st.screenData.get('currentServiceAlertsCD')
});
st.screenModels.upcomingServiceAlerts = new ScreenModel({
    titleText: 'Coming Up',
    titleFormat: 'CSS_UpcomingAlertsTitle',
    collection: st.screenData.get('upcomingServiceAlerts')
});

st.screenModels.elevatorAlerts = new ScreenModel({
    titleText: 'Elevators Unavailable',
    titleFormat: 'CSS_ElevatorAlertsTitle',
    collection: st.screenData.get('elevatorAlerts')
});

st.lib.carousel.showSlide = function (showViews, allViews) {
    var hasContent = false;
    _(allViews).each(function (v) {
        if (_(showViews).contains(v)) {
            v.$el.show();
            v.render();
            if (v.$el.html() !== '') {
                hasContent = true;
            }
        } else {
            v.$el.hide();
        }
    });
    if (hasContent) {
        $('#status').hide();
    } else {
        $('#status').html('No information is available at this time.');
        $('#status').show();
    }
};

st.lib.carousel.spin = function (primary, allSecondaries, standalone) {
    var totalHeights = 0,
        comboHeight = 0,
        screenHeight = window.innerHeight,
        allViews = [],
        showViews = [],
        someSecondaries = [],
        t = 0,
        nextSlideInfo = {};
    if (standalone) {
        _(allViews).push(standalone);
    }
    allViews.push(primary);
    allViews = allViews.concat(allSecondaries);
    someSecondaries = _(allSecondaries).filter(
        function (v) {return v.hasContent; }
    );
    if (standalone && standalone.hasContent) {
        st.lib.carousel.showSlide([standalone], allViews);
        t += 10000;
    }

    totalHeights = _(someSecondaries).reduce(function (memo, view) {
        return view.lastHeight + memo;
    }, primary.lastHeight);

    if (totalHeights <= screenHeight || someSecondaries.length === 0) {
        showViews.push(primary);
        _(someSecondaries).each(function (s) {
            showViews.push(s);
        });
        setTimeout(function () {
            st.lib.carousel.showSlide(showViews, allViews);
        }, t);
        if (t === 0) {t = 1000; } else {t += 10000; }
        setTimeout(function () {
            st.lib.carousel.spin(primary, allSecondaries, standalone);
        }, t);
        return;
    }


    comboHeight = primary.lastHeight;
    comboHeight += _(someSecondaries).reduce(function (memo, view) {
        return Math.max(view.lastHeight, memo);
    }, 0);
    if (comboHeight < screenHeight) {
        t = _(someSecondaries).reduce(function (memo, view) {
            setTimeout(function () {
                st.lib.carousel.showSlide([primary, view], allViews);
            }, memo);
            return memo + 10000;
        }, t);
        setTimeout(function () {
            st.lib.carousel.spin(primary, allSecondaries, standalone);
        }, t);
        return;
    }


    nextSlideInfo = _(someSecondaries).reduce(function (memo, view) {
        if (memo.height + view.lastHeight <= screenHeight) {
            memo.views.push(view);
            memo.height += view.lastHeight;
            return memo;
        }
        setTimeout(function () {
            st.lib.carousel.showSlide(memo.views, allViews);
        }, memo.t);
        return {views: [view], height: view.lastHeight, t: memo.t + 10000};
    }, {views: [primary], height: primary.lastHeight, t: t});

    t = nextSlideInfo.t;
    if (nextSlideInfo.views.length > 0) {
        setTimeout(function () {
            st.lib.carousel.showSlide(nextSlideInfo.views, allViews);
        }, t);
        t += 10000;
    }
    setTimeout(function () {
        st.lib.carousel.spin(primary, allSecondaries, standalone);
    }, t);
    //FUTURE WORK make timing configurable
    st.sign.lastUpdated = Date.now();
};

st.lib.speak = function () {
    var textList = [];
    if (st.sign.get('speech') !== 'mespeak' && speechSynthesis.speaking) {
        speechSynthesis.cancel();
        return;
    }
    if (st.sign.get('speech') === 'mespeak' && st.speakingState) {
        st.haltSpeech = true;
        return;
    }
    _([
        st.screenViews.departures,
        st.screenViews.currentAlerts,
        st.screenViews.upcomingAlerts,
        st.screenViews.elevatorAlerts
    ]).each(function (v) {
        textList = textList.concat(v.speechScript);
    });
    st.lib.speakTextList(textList);
};


st.lib.startSpeechSocket = function () {
    st.speechSocket = io.connect();

    // st.speechSocket.on('speak', st.lib.speak);
    st.speechSocket.on('speak', function (data) {
        st.lib.speak();
    });

    // st.speechSocket.on('message', function (message) {
    //     console.log(message.text);
    // });

    // st.speechSocket.on('joinResult', function (data) {
    //     console.log('joinResult event');
    //     console.log(data);
    // });

    st.speechSocket.emit('join', {newChannel: st.sign.get('signId')});
};

st.m.Screenshot = Backbone.Model.extend({
    defaults: {
        upToDate: false,
        serverId: -1,
        actualText: '',
        genericText: '',
        firstShown: Date(0),
        lastShown: Date(0),
        totalShown: 1,
        shownSinceSync: 1
        // removeScripts: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        // genericize: [
        //     { regex: /^.*display: none.*$/gm, replacement: '' },
        //     //Replace countdown minute digits with 0 or 00 for consolidation
        //     {
        //         regex: /(<td class="minutes_away"[^>]{0,25}>)[0-9]/g,
        //         replacement: '$10'
        //     },
        //     {
        //         regex: /(<td class="minutes_away"[^>]{0,25}>)0[0-9]/g,
        //         replacement: '$100'
        //     },
        //     //Set clock to 12:34, for consolidation. 
        //     {
        //         regex: /<div id="clock">[\d\:]{4,5}<\/div>/,
        //         replacement: '<div id="clock">12:34</div>'
        //     }
        // ]
    },
    initialize: function () {
        var genericize, postProcessers;
        this.set({firstShown: Date.now(), lastShown: Date.now()});
        postProcessers = this.get('postProcessers') || [
            {
                regex: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
                replacement: ''
            },
            {
                regex: /<div id="departures" style="display: none;">[\d\D\n\r]*<div id="currentAlerts/,
                replacement: '<div id="currentAlerts'
            },
            {
                regex: /<div id="currentAlerts" style="display: none;">[\d\D\n\r]*<div id="upcomingAlerts/,
                replacement: '<div id="upcomingAlerts'
            },
            {
                regex: /<div id="upcomingAlerts" style="display: none;">[\d\D\n\r]*<div id="elevatorAlerts/,
                replacement: '<div id="elevatorAlerts'
            },
            {
                regex: /<div id="elevatorAlerts" style="display: none;">[\d\D\n\r]*<div id="status/,
                replacement: '<div id="status'
            },
            {
                regex: /<body onload="init()">/,
                replacement: '<body>'
            }
        ];

        genericize = this.get('genericize') || [
            { regex: /^.*display: none.*$/gm, replacement: '' },
            //Replace countdown minute digits with 0 or 00, for consolidation.
            {
//To keep more records, eliminate the {1,2} and uncomment next section
                regex: /(<td class="minutes_away"[^>]{0,25}>)[0-9]{1,2}/g,
                replacement: '$10'
            },
            // {
            //     regex: /(<td class="minutes_away"[^>]{0,25}>)0[0-9]/g,
            //     replacement: '$100'
            // },
            //Set clock to 12:34, for consolidation. 
            {
                regex: /<div id="clock">[\d\:]{4,5}<\/div>/,
                replacement: '<div id="clock">12:34</div>'
            },

        ];
        if (this.get('actualText') === '') {
            this.set({actualText: '<!DOCTYPE html>' + $('html')[0].outerHTML });
        }
        this.set({actualText:
                _(postProcessers).reduce(function (state, tx) {
                return state.replace(tx.regex, tx.replacement);
            }, this.get('actualText'))
            });

        this.set({genericText:
                _(genericize).reduce(function (state, tx) {
                return state.replace(tx.regex, tx.replacement);
            }, this.get('actualText'))
            });
    },
    updateCount: function () {
        this.set({
            upToDate: false,
            lastShown: Date.now(),
            totalShown: this.get('totalShown') + 1,
            shownSinceSync: this.get('shownSinceSync') + 1
        });
    },
    sync: function () {
        if (this.get('serverId') === -1) {
            $.ajax({
                url: 'postsample',
                method: 'POST',
                dataType: 'json',
                data: JSON.stringify({
                    sign: this.get('signId'),
                    serverId: this.get('serverId'),
                    actualText: this.get('actualText'),
                    firstShown: this.get('firstShown'),
                    lastShown: this.get('lastShown'),
                    shownSinceSync: this.get('shownSinceSync')
                }),
                context: this,
                success: function (resp) {
                    this.set({
                        serverId: resp,
                        shownSinceSync: 0,
                        upToDate: true
                    });
                },
                error: function (req, status, err) {
                    st.logger.log('st.m.Screenshot sync 1', status + ' ' + err);
                }
            });
            return this;
        }
        //else: send just the latest stats
        $.ajax({
            url: 'postsamplestat',
            method: 'POST',
            dataType: 'json',
            data: JSON.stringify({
                sign: st.sign.get('signId'),
                serverId: this.get('serverId'),
                shownSinceSync: this.get('shownSinceSync'),
                lastShown: this.get('lastShown')

            }),
            success: function (resp) {
                if (!isNaN(resp)) {
                    this.set({serverId: resp});
                    //REMAINING WORK this produces an error.
                }
            },
            error: function (req, status, err) {
                st.logger.log('st.m.Screenshot sync 2', status + ' ' + err);
            }
        });
        this.set({
            shownSinceSync: 0,
            upToDate: true
        });

    }
});

st.c.Screenshots = Backbone.Collection.extend({
    model: st.m.Screenshot,
    order: 'genericText'
});

st.m.ScreenshotManager = Backbone.Model.extend({
    defaults: {
        allScreenshots: new st.c.Screenshots(),
        takeScreenshotFreq: 10000,
        syncScreenshotFreq: 60000,
        maxScreenshots: 1000
    },
    initialize: function () {
        this.takeScreenshot = _.bind(this.takeScreenshot, this);
        this.syncScreenshot = _.bind(this.syncScreenshot, this);
        this.cleanupScreenshots = _.bind(this.cleanupScreenshots, this);

        setInterval(function (self) {
            return self.takeScreenshot;
        }(this), this.get('takeScreenshotFreq'));

        setInterval(function (self) {
            return self.syncScreenshot;
        }(this), this.get('syncScreenshotFreq'));
    },
    takeScreenshot: function () {
        var newShot, oldShot;
        if (this.get('allScreenshots').length > this.get('maxScreenshots')) {
            this.cleanupScreenshots();
        }
        newShot = new st.m.Screenshot();
        oldShot = this.get('allScreenshots').findWhere(
            {
                genericText: newShot.get('genericText')
            }
        );
        if (oldShot) {
            oldShot.updateCount();
            return;
        }
        this.get('allScreenshots').push(newShot);
    },
    syncScreenshot: function () {
        var unsentShot;
        unsentShot = this.get('allScreenshots').findWhere({serverId: -1});
        if (unsentShot) {
            unsentShot.sync();
        }
        _(this.get('allScreenshots').where({upToDate: false})).each(
            function (x) {
                if (x.get('serverId') >= 0) {
                    x.sync();
                }
            }
        );
    },
    cleanupScreenshots: function () {
        var cutoff = this.get('allScreenshots').min(function (model) {
            return model.get('lastShown');
        });
        cutoff = (cutoff + Date.now()) / 2;
        this.set({
            allScreenshots: this.get('allScreenshots').filter(function (x) {
                return x.get('lastShown') < cutoff && !x.get('upToDate');
            })
        });
    }
});

/*
a ScreenshotManager has: 
Screenshots allScreenShots
int takeScreenshotFreq default 10000
int sendScreenshotFreq default 60000
maxScreenShot default 1000
initialize: 
 - schedule takeScreenshot
 - schedule sendScreenshot
takeScreenshot
 - takes a screenshot
 - is it in allScreenshots? 
   - update it.
 - else
    - add it. 
 - if allScreenShots.length > maxScreenShotSize then cleanupScreenShot
sendScreenShot
 - Use filter to get one unsent screenshot; send it
 - Use (not filter, what?) to get any not-up-to-date screenshot; send the update
cleanupScreenShot
 - identify the oldest lastShown
 - get the average of lastShown & now
 - delete any ScreenShot from allScreenShots earlier than that time
 - log the deletion
*/

st.lib.filterProperties = function (obj, name, separater) {
    var newObj, testExp, newPropName, prop;
    separater = separater || '';
    testExp = new RegExp('^' + name + separater + '(.*)');
    newObj = {};

    for (prop in obj) {
        if (obj.hasOwnProperty(prop) && testExp.test(prop)) {
            newPropName = prop.replace(testExp, '$1');
            newObj[newPropName] = obj[prop];
        }
    }
    return newObj;
};

st.lib.signStart = function (signConfig) { //Should this be creation of sign object?
    if (signConfig.speechTrigger === undefined) {
        signConfig.speechTrigger = 83;
    }
    if (!isNaN(signConfig.speechTrigger)) {
        var reactKey = function (evt) {
            if (evt.keyCode === 83) {
                st.lib.speak();
            }
        };
        document.onkeydown = function (key) { reactKey(key); };
    } else if (signConfig.speechTrigger === 'socket') {
        st.lib.startSpeechSocket();
    }

    st.clock = new st.v.Clock();

    st.lib.carousel.spin(st.screenViews.departures,
        [
            st.screenViews.currentAlerts,
            st.screenViews.upcomingAlerts,
            st.screenViews.elevatorAlerts
        ]);

    st.screenshots = new st.m.ScreenshotManager({syncScreenshotFreq: 30000});

    if (signConfig && signConfig.speech === 'mespeak') {
        st.sign.set({speech: 'mespeak'});
        meSpeak.loadConfig("/sign/software/mespeak/mespeak_config.json");
        meSpeak.loadVoice('/sign/software/mespeak/voices/en/en-us.json');
    }
};

st.lib.loadStart = function () {
    var signId = window.location.search.replace(/[\?\&]id=([^\?\&]*)/i, '$1');

    // var signId;
    $('#status').html('Loading...');
    st.sign = new st.m.Sign(
        {
            signId: signId,
            heartbeatRate: 60000,
        }
    );

    $.get('getsignconfig?id=' + st.sign.get('signId'))
        .done(function (data) {
            var configData,
                agencyConfig,
                signConfig;
            configData = JSON.parse(data);
            _(configData.agencies).each(function (aName) {
                agencyConfig = st.lib.filterProperties(configData, aName, '_');
                st.agencies[aName] = new Agency(agencyConfig);
            });
            signConfig = st.lib.filterProperties(configData, 'sign', '_');
            st.lib.signStart(signConfig);
        })
        .fail(function () {
            setTimeout(function () {st.lib.loadStart();}, 10000);
            // st.logger.log('st.lib.loadStart', 'getsignconfig failed');
        });
};

var init = function () {
    // var signId;
    // $('#status').html('Loading...');
    // st.sign = new st.m.Sign(
    //     {
    //         signId: 'DEFAULT_SIGN_ID',
    //         heartbeatRate: 60000,
    //     }
    // );

    st.v.DepartureView = Backbone.View.extend({
        tagName: 'tr',
        template: _.template($('#departure-template').html()),
        initialize: function () {
            this.listenTo(this.model, 'reset sync', this.render);
            this.render();

        },
        render: function () {
            var obj = this.model.toJSON(),
                html;
            obj.minsAway = this.model.minsAway();
            obj.route = this.model.get('route').toJSON();
            html = this.template(obj);
            this.$el.html(html);
            return this;
        }
    });


    st.v.DeparturesView = Backbone.View.extend({
        el: '#departures',
        template: _.template($('#departures-list-template').html()),
        initialize: function () {
            this.listenTo(this.model, 'reset sync', this.render);
            if (this.model.get('collection') !== undefined) {
                this.listenTo(
                    this.model.get('collection'),
                    'reset sync',
                    this.render
                );
            }
            this.lastHeight = 0;
            this.fontSize = 100;
            this.hasContent = false;
            this.speechScript = [];
            this.render();
        },
        render: function () {
            var html;
            this.speechScript = [];
            if (this.model === undefined ||
                    this.model.get('collection') === undefined ||
                    this.model.get('collection').length === 0) {
                this.$el.html('');
                this.lastHeight = 0;
                this.hasContent = false;
                return this;
            }
            this.hasContent = true;
            html = this.template(this.model.toJSON());
            this.fontSize = 100;
            this.$('tbody').css('fontSize', this.fontSize + '%');
            this.$el.html(html);
            this.speechScript.push(this.model.get('titleText'));
            this.model.get('collection').each(function (x) {
                var item = new st.v.DepartureView(
                    {model: x, className: x.get('route').get('mode')}
                );
                this.$('tbody').append(item.render().$el);
                this.speechScript.push(
                    x.get('route').get('longName').replace('/', ' ') + ' ' +
                        x.get('destinationTitle') + ', ' +
                        x.minsAway() +
                        (x.minsAway() === 1 ? ' minute' : ' minutes')
                );
            }, this);
            this.lastHeight = Math.max(this.$el.height(), 1);
            while (this.fontSize > 1 && this.lastHeight > window.innerHeight) {
                this.fontSize -= 1;
                this.$('tbody').css('fontSize', this.fontSize + '%');
                this.lastHeight = Math.max(this.$el.height(), 1);
            }
            return this;
        }
    });

    st.v.AlertViewSimple = Backbone.View.extend({
        tagName: 'div',
        className: 'alert',
        template: _.template($('#alert-template-simple').html()),
        initialize: function () {
            this.listenTo(this.model, 'reset sync', this.render);
            this.render();
        },
        render: function () {
            var html;
            html = this.template();
            this.$el.html(html);
            return this;
        }
    });

    st.v.AlertViewTimeframe = Backbone.View.extend({
        tagName: 'div',
        className: 'alert',
        template: _.template($('#alert-template-timeframe').html()),
        initialize: function () {
            this.listenTo(this.model, 'reset sync', this.render);
            this.render();
        },
        render: function () {
            var html;
            html = this.template();
            this.$el.html(html);
            return this;
        }
    });

    st.v.AlertViewElevator = Backbone.View.extend({
        tagName: 'div',
        className: 'alert',
        template: _.template($('#alert-template-elevator').html()),
        initialize: function () {
            this.listenTo(this.model, 'reset sync', this.render);
            this.render();
        },
        render: function () {
            var html;
            html = this.template();
            this.$el.html(html);
            return this;
        }
    });


    st.v.AlertsView = Backbone.View.extend({
        template: _.template($('#alerts-list-template').html()),
        initialize: function (options) {
            this.options = options;
            this.listenTo(this.model, 'reset sync', this.render);
            if (this.model.get('collection') !== undefined) {
                this.listenTo(
                    this.model.get('collection'),
                    'reset sync',
                    this.render
                );
            }
            this.hasContent = false;
            this.lastHeight = 0;
            this.fontSize = 100;
            this.speechScript = [];
            this.render();
        },
        render: function () {
            var html;
            this.speechScript = [];
            if (this.model === undefined ||
                    this.model.get('collection') === undefined ||
                    this.model.get('collection').length === 0) {
                this.$el.html('');
                this.hasContent = false;
                this.lastHeight = 0;
//NB remains to be seen if 0 is the right value
//had been "offsetHeight" in earlier version but that's not available
                return this;
            }
            this.hasContent = true;
            html = this.template();
            this.$el.html(html);
            this.fontSize = 100;
            this.$('.alerts-list').css('fontSize', this.fontSize + '%');
            this.speechScript.push(this.model.get('titleText'));
            this.model.get('collection').each(function (x) {
                var item = new this.options.AlertView(
                    {model: x}
                );
                this.$('.alerts-list').append(item.render().$el);
                this.speechScript.push(x.get('description'));
            }, this);

//FUTURE WORK the +23 is a hack to account for the margin at the bottom of the 
//last alert; should be fixed
////Had been "offsetHeight" in an earlier version but 
///that didn't seem to translate
            this.lastHeight = this.$el.height() + 23;
//NB remains to be seen if 23 is the right value
//had been "offsetHeight" in earlier version but that's not available
            while (this.fontSize > 1 && this.lastHeight > window.innerHeight) {
                this.fontSize -= 1;
                this.$('.alerts-list').css('fontSize', this.fontSize + '%');
                this.lastHeight = Math.max(this.$el.height(), 1);
            }
            return this;
        },
    });


    st.screenViews.departures = new st.v.DeparturesView({
        model: st.screenModels.departures
    });

    st.screenViews.currentAlerts = new st.v.AlertsView({
        el: '#currentAlerts',
        model: st.screenModels.currentServiceAlertsCD,
        AlertView: st.v.AlertViewSimple
    });

    st.screenViews.upcomingAlerts = new st.v.AlertsView({
        el: '#upcomingAlerts',
        model: st.screenModels.upcomingServiceAlerts,
        AlertView: st.v.AlertViewTimeframe
    });

    st.screenViews.elevatorAlerts = new st.v.AlertsView({
        el: '#elevatorAlerts',
        model: st.screenModels.elevatorAlerts,
        AlertView: st.v.AlertViewElevator
    });


    st.lib.loadStart();
};

//FUTURE WORK rather than each agency maintaining a list of so many kinds of 
//alerts,
//maybe it should just have one list of alerts. let the view do the filtering.
//the combined delays are the tricky part. 

