/*jslint devel: true nomen: true regexp: true indent: 4 */
/*global b, c, XMLHttpRequest, SpeechSynthesisUtterance, speechSynthesis, document, window, _, $, Backbone */
'use strict';
//
//  ********************* BEGIN CONTROLLER  *********************
//  

// 
// PLANS FOR NEXT STEPS
// 1. Add departures. 
// 2. Procedure to always keep this data up-to-date (using maxAge, etc.)
// 3. The post-processing -- from agency data to viewable data. 
// 4. Display!
// 
// 
// ****************************************************************
// I am saving this version just BEFORE making the following change
// ****************************************************************
// 
// TODO: Change alerts / departures such that initial intake is truly independent of routes. 
// Would mean adding "sampleRoute" property or similar to Stop. 
// Would mean a next or future step performs the lookup. 
// An agency would have: 
//  routesSource
//  localRoutesSource
//  alertsSource
//  departuresSource
//  routes
//  alerts
//  departures

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
    maxAge: 60000,
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
                rawRoutes = [],
                pickColor = function (modeName, routeName) {
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
            _(data.mode).each(function (mode) {
                _(rawRoutes).push({
                    txid: 'mode_' + mode.mode_name,
                    name: mode.mode_name,
                    mode: mode.mode_name,
                    color: pickColor(mode.mode_name, ''),
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
                        color: pickColor(mode.mode_name,
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
    setIsLocal: function () {
        if (this.agency === undefined && this.agency.localRoutes === undefined) {
            return 1;
        }
        this.each(function (r) {
            if (this.agency.localRoutes.findWhere(
                    {txid: r.get('txid')}
                ) !== undefined) {
                r.set({isLocal: true});
            }
        }, this);
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
            return model.get('affecteds')
                    .findWhere({modelType: 'AccessFeature'})
                    .get('stationName');
        default:
            return model.get(this.order);
        }
    },
    parse: function (data) {
        var parseMBTARealtime = function (data, routes) {
            var newAlerts = [], //Collection of new alerts is built here and returned
                newAlert,
                affected,
                color,
                i;

            if (data.alerts === undefined) { return []; }

            console.log(this);

            _(data.alerts).each(function (source) {
                console.log(this);
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

                i = 0;
                _(source.affected_services.services).each(function (el) {
                    console.log(this);
                    if (routes) {
                        if (el.hasOwnProperty('route_id') &&
                                routes.findWhere({txid: el.route_id})) {
                            affected = routes.findWhere(
                                {txid: el.route_id}
                            );
                        } else {
                            affected = routes.findWhere({
                                txid: 'mode_' + el.mode_name
                            });
                            newAlert.set({isSystemwide: true});
                        }
                        if (affected.get('isLocal')) {
                            newAlert.set({isLocal: true});
                        }
                        newAlert.get('affecteds').add(affected);

                        if (el.hasOwnProperty('stop_id') &&
                                !newAlert.get('affecteds').findWhere(
                                    {txid: el.stop_id}
                                )) {
                            color = routes.findWhere(
                                {txid: el.route_id}
                            ).get('color');
                            affected = new Stop({
                                txid: el.stop_id,
                                childName: el.stop_name,
                                parentName: el.parent_station_name,
                                color: color
                            });
                            newAlert.get('affecteds').add(affected);
                        }
                    } else {
                        if (el.hasOwnProperty('route_id')) {
                            affected = new Route({
                                txid: el.route_id,
                                name:   el.route_name,
                                mode:   el.mode_name,
                                color: '#FFFFFF',
                                isHidden: el.route_hide,
                                sortOrder: i
                            });
                            newAlert.get('affecteds').add(affected);
                            i += 1;
                        }
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

        console.log(this);
        switch (this.sourceType) {
        case 'MBTA-realtime':
            if (this.agency !== undefined &&
                    this.agency.routes !== undefined &&
                    this.agency.routes.length > 0) {
                return parseMBTARealtime(data, this.agency.routes);
            }
            return parseMBTARealtime(data);

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
        var parseMBTARealtime = function (data, routes) {



            var m = data.mode,
                r = routes,
                departures = [],
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

        switch (this.sourceType) {
        case 'MBTA-realtime':
            if (this.agency !== undefined &&
                    this.agency.routes !== undefined &&
                    this.agency.routes.length > 0) {
                return parseMBTARealtime(data, this.agency.routes);
            }
            return parseMBTARealtime(data);

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

var Agency = Backbone.Model.extend({
    defaults: {
        name: undefined,
        routes: undefined,
        localRoutes: undefined
    }
});

var AgencyDataset = Backbone.Model.extend({
    defaults: {
        agency: {},
        name: '',
        c: {},
        maxAge: 60000,
        sourceType: '',
        lastUpdated: Date(0),
        upToDate: false //Not up-to-date until it's been initialized.
    }
});

var st = {};

var init = function () {
    st.mbta = {};
    st.mbta.name = 'MBTA';

    st.mbta.routes = new Routes();
    st.mbta.routes.url = 'http://realtime.mbta.com/developer/api/v2/routes?api_key=17xKel6QtUOSVDtGlCgjlg&format=json';
    st.mbta.routes.agency = st.mbta;
    st.mbta.routes.sourceType = 'MBTA-realtime';

    st.mbta.localRoutes = new Routes();
    st.mbta.localRoutes.url = 'http://realtime.mbta.com/developer/api/v2/routesbystop?api_key=17xKel6QtUOSVDtGlCgjlg&stop=place-sull&format=json';
    st.mbta.localRoutes.agency = st.mbta;
    st.mbta.localRoutes.sourceType = 'MBTA-realtime';

    st.mbta.alerts = new Alerts();
    st.mbta.alerts.url = 'http://realtime.mbta.com/developer/api/v2/alerts?api_key=17xKel6QtUOSVDtGlCgjlg&include_access_alerts=true&format=json';
    st.mbta.alerts.agency = st.mbta;
    st.mbta.alerts.sourceType = 'MBTA-realtime';

    st.mbta.routes.on('sync', st.mbta.routes.setIsLocal);
    st.mbta.routes.listenTo(st.mbta.localRoutes, 'sync', st.mbta.routes.setIsLocal);

    st.mbta.routes.fetch();
    st.mbta.localRoutes.fetch();
    st.mbta.alerts.fetch();
};
