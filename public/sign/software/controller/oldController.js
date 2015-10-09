/*jslint devel: true nomen: true regexp: true indent: 4 */
/*global b, c, XMLHttpRequest, SpeechSynthesisUtterance, speechSynthesis, document, window, _, $, Backbone */

//
//
//  ********************* BEGIN CONTROLLER  *********************
//  
// 



/**
 * Expand underscore library: 
 * Capitalizes first letter of string. 
 * @return {string} input string, with first letter capitalized. 
 */
_.mixin({
    capitalize: function (string) {
        'use strict';
        return string.charAt(0).toUpperCase() + string.substring(1);
    }
});


/**
 * d is for datasources. 
 * The latest information from agencies in its original format,
 * and the means to retrieve it.
 * @type {Object}
 */
var d = {};

/**
 * f is for facet.
 * The different information about transit service, at various stages of
 * filtering and processing. 
 * @type {Object}
 */
var f = {};

/**
 * v is for visual element.
 * The transit information on the page. 
 * @type {Object}
 */
var v = {};

var views = {};
/**
 * generators are functions that create facets from other facets or 
 * from datasources. 
 * @type {Object}
 */
var generators = {};

/**
 * visualizers are functions to display facets in visual elements. 
 * @type {Object}
 */
var visualizers = {};

/**
 * vocalizers are functions to describe the information in facets with speech.
 * @type {Object}
 */
var vocalizers = {};

/**
 * list of all visual elements on the page. 
 * @type {Array}
 */
var allVisualElements = [
    'featuredAlerts',
    'departures',
    'currentAlerts',
    'upcomingAlerts',
    'elevatorAlerts',
    'welcome'];

var AgencyComponent = Backbone.Model.extend({
    defaults: {
        modelType: 'AgencyComponent',
        txid: '',
        name: '',
    },
    regexes: function () {
        'use strict';
        return [new RegExp('\\b(' + this.escape('name') + ')\\b', 'gi')];
    }
});

var Route = AgencyComponent.extend({
    defaults: {
        modelType: 'Route',
        mode: 'Bus',
        //name              //1         Red line    Green Line C        Silver Line SL1
        longName: '',       //Route 1   Red Line    Green Line C branch Silver Line SL1 branch
        trunkName: '',      //1         Red Line    Green Line          Silver Line
        branchName: '',     //''        ''          C                   SL1
        shortName: '',      //1         Red         C                   SL1
        color: '',
        isMode: false,
        isLocal: false,
        isHidden: false,
        sortOrder: 0,
    },
    initialize: function () {
        'use strict';
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
                this.set({shortName: this.get('branchName')}); //TODO take only the beginning? This includes a "Short name" of "waterfront"
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
        'use strict';
        var r = [],
            names = ['longName', 'name', 'trunkName', 'branchName', 'shortName'];

        _(names).each(function (i) {
            if (this.get(i) !== undefined && this.escape(i) !== '') {
                _(r).push(new RegExp('\\b(' + this.escape(i) + ')\\b', 'gi'));
            }
        }, this);
        return _(r).uniq();
    }
});

var Stop = AgencyComponent.extend({
    defaults: {
        modelType: 'Stop',
        color: '',
        childName: undefined,
        parentName: undefined,
        isLocal: false,
    },
    initialize: function () {
        'use strict';
        if (this.get('name') === undefined || this.get('name') === '') {
            this.set({name: this.get('parentName') || this.get('childName')});
        }
    },
    regexes: function () {
        'use strict';
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

var AccessFeature = AgencyComponent.extend({
    defaults: {
        modelType: 'AccessFeature',
        color: '#80AAFF',
        type: '',
        stationName: '',
    }
});


var Routes = Backbone.Collection.extend({
    model: Route,
    comparator: 'sortOrder'
});

var AgencyComponents = Backbone.Collection.extend({
    model: AgencyComponent
});

var Alert = Backbone.Model.extend({
    defaults: {
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
        'use strict';
        this.set({affecteds: new AgencyComponents()});
    },
    getFormatted: function (propName) {
        //have an array: Route, Stop, AccessFeature.
        //Use that to try routes; if there are no changes try stops; etc. 
        //Should each Route, Stop etc be able to produce its own list of regular
        //expressions? Should they have their own "highlight" function?
        'use strict';
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
                        if (allRegexes[i][j].regexes[k].test(input) &&
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
/*
        return _(allRegexes).reduce(function (memo, componentType) {
            if (memo.success) return memo;
            memo = _(componentType).reduce(function (memo2, AgencyComponent) {

            }, memo);
        }, {output: input, success: false}).output;
        console.log('allRegexes for ' + this.get('txid'));
        console.log(allRegexes);
*/
        return input;
    }
});

var Alerts = Backbone.Collection.extend({
    model: Alert,
    order: 'txid',
    comparator: function (model) {
        'use strict';
        switch (this.order) {
        case 'byRoute':
            return model.get('affecteds').first().get('sortOrder');
        case 'byTime':
            return model.get('startTime') * 100000000000000000 +
                    model.get('endTime');
        case 'byElevatorStation':
            return model.get('affecteds')
                    .findWhere({modelType: 'AccessFeature'})
                    .get('stationName');
        default:
            return model.get(this.order);
        }
    }
});

/**
 * A departure from this location, scheduled and/or predicted. 
 */
var Departure = Backbone.Model.extend({
    defaults: {
        route: undefined,
        direction: undefined,
        tripId: undefined,
        serviceGroup: undefined,
        destinationTitle: '',
        destinationSubtitle: '',
        scheduledTime: 0,
        predictedTime: 0,
        time: 0,
        isPrediction: false
    },
    initialize: function () {
        'use strict';
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
     * and no more than 99 minutes in the future.
     * @return {Boolean} is departure soon.
     */
    isSoon: function () {
        //Departure is "soon" if it's no more than one minute in the past
        //and no more than 99 minutes in the future.
        'use strict';
        return (Date.now() - 60000 < this.get('time') &&
                this.get('time') < Date.now() + 5940000);
    },
    /**
     * Returns an integer number of minutes to display. 
     * @return {[type]} minutes away (integer)
     */
    minsAway: function () {
        'use strict';
        return Math.max(Math.floor((this.get('time') - Date.now()) / 60000), 0);
    },
    //TODO the following should be moved to a view. 
    /**
     * Returns string suitable for speech synthesis. 
     * @return {string} String for speech synthesis. 
     */
    vocalize: function () {
        'use strict';
        var text = '', minutes = this.minsAway();
        if (this.route.mode === 'Bus') {
            text += 'Route ';
        }
        text += this.route.name.replace('/', ' ') + ' ' + this.destinationTitle + ', ';
        text += minutes + (minutes === 1 ? ' minute' : ' minutes');
        return text;
    }
});

var Departures = Backbone.Collection.extend({
    model: Departure,
    order: 'routeOrder',
    comparator: function (a, b) {
        'use strict';
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
    }
});

var DeparturesView = Backbone.View.extend({
    el: 'departures',
    initialize: function () {
        'use strict';
        this.listenTo(this.collection, 'sync change', this.render);
    },

});

/**
 * A departure from this location, scheduled and/or predicted. 
 * @param {Route} route               The Route of the departure
 * @param {string} direction           Direction (Inbound, westbound, etc.)
 * @param {string} tripId              Unique identifier for trip
 * @param {string} destinationTitle    Destination, i.e. "Harvard."
 * @param {string} destinationSubtitle Add'l route info, i.e. "via Mass Ave"
 * @param {date} scheduledTime         Scheduled time, if applicable.
 * @param {date} predictedTime         Predicted time, if applicable. 
 */

/**
 * A source of transit data from an API.
 * @param {object} dconfig A configuration object containing properties 
 *                         noted below. 
 */
var Datasource = function (dconfig) {
    'use strict';
    this.id = dconfig.id;           //string identifying this Datasource. 
    this.format = dconfig.format;   //NextBus, MBTA-realtime, etc. 
    this.maxAge =  dconfig.maxAge;  //Maximum age before data refresh.
    this.URL = dconfig.URL;         //URL to access data.
    this.isReady = false;           //Whether data is currently available (no.)
    this.lastUpdated = 0;           //When data was last updated (never.)
    this.data = {};                 //The data itself (none yet.)
};

Datasource.prototype = {
    //Datasource.prototype handleUpdateError()
    //Logs a warning or error of update failing.
    //If data is now TWICE as old as it should be, remove it.

    /**
     * Logs a warning or error of update failing.
     * If data is now TWICE as old as it should be, removes it.
     * @param  {string} e1 error message part 1
     * @param  {string} e2 error message part 2
     */
    handleUpdateError: function (e1, e2) {
        'use strict';
        if (this.lastUpdated + (this.maxAge * 2) < Date.now()) {
            console.log('Datasource.handleUpdateError',
                'Could not update. Data too old now. '
                + this.ident + ': ' + e1 + ' ' + e2);
            // log.info('Datasource.handleUpdateError',
            //     'Could not update. Data too old now. '
            //     + this.ident + ': ' + e1 + ' ' + e2);
            this.isReady = false;
            this.data = {};
        } else {
            console.log('Datasource.handleUpdateError',
                'could not update. Will use old data. '
                + this.id + ': ' + e1 + '; ' + e2);
            // log.info('Datasource.handleUpdateError',
            //     'could not update. Will use old data. '
            //     + this.id + ': ' + e1 + '; ' + e2);
        }
    },
    /**
     * Updates a datasource with format MBTA-realtime.
     */
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
    /**
     * Updates this datasource.
     * @param  {bool} forceUpdate Forces the update to happen even if data
     *                            is not yet too old. 
     */
    update: function (forceUpdate) {
        'use strict';
//        try {
        if (forceUpdate || this.lastUpdated + this.maxAge < Date.now()) {
            switch (this.format) {
            case 'MBTA_realtime':
                this.update_MBTA_realtime();
                break;
            default:
                console.error('Datasource.update',
                    this.ident + ' has unsupported format ' + this.format);
                // log.criticalError('Datasource.update',
                //     this.ident + ' has unsupported format ' + this.format);
            }
        }
//        } catch (err) {
//            log.warning('Datasource.update, ', err);
//        }
    }
};

/**
 * Not for use. Logs a warning. 
 * @return {array} Returns an identical copy of the data. 
 */
generators.defaultGenerator = function () {
    'use strict';
    console.log('defaultGenerator' + 'run instead of ' + this.generatorFunction);
//    log.warning('defaultGenerator', 'run instead of ' + this.generatorFunction);
    return this.data;
};

/**
 * Filters the objects in the array for those matching the provided template. 
 * @return {array} Filtered data
 */
generators.objectsMatchATemplate = function () {
//can rewrite this to use _.filter
    'use strict';
    var i,
        source = f[this.requiredFacets.source].data,
        outputList = [],
        matchesOneOf = function (obj, templates) {
            var j;
            for (j = 0; j < templates.length; j += 1) {
                if (_(obj).isMatch(templates[j])) {
                    return true;
                }
            }
            return false;
        };
//    try {
    for (i = 0; i < source.length; i += 1) {
        if (matchesOneOf(source[i], this.parameters.templates)) {
            outputList.push(source[i]);
        }
    }
    return outputList;
//    } catch (err) {
//        log.error('generators.objectMatchATemplate', err);
//        return [];
//    }
};

/**
 * Creates a route list based on MBTA-realtime "routes" call input. 
 * Includes list of modes as well. 
 * Assigns a color, as color is not part of what's returned. 
 * @return {object} contains a list of routes, lookup byId, and lookup byName 
 */
generators.routesFromMBTARealtime = function () {
    'use strict';
    var i = 0,
        m,
        r,
        modes = d[this.requiredDatasources.MBTARealtimeRoutes].data.mode,
        routeList = new Routes(),
        pickColor = function (modeName, routeName) {
            switch (routeName) {
            case 'Green Line B':
            case 'Green Line C':
            case 'Green Line D':
            case 'Green Line E':
                return '#33FF33';
            case 'Red Line':
            case 'Mattapan Trolley':
//                return '#FF332C';
                return '#FF6464';
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

//    try {
    for (m = 0; m < modes.length; m += 1) {
        routeList.add({
            txid: 'mode_' + modes[m].mode_name,
            name: modes[m].mode_name,
            mode: modes[m].mode_name,
            color: pickColor(modes[m].mode_name, ''),
            isMode: true,
            sortOrder: i
        });
        i += 1;
    }
//    } catch (err) {
//        log.error('generators.routesFromMBTARealtime', '(mode loop 1) ' + err);
//    }

 //   try {
    for (m = 0; m < modes.length; m += 1) {
        for (r = 0; r < modes[m].route.length; r += 1) {
            routeList.add({
                txid: modes[m].route[r].route_id,
                name:   modes[m].route[r].route_name,
                mode:   modes[m].mode_name,
                color: pickColor(modes[m].mode_name,
                            modes[m].route[r].route_name),
                isHidden: modes[m].route[r].route_hide,
                sortOrder: i
            });
            i += 1;
        }
    }
 //   } catch (err) {
 //       log.error('generators.routesFromMBTARealtime', '(mode loop 2) ' + err);
 //       return {};
 //   }

    return routeList;
};

/**
 * Takes a list of agency routes and local routes, and returns 
 * One list of all routes, in which local routes are marked isLocal=true.
 */
generators.markRoutesAsLocal = function () {
    'use strict';
    var all = f[this.requiredFacets.allRoutes].data,
        local = f[this.requiredFacets.localRoutes].data;
//    try {
    all.each(function (element) {
        if (local.findWhere({txid: element.get('txid')}) !== undefined) {
            element.set({isLocal: true});
        }
    });
    return all;
//    } catch (err) {
//        log.error('generators.markRoutesAsLocal', err);
//        return [];
//    }
};

/**
 * Converts an MBTA-realtime alerts datasource into an alerts facet, 
 * using a routes facet to distinguish between alerts that affect 
 * service at this station and alerts that don't.
 * Assigns properties such as whether alert should be "featured,"
 * whether it's current or not, soon or not, etc. 
 *  
 * @return {[type]} [description]
 */
generators.alertsFromMBTARealtime = function () {
    'use strict';
    var sourceAlerts = d[this.requiredDatasources.mbtaRealtimeAlerts].data.alerts,
            //alerts input from MBTA-realtime. 
        agencyRoutes = f[this.requiredFacets.agencyRoutes].data,  //All routes
        newAlerts = new Alerts(), //Collection of new alerts is built here and returned
        newAlert,
        affected,
        color;

    _(sourceAlerts).each(function (source) {
        newAlert = new Alert({
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

        _(source.affected_services.services).each(function (el) {
            if (el.hasOwnProperty('route_id')) {
                affected = agencyRoutes.findWhere({txid: el.route_id});
            } else {
                affected = agencyRoutes.findWhere({
                    txid: 'mode_' + el.mode_name
                });
                newAlert.set({isSystemwide: true});
            }
            if (affected.get('isLocal')) { newAlert.set({isLocal: true}); }
            newAlert.get('affecteds').add(affected);

            //TODO verify that findWhere really works this way;
            //don't want to keep re-adding or overwriting
            if (el.hasOwnProperty('stop_id') &&
                    !newAlert.get('affecteds').findWhere({txid: el.stop_id})) {
                color = agencyRoutes.findWhere({txid: el.route_id}).get('color');
                affected = new Stop({
                    txid: el.stop_id,
                    childName: el.stop_name,
                    parentName: el.parent_station_name,
                    color: color
                });
                newAlert.get('affecteds').add(affected);
            }
            if (el.hasOwnProperty('direction_name')) {
                if (newAlert.get('affectedDirection') === '') {
                    newAlert.set({affectedDirection: el.direction_name});
                } else if (newAlert.get('affectedDirection')
                        !== el.direction_name) {
                    newAlert.set({affectedDirection: 'both'});
                }
            }
        });

        _(source.affected_services.elevators).each(function (el) {
            affected = new AccessFeature({
                txid: el.elev_id,
                name: el.elev_name,
                type: el.elev_type,
                stationName: _(el.stops).first().parent_station_name
            });
            newAlert.get('affecteds').add(affected);
            if (el.elev_type === 'Elevator') {
                newAlert.set({isElevator: true});
            }
            _(el.stops).each(function (stop) {
                affected = new Stop({
                    txid: stop.stop_id,
                    childName: stop.stop_name,
                    parentName: stop.parent_station_name
                });
                newAlert.get('affecteds').add(affected);
            });
        });

        if (_(source.affected_services.elevators)
                .isMatch({elev_type: 'Elevator'})) {
            newAlert.set({isElevator: true});
        }

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

        newAlerts.add(newAlert);
    });

    if (!newAlerts.findWhere({isFeatured: true})) {
        newAlerts.each(function (al) {
            al.isFeatured = (al.isSubway && al.isLocal
                    && al.isCurrent && al.isSevere);
        });
    }
    return newAlerts;
};


generators.formatDelay = function (delay) {
    'use strict';
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

generators.combineDelayAlerts = function (alerts) {
    //1.  For each alert, for each not-hidden route: 
    //    Generate the serviceName. 
    //    Is there a delayBundle with this serviceName? 
    //      If not, create one. 
    //          serviceName (chop off everything after "line")
    //          branch list (show 2 at most)
    //          direction list (show 1 at most)
    //          isRoute (if bus and doesn't contain "line")
    //          severity
    //          sort order
    //      If there is, modify it if necessary. 
    //          add to branch list?
    //          add to direction list?
    //          change severity to true?
    //      
    //      From there it's basically the same logic as before,
    //      but with "branch" thrown in to the formatting, 
    //      and isRoute instead of whether it's bus. 
    'use strict';
    var delays = [],
        routeDelays = [],
        lineDelays = [],
        delay,
        serviceName,
        isSevere,
        affectedDirection,
        remainingDelayed, //Remaining (not-yet-listed) delays
        description, //For alert being created,
        routes = new AgencyComponents(),
        newAlert;

    newAlert = new Alert({
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
                description += generators.formatDelay(d);
                break;
            case 1:
                if (lineDelays.length === 1) {
                    description += generators.formatDelay(d) + ' and ';
                } else {
                    description += generators.formatDelay(d) + ', and ';
                }
                break;
            default:
                description += generators.formatDelay(d) + ', ';
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
                description +=  generators.formatDelay(d);
                break;
            case 1:
                description += generators.formatDelay(d) + ' and ';
                break;
            default:
                description += generators.formatDelay(d) + ', ';
                break;
            }
        });
    }

    description += '.';
    newAlert.set({description: description});

    return newAlert;
};

generators.extractCurrentServiceAlertsCombiningDelaysAndSort = function () {
    'use strict';
    var a = f[this.requiredFacets.alerts].data,
        alertsOut = new Alerts(),   //Output builder.
        delayAlerts = new Alerts();


    //try {
    alertsOut.order = 'byRoute';

    alertsOut.add(a.filter(function (al) {
        return (al.get('isService') &&
                al.get('isCurrent') &&
                (al.get('isLocal') || al.get('isSubway')) &&
                (al.get('disruptionType') !== 'Delay' ||
                    al.get('isSystemwide') ||
                    (al.get('isLocal') && al.get('isSubway'))));
    }));

    delayAlerts.add(a.filter(function (al) {
        return (al.get('isService') &&
                al.get('isCurrent') &&
                (al.get('isLocal') || al.get('isSubway')) &&
                (!al.get('isLocal') || !al.get('isSubway')) &&
                al.get('disruptionType') === 'Delay' &&
                !al.get('isSystemwide'));
    }));

    if (delayAlerts.length > 0) {
        alertsOut.add(generators.combineDelayAlerts(delayAlerts));
    }

    return alertsOut;
 //   } catch (err) {
 //       log.error('generators.extractCurrentServiceAlertsCombiningDelaysAndSort', err);
 //       return [];
 //   }
};



/**
 * Extracts the upcoming ("soon") alerts from a list and sorts them. 
 * @return {array} List of alerts, all of which are "soon."
 */
generators.extractUpcomingServiceAlertsAndSort = function () {
    'use strict';
    var alertsOut = new Alerts(),
        a = f[this.requiredFacets.alerts].data;

//    try {
        /*
        alertsOut.comparator = function (a, b) {
            if (a.startTime !== b.startTime) {return a.startTime - b.startTime; }
            if (a.endTime !== b.endTime) {return a.endTime - b.endTime; }
            return a.get('affecteds').first().sortOrder
                    - b.get('affecteds').first().sortOrder;
        };
        */
        //TEMPORARY
        //alertsOut.comparator = function (a) {
        //    return a.startTime * 1000 + b.startTime;
        //};
    alertsOut.order = 'byTime';

    alertsOut.add(a.filter(function (al) {
        return al.get('isSoon') &&
                (al.get('isLocal') || al.get('isSubway'));
    }));

    return alertsOut;
//    } catch (err) {
//        log.error('generators.extractUpcomingServiceAlertsAndSort', err);
//        return [];
//    }
};

/**
 * Extracts the elevator outage alerts from a list and sorts them. 
 * @return {array} List of elevator alerts
 */
generators.extractElevatorAlertsAndSort = function () {
    'use strict';
    var a = f[this.requiredFacets.alerts].data,
        alertsOut = new Alerts();

//    try {
    alertsOut.order = 'byElevatorStation';

    alertsOut.add(a.where({isElevator: true}));
    return alertsOut;
//    } catch (err) {
//        log.error('generators.extractElevatorAlertsAndSort', err);
//        return [];
//    }
};

/**
 * Generate a list of departures from MBTA-realtime data source. 
 * @return {array} List of departures. 
 */
generators.departuresFromMBTARealtime = function () {
    'use strict';
    var m = d[this.requiredDatasources.MBTARealtimeTimes].data.mode,
        r = f[this.requiredFacets.routes].data,
        departures = new Departures(),
        destination = {
            title: '',
            subtitle: ''
        },
        destFilter = false,  //Used to exclude service that is
                                    //to this very station. 
        /**
         * Derive the destination text, title and subtitle, for destination.
         * Accounts for the fact that destination string is not available
         * in all MBTA-realtime calls. 
         * @param  {string} modeName  [description]
         * @param  {string} routeName [description]
         * @param  {string} direction [description]
         * @param  {object} stoptime  MBTA-realtime departure object
         * @return {object}           {title: x, subtitle: y}
         */
        deriveDestination = function (modeName, routeName, direction, stoptime) {
            var dest = {title: '', subtitle: '' },
                testVia = /\svia\s/, //Does destination sign contain "via"?
                getBeforeVia = /\svia\s[\W\w]+$/, //Text before word "via"
                getAfterVia = /^[\W\w]+\svia\s/,  //Text after word "via"
                testParens = /\(/,   //Does destination sign contain a "("?
                getBeforeParens = /\([\W\w]+$/, //Text before (
                getAfterParens = /^[\W\w]+\(/,  //Text after (
                getAfterTo = /^[\W\w]+\sto\s/,  //Text after "... to "
                getBeforeSpace = /\s[\W\w]+$/;  //Text before " "
//            try {
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
            if (direction === 'Outbound') {
                //commuter rail, outbound, no headsign
                dest.title = 'Outbound';
                dest.subtitle = routeName;
                return dest;
            }
            //commuter rail, inbound, no headsign
            dest.title = 'South Station';
            //FURTHER WORK this only works on the south side. 
            return dest;
//            } catch (err) {
//                log.warning('departuresFromMBTARealtime',
//                    '(could not derive destination) ' + err);
//                return {title: direction, subtitle: '' };
//            }
        };

    if (this.hasOwnProperty('parameters') &&
            this.parameters.hasOwnProperty('destinationFilter')) {
        destFilter = this.parameters.destinationFilter;
    }

    //cycle through mode - route - direction - trip
    _(m).each(function (mode) {
        _(mode.route).each(function (route) {
            _(route.direction).each(function (direction) {
                _(direction.trip).each(function (trip) {
                    //generate "destinationTitle" and "destinationSubtitle"
                    destination = deriveDestination(mode.mode_name,
                        route.route_name, direction.direction_name, trip);
                    if (!(destFilter && destFilter.test(destination.title))) {
                        departures.add({
                            route: r.findWhere({txid: route.route_id}),
                            direction: direction.direction_name,
                            tripId: trip.trip_id,
                            destinationTitle: destination.title,
                            destinationSubtitle: destination.subtitle,
                            scheduledTime: trip.sch_dep_dt * 1000,
                            predictedTime: trip.pre_dt * 1000
                        });
                    }
                });
            });
        });
    });
    return departures;
};


/**
 * Append facet two to the end of facet one. 
 * @return {array} combined facet
 */
//TODO this returns a generic collection instead of a specific kind.
//Entire function should go away in a future rewrite. 
generators.append = function () {
    'use strict';
    var i, j,
        inputs = ['one', 'two', 'three', 'four', 'five', 'six', 'seven',
            'eight', 'nine', 'ten'],
        source,
        combined;

    if (Array.isArray(f[this.requiredFacets.one].data)) {
//    try {
//    combined = [];
        for (i = 0; i < inputs.length; i += 1) {
            if (this.requiredFacets.hasOwnProperty(inputs[i])) {
                source = f[this.requiredFacets[inputs[i]]].data;
                if (Array.isArray(source)) {
                    for (j = 0; j < source.length; j += 1) {
                        combined.push(source[j]);
                    }
                }
            }
        }
    } else {
        combined = new Departures(); //ugly hack alert! But this whole function should go away soon. 
        _(inputs).each(function (input) {
            if (this.requiredFacets.hasOwnProperty(input)) {
                combined.add(f[this.requiredFacets[input]].data.toJSON());
            }
        }, this);
    }
    return combined;

 //   } catch (err) {
 //       log.error('generators.append', JSON.stringify(err));
 //       return [];
 //   }
};

//1. Filter each mode. 
//      For subway: the next departure for each route-direction-destination
//      For commuter rail: the next departure for each direction-destination
//      For bus: the next departure for each route-direction
//      For boat: the next departure for each direction-destination
// * Ruggles?
//2. Sort & publish.
//      For subway: route direction time
//      Foc commuter rail: direction destination
//      For bus: route direction
//      For boat: direction destination
//or... just keep it as-is. 

generators.nextDeparturesFromDepartures = function () {
    'use strict';
    var deps = f[this.requiredFacets.departures].data,
        nextDeps = new Departures();

    nextDeps.order = 'presentationOrder';
    deps.order = 'predictionTimeOrder';
    deps.sort();
    console.log(deps);

    deps.each(function (dep) {
        if (dep.get('isPrediction') && dep.isSoon()) {
            console.log(dep.get('serviceGroup'));
            console.log(nextDeps.findWhere({serviceGroup: dep.get('serviceGroup')}));
            if (!nextDeps.findWhere({serviceGroup: dep.get('serviceGroup')})) {
                console.log('added');
                nextDeps.add(dep);
            }
            console.log(nextDeps);
        }
    });

    return nextDeps;
};



/**
 * Not for use. Logs a warning. 
 * @return {string} Returns an empty string. 
 */
visualizers.defaultVisualizer = function () {
    'use strict';
    console.log('visualizers.defaultVisualizer', 'defaultVisualizer was run.');
    //log.warning('visualizers.defaultVisualizer', 'defaultVisualizer was run.');
    return '';
};

/**
 * Not for use. Logs a warning. 
 * @return {array} Returns an empty array. 
 */
vocalizers.defaultVocalizer = function () {
    'use strict';
    console.log('vocalizers.defaultVocalizer', 'defaultVocalizer was run.');
    // log.warning('vocalizers.defaultVocalizer', 'defaultVocalizer was run.');
    return [];
};

/**
 * Returns exactly the text that is provided. 
 * @return {string} text to display. 
 */
visualizers.static = function () {
    'use strict';
    return this.parameters.text;
};

/**
 * Returns an empty array. 
 * @return {array} An empty array. 
 */
vocalizers.static = function () {
    'use strict';
    return [];
};

/**
 * Prepare alerts for display.
 * @return {string} Alerts display in HTML. 
 */
visualizers.alerts = function () {
    'use strict';
    var a = f[this.requiredFacets.alerts].data,
        title = this.parameters.title,
        footer = this.parameters.footer || false,
        appendFooter,
        content = '';

    if (a === undefined || a.length === 0 || Array.isArray(a)) { return ''; }
    content = '<div class="' + title.format + '">' + title.text
            + '</div>';

    if (a.length === 1 && footer) {appendFooter = true; }

    a.each(function (alert) {
        //TODO how much of this should move to getFormatted?
        content += '<div class="alert">';
        if (alert.get('isUpcoming')) {
            content += '<div class="AlertTimeframe">' +
                _(alert.get('timeframe')).capitalize() + ':</div> ';
        }
        content += alert.getFormatted('description') +
                (appendFooter ? (' ' + footer) : '') +
                '</div>';
    });

    if (!appendFooter && footer) {
        content += '<div class="alert">' + footer + '</div>';
    }

    return content;
};

/**
 * Prepare alerts for vocalization. 
 * @return {array} Array of strings for vocalization. 
 */
vocalizers.alerts = function () {
    'use strict';
    return [];
    //TODO rewrite (as view?)
    /*
    var i,
        a = f[this.requiredFacets.alerts].data,
        title = this.parameters.title,
        footer = this.parameters.footer || false,
        content = [];

    try {
        if (!a.hasOwnProperty('length') || a.length === 0) { return []; }

        content.push(title.text);

        for (i = 0; i < a.length; i += 1) {
            content.push(a[i].description);
        }

        if (footer) { content.push(footer); }

        return content;
    } catch (err) {
        log.error('vocalizers.alerts', err);
        return [];
    }
    */
};

/**
 * Prepare the featured alert or alerts for display. 
 * @return {string} String for display (HTML)
 */
visualizers.featuredAlerts = function () {
    'use strict';
    return '';
    //TODO: rewrite (as view?)
/*
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
    */
};

/**
 * Prepare featured alerts for vocalization. 
 * @return {array} Array of strings for vocalization. 
 */
vocalizers.featuredAlerts = function () {
    'use strict';
    return [];
    //TODO: rewrite (as view?)
    /*
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
*/
};

/**
 * Display grid of upcoming departures. 
 * @return {string} Grid of upcoming departures, html. 
 */
visualizers.departures = function () {
    'use strict';
    var d = f[this.requiredFacets.departures].data,
        title = this.parameters.title,
        content = '',
        sectionTemplate = _.template($('#departures-list-template').html()),
        itemTemplate = _.template($('#departure-template').html());


    if (!d.hasOwnProperty('length') || d.length === 0) { return ''; }

    content = sectionTemplate({
        titleFormat: title.format,
        titleText: title.text,
        routeColHeader: 'Route',
        destinationColHeader: 'Destination',
        minutesAwayColHeader: 'Mins'
    });


    //Here's where I'm stuck with this approach:
    //I'm trying to "gently transition."
    //But templates really only work in context.
    //I can add to the departure table if it's on the website, but 
    //not if it's just a string. 
    
    /*
    d.each(function() {
        content += 
    });
    */
    return content;
//    } catch (err) {
//        log.error('visualizers.departures', err);
//        return '';
//    }
};

// /**
//  * Display grid of upcoming departures. 
//  * @return {string} Grid of upcoming departures, html. 
//  */
// visualizers.departures = function () {
//     'use strict';
//     var d = f[this.requiredFacets.departures].data,
//         title = this.parameters.title,
//         content = '',
//         formatDeparture = function (d) {
//             var row = '', mins;
//             mins = d.minsAway();
//             row += '<tr class="' + d.get('route').get('mode') + '" style="color:' + d.get('route').get('color') + '">';
//             if (d.get('route').get('mode') === 'Subway') {
//                 row += '<td class="route">' + d.get('route').get('name').split(' ')[0] + '</td>' +
//                         '<td class="destination">' + d.get('destinationTitle') + '<br>' + '<span class="destinationSubtitle">' + d.get('destinationSubtitle') + '</span></td>' +
//                         '<td class="minutes_away">' + mins + '</td>';
//             } else if (d.get('route').get('mode') === 'Bus') {
//                 row += '<td class="route">' + d.get('route').get('name') + '</td>' +
//                         '<td class="destination">' + d.get('destinationTitle') + '<br>' + '<span class="destinationSubtitle">' + d.get('destinationSubtitle') + '</span></td>' +
//                         '<td class="minutes_away">' + mins + '</td>';
//             } else if (d.get('route').get('mode') === 'Commuter Rail') {
//                 row += '<td class="route">' + 'Rail' + '</td>' +
//                     '<td class="destination">' + d.get('destinationTitle') + '<br>' + '<span class="destinationSubtitle">' + d.get('destinationSubtitle') + '</span></td>' +
//                     '<td class="minutes_away">' + mins + '</td>';
//             } else {
//                 row += '<td class="route">' + '</td>' +
//                     '<td class="destination">' + d.get('destinationTitle') + '<br>' + '<span class="destinationSubtitle">' + d.get('destinationSubtitle') + '</span></td>' +
//                     '<td class="minutes_away">' + mins + '</td>';
//             }
//             row += '</tr>';
//             return row;
//         };

//     if (!d.hasOwnProperty('length') || d.length === 0) { return ''; }

// //    try {
//     content = '<div class="' + title.format + '">' + title.text
//             + '</div>';

//     content += '<table id="departurestable">' + '<tr><th class="route">Route</th><th class="destination">Destination</th><th class="minutes_away">Mins</th></tr>';

//     d.each(function (departure) {
//         content += formatDeparture(departure);
//     });

//     content += '</table>';

//     return content;
// //    } catch (err) {
// //        log.error('visualizers.departures', err);
// //        return '';
// //    }
// };

/**
 * Prepare set of strings with which to vocalise upcoming departures. 
 * @return {array} Array of strings to speak. 
 */
vocalizers.departures = function () {
    'use strict';
    var i,
        d = f[this.requiredFacets.departures].data,
        title = this.parameters.title,
        content = [];

    if (!d.hasOwnProperty('length') || d.length === 0) { return ''; }

//    try {
    content.push(title.text + ':');

    for (i = 0; i < d.length; i += 1) {
        content.push(d[i].vocalize());
    }

    return content;
//    } catch (err) {
//        log.error('vocalizers.departures', err);
//        return [];
//    }
};

/**
 * Facet constructor. A Facet is a set of information about transit service.
 * It could be a list of an agency's routes, a list of routes serving the 
 * station, a set of scheduled or predicted departures, all alerts, 
 * just upcoming alerts about elevators, etc.  
 * @param {object} fconfig Configuration object. 
 */
var Facet = function (fconfig) {
    'use strict';
//    try {
    this.generatorFunction = fconfig.generatorFunction;
    this.requiredDatasources = fconfig.requiredDatasources || {};
    this.requiredFacets = fconfig.requiredFacets  || {};
    this.parameters = fconfig.parameters  || {};

    if (fconfig.hasOwnProperty('alwaysUpdate')) {
        this.alwaysUpdate = fconfig.alwaysUpdate;
    } else {
        this.alwaysUpdate = false;
    }

    if (fconfig.hasOwnProperty('updateIfAnythingReady')) {
        this.updateIfAnythingReady = fconfig.updateIfAnythingReady;
    } else {
        this.updateIfAnythingReady = false;
    }

    if (generators[this.generatorFunction] === undefined) {
        console.error('Facet' + 'unknown generator ' + fconfig.generatorFunction);
        // log.criticalError('Facet', 'unknown generator ' + fconfig.generatorFunction);
        this.generate = generators.defaultGenerator;
    } else {
        this.generate = generators[this.generatorFunction];
    }
    this.data = {};
    this.isReady = false;
    this.lastUpdated = new Date(0);
 //   } catch (err) {
 //       log.error('Facet', err);
 //   }
};

Facet.prototype = {
    /**
     * Updates the facet
     * @param  {bool} forceUpdate Forces the update even if the facet was
     *                            updated recently. 
     */
    update: function (forceUpdate) {
        'use strict';
        var i,
            willUpdate = forceUpdate || this.alwaysUpdate,
            allDependentsReady = true,
            someDependentsReady = false;

//        try {
        for (i in this.requiredDatasources) {
            if (this.requiredDatasources.hasOwnProperty(i)) {
                if (d[this.requiredDatasources[i]].lastUpdated > this.lastUpdated) {
                    willUpdate = true;
                }
                if (d[this.requiredDatasources[i]].isReady) {
                    someDependentsReady = true;
                } else {
                    allDependentsReady = false;
                }
            }
        }

        for (i in this.requiredFacets) {
            if (this.requiredFacets.hasOwnProperty(i)) {
                if (f[this.requiredFacets[i]].lastUpdated > this.lastUpdated) {
                    willUpdate = true;
                }
                if (f[this.requiredFacets[i]].isReady) {
                    someDependentsReady = true;
                } else {
                    allDependentsReady = false;
                }
            }
        }
//        } catch (err) {
//            log.warning('Facet', '(could not update) ' + err);
//            allDependentsReady = false;
//        }

        if (allDependentsReady ||
                (someDependentsReady && this.updateIfAnythingReady)) {
            if (willUpdate) {
//                try {
                this.data = {};
                this.data = this.generate();
                this.isReady = true;
                this.lastUpdated = Date.now();
//                } catch (err) {
//                    log.error('Facet', err);
//                    this.isReady = false;
//                    this.data = {};
//                }
            }
        } else {
            // log.info('Facet.update', 'Not all inputs ready');
            console.log('Facet.update' + 'Not all inputs ready');
            this.isReady = false;
            this.data = {};
        }
    }
};

/**
 * VisualElement constructor. 
 * A visual element reflects part of the page. 
 * @param {object} vconfig Configuration object. 
 */
var VisualElement = function (vconfig) {
    'use strict';
//    try {
    this.visualizer = vconfig.visualizer;
    this.div = vconfig.div;
    this.div_render = vconfig.div + '_render';
    this.requiredFacets = vconfig.requiredFacets  || {};
    this.parameters = vconfig.parameters  || {};

    if (visualizers[this.visualizer] === undefined) {
        console.error('VisualElement' + 'Unknown visualizer ' + this.visualizer);
        // log.criticalError('VisualElement', 'Unknown visualizer ' + this.visualizer);
        this.visualize = visualizers.defaultVisualizer;
    } else {
        this.visualize = visualizers[this.visualizer];
    }
    if (vocalizers[this.visualizer] === undefined) {
        console.error('VisualElement' + 'Unknown vocalizer ' + this.visualizer);
        // log.criticalError('VisualElement', 'Unknown vocalizer ' + this.visualizer);
        this.vocalize = vocalizers.defaultVocalizer;
    } else {
        this.vocalize = vocalizers[this.visualizer];
    }



    this.lastUpdated = new Date(0);
    this.content = '';
    this.hasContent = false;
    this.height = 0;
    this.fontSize = 100;
//    } catch (err) {
//        log.error('VisualElement', '' + err);
//    }
};

VisualElement.prototype = {
    /**
     * Prepares the text for display, determining the font size. 
     * Does not actually move content to page or show or hide it. 
     */
    render: function () {
        'use strict';
        var fontSize = 100, screenHeight;

//        try {
        screenHeight = window.innerHeight;
        this.content = this.visualize();
        document.getElementById(this.div_render).innerHTML = this.content;
        document.getElementById(this.div_render).style.display = 'block';
        document.getElementById(this.div_render).style.fontSize = fontSize + '%';

        while (screenHeight < document.getElementById(this.div_render).offsetHeight && fontSize > 0) {
            fontSize -= 1;
            document.getElementById(this.div_render).style.fontSize = fontSize + '%';
        }
        //FUTURE WORK: Find a better way to account for the true height of each item. (See chooseBestCarousel.)
        this.height = document.getElementById(this.div_render).offsetHeight; //Does not include 56 pixels of buffer
        //this.height = document.getElementById(this.div_render).scrollHeight; //Does include 56 pixels of buffer
        this.fontSize = fontSize;
        this.hasContent = (this.content !== '');
        document.getElementById(this.div_render).style.display = 'none';
//        } catch (err) {
//            log.warning('VisualElement', err);
//            this.hasContent = false;
//            document.getElementById(this.div_render).style.display = 'none';
//        }
    },
    /**
     * Moves the content to page, but does not show or hide it. 
     */
    moveContentToPage: function () {
        'use strict';
//        try {
            document.getElementById(this.div).innerHTML = this.content;
            document.getElementById(this.div).style.fontSize = this.fontSize + '%';
//        } catch (err) {
//            log.warning('VisualElement.moveContentToPage', err);
//        }
    },
    /**
     * Display (unhide) the visual element. 
     */
    show: function () {
        'use strict';
//        try {
        document.getElementById(this.div).style.display = 'block';
//        } catch (err) {
//            log.warning('VisualElement.show', err);
//        }
    },
    /**
     * Hide the visual element. 
     */
    hide: function () {
        'use strict';
//        try {
        document.getElementById(this.div).style.display = 'none';
//        } catch (err) {
//            log.warning('VisualElement.hide', err);
//        }
    },
    /**
     * Show or hide the element, depending on the parameter.
     * @param  {bool} show If true, show; else hide. 
     */
    showOrHide: function (show) {
        'use strict';
        if (show) { this.show(); } else { this.hide(); }
    },
    /**
     * shows or hides the element, depending on whether it has content.
     * @return {[type]} [description]
     */
    showIfHasContent: function () {
        'use strict';
        this.showOrHide(this.hasContent);
    }
};

/**
 * Breaks a speech utterance into smaller "chunks" before speaking them.
 * This works around a known bug in chrome, in which too log a piece
 * of text crashes the speech engine. 
 * @param  {SpeechSynthesisUtterance}   utt      The speech utterance. 
 * @param  {object}   settings Options.
 * @param  {Function} callback callback function.
 */
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

/**
 * Speaks all the strings in an array, starting with item i.
 * (Calls speechUtteranceChunker with a callback that increments i)
 * @param  {array} textList all items to speak (strings)
 * @param  {number} i        item to speak next
 */
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

/**
 * Used to start speech. 
 * @param  {object} evt keypress event
 */
var reactKey = function (evt) {
    'use strict';
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    } else {
        var i, textList = [];
        if (evt.keyCode === 83) {
            for (i = 0; i < allVisualElements.length; i += 1) {
                textList = textList.concat(v[allVisualElements[i]].vocalize());
            }
            speakTextList(textList, 0);
            // log.speechSample(textList);
        }
    }
};
document.onkeydown = function (key) { 'use strict'; reactKey(key); };

/**
 * Clock in the upper-right corner of display. 
 * @type {Object}
 */
var clock = {};

/**
 * updates the clock. 
 * @return {[type]} [description]
 */
clock.tick = function () {
    'use strict';
    var today = new Date(),
        h = today.getHours(),
        m = today.getMinutes();
    if (m < 10) { m = '0' + m; }
    if (h > 12) { h -= 12; }
    document.getElementById('clock').innerHTML = h + ":" + m;
};

/**
 * Chooses the best "carousel," the set of information to show in what order. 
 * @param  {object} heights hieghts of visualElements. 
 * @return {object}         program for combination of slides to show, in order. 
 */
var chooseBestCarousel = function (heights) {
    'use strict';
    var i, j, k, passes, height, screenHeight, carousel;

//    try {
    screenHeight = window.innerHeight;
    //iterate through carousels, in order. 
    //for each carousel:
    for (i = 0; i < carousels.length; i += 1) {
        //  set passes to true
        passes = true;
        //  iterate through conditions, in order.
        //  for each condition:
//        try {
        for (j = 0; j < carousels[i].conditions.length; j += 1) {
            //set height to 0
            height = -26; //WORKAROUND: see height += 26 below. 
            //iterate through visualElements, in order. 
            //for each visualElement:
            for (k = 0;
                        k < carousels[i].conditions[j].visualElements.length;
                        k += 1) {
            //add height to total. 
                height += heights[carousels[i].conditions[j].visualElements[k]];
                height += 26; //FUTURE WORK: this adds margin for every element
                              // but 1. It should not be hard-coded in future. 
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
//        } catch (err) {
//            log.warning('chooseBestCarousel', '(could not evaluate condition) ' + err);
//            passes = false;
//        }
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
//    } catch (err) {
//        log.error('chooseBestCarousel', err);
//        return [];
//    }
};

/**
 * The controler updates data and controls what's shown. 
 * @type {Object}
 */
var controller = {
    completedLoops: 0,
    lastLoopTime: 0
};

/**
 * Updates the source data.
 * @param  {bool} forceUpdate If true will force all datasources 
 */
controller.updateDatasources = function (forceUpdate) {
    'use strict';
    var i;
    for (i in d) {
        if (d.hasOwnProperty(i)) {
//            try {
            if (d.hasOwnProperty(i)) {
                d[i].update(forceUpdate);
            }
//            } catch (err) {
//                log.criticalError('controller.updateDatasources', err);
//            }
        }
    }
};


/**
 * Displays the items provided in the parameter, and hides what aren't.
 * @param  {array} visualElements the items to display
 */
controller.displayOnly = function (visualElements) {
    'use strict';
    var i, visible;
//    try {
    for (i = 0; i < allVisualElements.length; i += 1) {
        visible = (visualElements.indexOf(allVisualElements[i]) >= 0);
        v[allVisualElements[i]].moveContentToPage();
        v[allVisualElements[i]].showOrHide(visible);
    }
    // if (b.logging.sendSamples) { log.sample(); }
//    } catch (err) {
//        log.error('controller.displayOnly', JSON.stringify(err));
//    }
};

/**
 * The main loop. Updates the facets, chooses the carousel,
 * schedules the display's next messages according to the carousel
 * and schedules itself to run again. 
 */
controller.loop = function () {
    'use strict';
    var carousel, i, heights = {}, ms, setDisplayOnlyTimeout;
    setDisplayOnlyTimeout = function (slides, ms) {
        setTimeout(function () {controller.displayOnly(slides); }, ms);
    };

//    try {
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
//    } catch (err) {
//        log.criticalError('Failed at controller.loop, ' + err);
//        ms = 120000;
//    } finally {
    setTimeout(function () {controller.loop(); }, ms);
    ms -= 5000;
    setTimeout(function () {controller.updateDatasources(); }, ms);
//    }
    controller.heartbeat();
};

/**
 * Initializes everything, except the clock.  
 */
controller.init = function () {
    'use strict';
    var i;

    //set and start the heartbeat. 
    // this.firstHeartbeat = Date.now();
    // this.nextHeartbeat = this.firstHeartbeat;
    // this.heartbeatRate = b.logging.heartbeatRate;
    // this.heartbeat();

//    try {
    //Create the datasources.
    for (i in c.datasources) {
        if (c.datasources.hasOwnProperty(i)) {
            d[c.datasources[i].id] = new Datasource(c.datasources[i]);
        }
    }

    //update all datasources.
    controller.updateDatasources(true);

    //create the facets.
    for (i in c.facets) {
        if (c.facets.hasOwnProperty(i)) {
            f[i] = new Facet(c.facets[i]);
        }
    }

    //create the visualelements. 
    for (i in c.visualElements) {
        if (c.visualElements.hasOwnProperty(i)) {
            v[i] = new VisualElement(c.visualElements[i]);
        }
    }

    //finish up, show welcome element, and schedule next loop to begin.
    this.completedLoops = 0;
    this.lastLoopTime = Date.now();
    v.welcome.render();
    controller.displayOnly(['welcome']);
    setTimeout(function () {controller.loop(); }, 5000);
//    } catch (err) {
//        log.criticalError('controller.init', '(will retry in 2.5 mins)', err);
//        setTimeout(function () {controller.init(); }, 1500000);
//    }
};

/**
 * initializes page. 
 */
function init() {
    'use strict';
    setInterval(function () {clock.tick(); }, 500);
    controller.init();
}