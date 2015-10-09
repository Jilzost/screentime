/*jslint devel: true nomen: true regexp: true indent: 4 */
/*global b, c, XMLHttpRequest, SpeechSynthesisUtterance, speechSynthesis, document, window, _, $, Backbone */
'use strict';
//
//  ********************* BEGIN CONTROLLER  *********************
//  


// 
// PLANS FOR NEXT STEPS
// 3. The post-processing -- from agency data to viewable groups of data. (complete for departures)
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

var st = {};
st.agencies = {};
st.lib = {};
st.lib.input = {};
st.lib.mbta = {};
st.lib.process = {};

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
    setTimeout(function () {feed.fetch(
        {
            success: function () {st.lib.input.successHandler(feed); },
            error: function () {st.lib.input.errorHandler(feed); }
        }
    ); }, (feed.maxAge || 60000) / 10);
    if (feed.lastUpdated + feed.maxAge * 2 > Date.now()) {
        feed.reset();
    }
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

st.lib.mbta.deriveDestination = function (modeName, routeName, direction, stoptime) {
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
    dest.title = direction;
    dest.subtitle = routeName;
    return dest;
};

var AgencyComponent = Backbone.Model.extend({
    defaults: {
        modelType: 'AgencyComponent',
        txid: '',
        name: ''
    },
    regexes: function () {
        return [new RegExp('\\b(' + this.escape('name') + ')\\b', 'gi')];
    }
});

var AgencyComponents = Backbone.Collection.extend({
    model: AgencyComponent,
    agency: {},
    sourceType: '', //supported: MBTA-realtime
    url: '',
    maxAge: 30000,
    lastUpdated: Date(0),
    upToDate: false //Not up-to-date until it's been initialized.
});


var Route = AgencyComponent.extend({
    defaults: {
        modelType: 'Route',
        mode: 'Bus',
        name: '',           //1         Red line    Green Line C        Silver Line SL1
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

var Routes = AgencyComponents.extend({
    //url: 'http://realtime.mbta.com/developer/api/v2/routes?api_key=17xKel6QtUOSVDtGlCgjlg&format=json',
    model: Route,
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

        switch (this.sourceType) {
        case 'MBTA-realtime':
            return parseMBTARealtime(data);
        default:
            console.error('Unsupported data source ' + this.sourceType);
            return [];
        }
    },
    combineRoutesAndLocal: function () {
        var mbta_realtime = function (routes, localRoutes) {
            var routeList = [];
            if (routes === undefined && localRoutes === undefined) {
                return [];
            }
            if (routes === undefined) {
                routeList = localRoutes.toArray();
                _(routeList).each(function (r) {
                    r.set({isLocal: true}, {async: true});
                });
                return routeList;
            }
            if (localRoutes === undefined) {
                return routes.toArray();
            }
            routeList = routes.toArray();
            _(routeList).each(function (r) {
                if (localRoutes.findWhere({txid: r.get('txid')})) {
                    r.set({isLocal: true}, {async: true});
                }
            });
            return routeList;
        };
        if (this.hasOwnProperty('agency')) {
            console.log(this);
            console.log(this.agency);
            console.log(this.agency.get('routesSource'));
            console.log(this.agency.get('localRoutesSource_place-sull'));
            console.log(mbta_realtime(this.agency.get('routesSource'),
                    this.agency.get('localRoutesSource_place-sull'))); 
            this.reset();           
            this.reset(mbta_realtime(this.agency.get('routesSource'),
                    this.agency.get('localRoutesSource_place-sull'))); //TODO testing only
            return 1;
        }
        console.error('No agency specified');
        return 0;
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

var AccessFeature = AgencyComponent.extend({
    defaults: {
        modelType: 'AccessFeature',
        color: '#80AAFF',
        type: '',
        stationName: '',
    }
});

var Alert = Backbone.Model.extend({
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
        this.set({affecteds: new AgencyComponents()});
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
        return input;
    }
});

var Alerts = Backbone.Collection.extend({
    model: Alert,
    order: 'txid',
    comparator: function (model) {
        switch (this.order) {
        case 'byRoute':
            return model.get('affecteds').first().get('sortOrder');
        case 'byTime':
            return model.get('startTime') * 100000000000000000 +
                    model.get('endTime');
        case 'byElevatorStation':
            return model.get('summary');
        default:
            return model.get(this.order);
        }
    },
    parse: function (data) {
        var parseMBTARealtime = function (data) {
            var newAlerts = [], //Collection of new alerts is built here and returned
                newAlert,
                affected;

            if (data.alerts === undefined) { return []; }

            _(data.alerts).each(function (source) {
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

                _(source.affected_services.services).each(function (el) {
                    if (el.hasOwnProperty('route_id')) {
                        affected = new Route({
                            txid: el.route_id,
                            name:   el.route_name,
                            mode:   el.mode_name,
                            color: st.lib.mbta.pickRouteColor(el.mode_name, el.route_name),
                            isHidden: el.route_hide
                        });
                    } else {
                        affected = new Route({
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
                        affected = new Stop({
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
                            newAlert.set({affectedDirection: el.direction_name});
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
            console.error('Unsupported data source ' + this.sourceType);
            return [];
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
     * and no more than 99 minutes in the future.
     * @return {Boolean} is departure soon.
     */
    isSoon: function () {
        return (Date.now() - 60000 < this.get('time') &&
                this.get('time') < Date.now() + 5940000);
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

var Departures = AgencyComponents.extend({
    model: Departure,
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
                            destination = st.lib.mbta.deriveDestination(mode.mode_name,
                                route.route_name, direction.direction_name, trip);
                            departures.push({
                                route: new Route(
                                    {
                                        txid: route.route_id,
                                        name:   route.route_name,
                                        mode:   mode.mode_name,
                                        color: st.lib.mbta.pickRouteColor(mode.mode_name, mode.route_name)
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
            console.error('Unsupported data source ' + this.sourceType);
            return [];
        }
    }
});

var DeparturesView = Backbone.View.extend({
    el: 'departures',
    initialize: function () {
        this.listenTo(this.collection, 'sync change', this.render);
    },
    render: function () {

    }
});

    //TODO NEXT STEP make what's below a reality. 
    //Can do it as a model, although much will be done manually. 
    //May or may not want to replace some of what's below with default values. 
    //have a mode for "treat all service as local."
    //alerts, predictions both default to true. 
    //destination filter. 
    //can override default refresh rates?
    //Can add options to specific calls?
    //
    // Could an MBTA-realtime-based agency be one kind of agency?
    // i.e. MBTARealtimeAgency = Agency.extend ?  
    //
    // st.agencies.mbta = new Agency(
    // {
    //     name: 'MBTA',
    //     sourceType: 'MBTA-realtime',
    //     baseURL: 'http://realtime.mbta.com/developer/api/v2/',
    //     api_key: '17xKel6QtUOSVDtGlCgjlg',
    //     stops: [{stop_id: 'place-sull', locationName: ''}],
    // });
    // 
    // 
    // st.agencies.mbta.routesSource = new Routes();
    // st.agencies.mbta.routesSource.url = 'http://realtime.mbta.com/developer/api/v2/routes?api_key=17xKel6QtUOSVDtGlCgjlg&format=json';
    // st.agencies.mbta.routesSource.agency = st.agencies.mbta;
    // st.agencies.mbta.routesSource.sourceType = 'MBTA-realtime';

    // st.agencies.mbta.localRoutesSource = new Routes();
    // //st.agencies.mbta.localRoutesSource.url = 'http://realtime.mbta.com/developer/api/v2/routesbystop?api_key=17xKel6QtUOSVDtGlCgjlg&stop=place-sull&format=json';
    // st.agencies.mbta.localRoutesSource.url = 'http://realtime.mbta.com/developer/api/v2/routes?api_key=17xKel6QtUOSVDtGlCgjlg&format=json';
    // st.agencies.mbta.localRoutesSource.agency = st.agencies.mbta;
    // st.agencies.mbta.localRoutesSource.sourceType = 'MBTA-realtime';

    // st.agencies.mbta.routes = new Routes();
    // st.agencies.mbta.routes.agency = st.agencies.mbta;
    // st.agencies.mbta.routes.sourceType = 'MBTA-realtime';
    // st.agencies.mbta.routes.listenTo(st.agencies.mbta.routesSource, 'sync', st.agencies.mbta.routes.combineRoutesAndLocal);
    // st.agencies.mbta.routes.listenTo(st.agencies.mbta.localRoutesSource, 'sync', st.agencies.mbta.routes.combineRoutesAndLocal);


    // st.agencies.mbta.produceElevatorAlerts = function () {
    //     st.agencies.mbta.elevatorAlerts.reset(
    //         st.agencies.mbta.alerts.where({isElevator: true})
    //     );
    // };

    // st.agencies.mbta.upcomingServiceAlerts.listenTo(
    //     st.agencies.mbta.alerts,
    //     'reset sync',
    //     st.agencies.mbta.produceUpcomingServiceAlerts
    // );
    // 
    // _.defaults(object, *defaults) 


st.lib.mbta.initializeAgency = function (newAgency) {
    var defaultParams = {
            api_key: newAgency.get('api_key'),
            format: 'json'
        },
        initializeComponent = function (config, agency) {
            var component = new config.constructor();
            component.agency = agency;
            component.sourceType = 'MBTA-realtime';
            if (config.fromAPI) {
                component.url = 'http://realtime.mbta.com/developer/api/v2/routes?api_key=17xKel6QtUOSVDtGlCgjlg&format=json';
                console.log(component.url);
                component.url = config.baseURL + config.command + '?' + $.param(config.params);
                console.log(component.url);
            }
            if (config.listenTos) {
                _(config.listenTos).each(function (l) {
                    component.listenTo(l.toOther, l.toEvent, l.toCallback);
                });
            }
            return component;
        };

    newAgency.set({routesSource: initializeComponent({
        constructor: Routes,
        fromAPI: true,
        baseURL: newAgency.get('baseURL'),
        command: 'routes',
        params: defaultParams
    }, newAgency)});

    console.log(newAgency);

    _(newAgency.get('stops')).each(function (stop) {
        newAgency.set('localRoutesSource_' + stop.stop_id, initializeComponent({
            constructor: Routes,
            fromAPI: true,
            baseURL: newAgency.get('baseURL'),
            command: 'routesbystop',
            params: _({stop: stop.stop_id}).defaults(defaultParams),
            // otherProperties: {locationName: stop.locationName}
        }, newAgency));
    });

    newAgency.set('routes', initializeComponent({
        constructor: Routes,
        fromAPI: false,
    }, newAgency));
    newAgency.get('routes').listenTo(
        newAgency.get('routesSource'),
        'sync',
        newAgency.get('routes').combineRoutesAndLocal
    );
    _(newAgency.get('stops')).each(function (stop) {
        newAgency.get('routes').listenTo(
            newAgency.get('localRoutesSource_' + stop.stop_id),
            'sync',
            newAgency.get('routes').combineRoutesAndLocal
        );
    });

    newAgency.set('alertsSource', initializeComponent({
        constructor: Alerts,
        fromAPI: true,
        baseURL: newAgency.get('baseURL'),
        command: 'alerts',
        params: _({include_access_alerts: 'true', include_service_alerts: 'true'}).defaults(defaultParams)
    }, newAgency));

    _(['alerts',
        'currentServiceAlertsCD',
        'featuredAlerts',
        'upcomingServiceAlerts',
        'elevatorAlerts'
        ]).each(function (a) {
        newAgency.set(a, initializeComponent({
            constructor: Alerts,
            fromAPI: false,
        }, newAgency));
    });
    newAgency.get('upcomingServiceAlerts').order = 'byTime';
    newAgency.get('elevatorAlerts').order = 'byElevatorStation';

    _(['alertsSource', 'routes']).each(function (target) {
        newAgency.get('alerts').listenTo(
            newAgency.get(target),
            'reset sync',
            newAgency.get('alerts').reset(
                st.lib.mbta.combineAlertsAndRoutes(
                    newAgency.get('alertsSource'),
                    newAgency.get('routes')
                )
            )
        );
    });

    //TODO could the following be made more element by 
    //moving the "reset" into the function? Would that work?
    _([
        {
            collection: 'currentServiceAlertsCD',
            process: function () {
                newAgency.get('currentServiceAlertsCD').reset(
                    st.lib.process.currentServiceAlertsCD(newAgency.get('alerts'))
                );
            }
        },
        {
            collection: 'featuredAlerts',
            process: function () {
                newAgency.get('featuredAlerts').reset(
                    newAgency.get('alerts').where({isFeatured: true})
                );
            }
        },
        {
            collection: 'upcomingServiceAlerts',
            process: function () {
                newAgency.get('upcomingServiceAlerts').reset(
                    newAgency.get('alerts').filter(
                        function (al) {
                            return al.get('isSoon') &&
                                (al.get('isLocal') || al.get('isSubway'));
                        }
                    )
                );
            }
        },
        {
            collection: 'elevatorAlerts',
            process: function () {
                newAgency.get('elevatorAlerts').reset(
                    newAgency.alerts.where({isElevator: true})
                );
            }
        },
    ]).each(function (x) {
        newAgency.get(x.collection)
            .listenTo(newAgency.get('alerts'),
                'reset sync',
                x.process);
    });

    // newAgency.currentServiceAlertsCD.listenTo(
    //     newAgency.alerts,
    //     'reset sync',
    //     function () {
    //         newAgency.currentServiceAlertsCD.reset(
    //             st.lib.process.currentServiceAlertsCD(newAgency.mbta.alerts)
    //         );
    //     }
    // );

    // newAgency.featuredAlerts.listenTo(
    //     newAgency.alerts,
    //     'reset sync',
    //     function () {
    //         newAgency.featuredAlerts.reset(
    //             st.agencies.mbta.alerts.where({isFeatured: true})
    //         );
    //     }
    // );

    // newAgency.upcomingServiceAlerts.listenTo(
    //     newAgency.alerts,
    //     'reset sync',
    //     newAgency.upcomingServiceAlerts.reset(
    //         newAgency.alerts.filter(
    //             function (al) {
    //                 return al.get('isSoon') &&
    //                     (al.get('isLocal') || al.get('isSubway'));
    //             }
    //         )
    //     );
    // );

    // st.agencies.mbta.elevatorAlerts.listenTo(
    //     st.agencies.mbta.alerts,
    //     'reset sync',
    //     st.agencies.mbta.elevatorAlerts.reset(
    //         st.agencies.mbta.alerts.where({isElevator: true})
    //     );
    // );

    //Have an array of objects and iterate through them to build the Agency!
};

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
            console.error('Unsupported data source ' + this.sourceType);
        }
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
         
         From there it's basically the same logic as before,
         but with "branch" thrown in to the formatting, 
         and isRoute instead of whether it's bus. 
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
        routes = new Routes(),
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
    var alertsOut = new Alerts(),   //Output builder.
        delayAlerts = new Alerts();

    alertsOut.order = 'byRoute';

    alertsOut.add(alerts.filter(function (al) {
        return (al.get('isService') &&
                al.get('isCurrent') &&
                (al.get('isLocal') || al.get('isSubway')) &&
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

st.lib.mbta.chooseNextDepartures = function (departures, routes, destinationFilter) {
    var deps = new Departures(),
        nextDeps = new Departures();

    if (Array.isArray(departures)) {
        _(departures).each(function (d) {
            deps.push(d.toArray()); //TODO need to test this
        });
    } else {
        deps.push(departures.toArray());
    }

    nextDeps.order = 'presentationOrder';
    deps.order = 'predictionTimeOrder';
    deps.sort();

    deps.each(function (dep) {
        if (routes.findWhere({txid: dep.get('route').get('txid')})) {
            dep.get('route').set(routes.findWhere({txid: dep.get('route').get('txid')}).toJSON());
        }
        if (dep.get('isPrediction') && dep.isSoon() &&
                !(destinationFilter && destinationFilter.test(dep.get('destinationTitle')))) {
            if (!nextDeps.findWhere({serviceGroup: dep.get('serviceGroup')})) {
                nextDeps.add(dep);
            }
        }
    });

    return nextDeps.toArray();

};


var init = function () {
    //TODO just about everything that appears below should be handled by some kind of "agency.setup() function."
    st.agencies.mbta = {};
    st.agencies.mbta.name = 'MBTA';

    //TODO NEXT STEP make what's below a reality. 
    //Can do it as a model, although much will be done manually. 
    //May or may not want to replace some of what's below with default values. 
    //have a mode for "treat all service as local."
    //alerts, predictions both default to true. 
    //destination filter. 
    //can override default refresh rates?
    //Can add options to specific calls?
    //
    // Could an MBTA-realtime-based agency be one kind of agency?
    // i.e. MBTARealtimeAgency = Agency.extend ?  
    //
    st.agencies.mbta = new Agency(
        {
            name: 'MBTA',
            sourceType: 'MBTA-realtime',
            baseURL: 'http://realtime.mbta.com/developer/api/v2/',
            api_key: '17xKel6QtUOSVDtGlCgjlg',
            stops: [{stop_id: 'place-sull', locationName: ''}],
        }
    );

    // st.agencies.mbta.routesSource = new Routes();
    // st.agencies.mbta.routesSource.url = 'http://realtime.mbta.com/developer/api/v2/routes?api_key=17xKel6QtUOSVDtGlCgjlg&format=json';
    // st.agencies.mbta.routesSource.agency = st.agencies.mbta;
    // st.agencies.mbta.routesSource.sourceType = 'MBTA-realtime';

    // st.agencies.mbta.localRoutesSource = new Routes();
    // //st.agencies.mbta.localRoutesSource.url = 'http://realtime.mbta.com/developer/api/v2/routesbystop?api_key=17xKel6QtUOSVDtGlCgjlg&stop=place-sull&format=json';
    // st.agencies.mbta.localRoutesSource.url = 'http://realtime.mbta.com/developer/api/v2/routes?api_key=17xKel6QtUOSVDtGlCgjlg&format=json';
    // st.agencies.mbta.localRoutesSource.agency = st.agencies.mbta;
    // st.agencies.mbta.localRoutesSource.sourceType = 'MBTA-realtime';

    // st.agencies.mbta.routes = new Routes();
    // st.agencies.mbta.routes.agency = st.agencies.mbta;
    // st.agencies.mbta.routes.sourceType = 'MBTA-realtime';
    // st.agencies.mbta.routes.listenTo(st.agencies.mbta.routesSource, 'sync', st.agencies.mbta.routes.combineRoutesAndLocal);
    // st.agencies.mbta.routes.listenTo(st.agencies.mbta.localRoutesSource, 'sync', st.agencies.mbta.routes.combineRoutesAndLocal);

    // st.agencies.mbta.alertsSource = new Alerts();
    // st.agencies.mbta.alertsSource.url = 'http://realtime.mbta.com/developer/api/v2/alerts?api_key=17xKel6QtUOSVDtGlCgjlg&include_access_alerts=true&format=json';
    // st.agencies.mbta.alertsSource.agency = st.agencies.mbta;
    // st.agencies.mbta.alertsSource.sourceType = 'MBTA-realtime';

    // st.agencies.mbta.alerts = new Alerts();
    // st.agencies.mbta.alerts.agency = st.agencies.mbta;

    // st.agencies.mbta.currentServiceAlertsCD = new Alerts();
    // st.agencies.mbta.currentServiceAlertsCD.agency = st.agencies.mbta;

    // st.agencies.mbta.featuredAlerts = new Alerts();
    // st.agencies.mbta.featuredAlerts.agency = st.agencies.mbta;

    // st.agencies.mbta.upcomingServiceAlerts = new Alerts();
    // st.agencies.mbta.upcomingServiceAlerts.agency = st.agencies.mbta;
    // st.agencies.mbta.upcomingServiceAlerts.order = 'byTime';

    // st.agencies.mbta.elevatorAlerts = new Alerts();
    // st.agencies.mbta.elevatorAlerts.agency = st.agencies.mbta;
    // st.agencies.mbta.elevatorAlerts.order = 'byElevatorStation';


    // st.agencies.mbta.departuresSource = new Departures();
    // st.agencies.mbta.departuresSource.url = 'http://realtime.mbta.com/developer/api/v2/predictionsbystop?api_key=17xKel6QtUOSVDtGlCgjlg&stop=place-sull&format=json';
    // st.agencies.mbta.departuresSource.agency = st.agencies.mbta;
    // st.agencies.mbta.departuresSource.locationName = 'Busway';
    // st.agencies.mbta.departuresSource.sourceType = 'MBTA-realtime';

    // st.agencies.mbta.departures = new Departures();
    // st.agencies.mbta.departures.agency = st.agencies.mbta;

    // st.agencies.mbta.produceAlerts = function () {
    //     st.agencies.mbta.alerts.reset(
    //         st.lib.mbta.combineAlertsAndRoutes(
    //             st.agencies.mbta.alertsSource,
    //             st.agencies.mbta.routesSource
    //         )
    //     );
    // };

    // st.agencies.mbta.alerts.listenTo(
    //     st.agencies.mbta.routes,
    //     'reset sync',
    //     st.agencies.mbta.produceAlerts
    // );

    // st.agencies.mbta.alerts.listenTo(
    //     st.agencies.mbta.alertsSource,
    //     'reset sync',
    //     st.agencies.mbta.produceAlerts
    // );

    // // st.agencies.mbta.produceCurrentServiceAlertsCD = function () {
    // //     st.agencies.mbta.currentServiceAlertsCD.reset(
    // //         st.lib.process.currentServiceAlertsCD(st.agencies.mbta.alerts)
    // //     );
    // // };

    // // st.agencies.mbta.currentServiceAlertsCD.listenTo(
    // //     st.agencies.mbta.alerts,
    // //     'reset sync',
    // //     st.agencies.mbta.produceCurrentServiceAlertsCD
    // // );

    // st.agencies.mbta.currentServiceAlertsCD.listenTo(
    //     st.agencies.mbta.alerts,
    //     'reset sync',
    //     function () {
    //         st.agencies.mbta.currentServiceAlertsCD.reset(
    //             st.lib.process.currentServiceAlertsCD(st.agencies.mbta.alerts)
    //         );
    //     }
    // );


    // // st.agencies.mbta.produceFeaturedAlerts = function () {
    // //     st.agencies.mbta.featuredAlerts.reset(
    // //         st.agencies.mbta.alerts.where({isFeatured: true})
    // //     );
    // // };

    // st.agencies.mbta.featuredAlerts.listenTo(
    //     st.agencies.mbta.alerts,
    //     'reset sync',
    //     function () {
    //         st.agencies.mbta.featuredAlerts.reset(
    //             st.agencies.mbta.alerts.where({isFeatured: true})
    //         );
    //     }
    // );

    // st.agencies.mbta.produceUpcomingServiceAlerts = function () {
    //     st.agencies.mbta.upcomingServiceAlerts.reset(
    //         st.agencies.mbta.alerts.filter(
    //             function (al) {
    //                 return al.get('isSoon') &&
    //                     (al.get('isLocal') || al.get('isSubway'));
    //             }
    //         )
    //     );
    // };

    // st.agencies.mbta.elevatorAlerts.listenTo(
    //     st.agencies.mbta.alerts,
    //     'reset sync',
    //     st.agencies.mbta.produceElevatorAlerts
    // );

    // st.agencies.mbta.produceElevatorAlerts = function () {
    //     st.agencies.mbta.elevatorAlerts.reset(
    //         st.agencies.mbta.alerts.where({isElevator: true})
    //     );
    // };

    // st.agencies.mbta.upcomingServiceAlerts.listenTo(
    //     st.agencies.mbta.alerts,
    //     'reset sync',
    //     st.agencies.mbta.produceUpcomingServiceAlerts
    // );

    // st.agencies.mbta.produceDepartures = function () {
    //     st.agencies.mbta.departures.reset(
    //         st.lib.mbta.chooseNextDepartures(
    //             st.agencies.mbta.departuresSource,
    //             st.agencies.mbta.routesSource,
    //             /^Sullivan/
    //         )
    //     );
    // };

    // st.agencies.mbta.departures.listenTo(
    //     st.agencies.mbta.routes,
    //     'reset sync',
    //     st.agencies.mbta.produceDepartures
    // );

    // st.agencies.mbta.departures.listenTo(
    //     st.agencies.mbta.departuresSource,
    //     'reset sync',
    //     st.agencies.mbta.produceDepartures
    // );

    // // st.agencies.mbta.routesSource.fetch();
    // // st.agencies.mbta.localRoutesSource.fetch();
    // // st.agencies.mbta.alertsSource.fetch();
    // // st.agencies.mbta.departuresSource.fetch();
    // 
    // 
    // _([st.agencies.mbta.routesSource,
    //     st.agencies.mbta.localRoutesSource,
    //     st.agencies.mbta.alertsSource,
    //     st.agencies.mbta.departuresSource]).each(function (feed) {
    //     feed.fetch({
    //         success: function () {st.lib.input.successHandler(feed); },
    //         error: function () {st.lib.input.errorHandler(feed); }
    //     });
    // });

    //TODO this activation is going to need to be a function of the model.

    _([st.agencies.mbta.get('routesSource'),
        st.agencies.mbta.get('localRoutesSource_place-sull'),
        st.agencies.mbta.get('alertsSource')]).each(function (feed) {
        feed.fetch({
            success: function () {st.lib.input.successHandler(feed); },
            error: function () {st.lib.input.errorHandler(feed); }
        });
    });
};
