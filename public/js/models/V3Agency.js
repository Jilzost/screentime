/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 120 node: true */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/V3Agency
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/logger',//future: add logging
    'models/Alert',
    'models/AccessFeature',
    'models/Stop',
    'models/Route',
    'models/Train',
    'collections/Alerts',
    'collections/Routes',
    'collections/Trains',
    'collections/Departures',
    'collections/Psas',
    'collections/RealtimeSource',
    'collections/V3Source',
    'helper/input/inputLoop',
    'helper/mbta/pickRouteColor',//Future work: tie to agency generically
    'helper/process/combinedDelayAlert'
], function ($, _, Backbone, logger, Alert, AccessFeature, Stop, Route,
    Train, Alerts, Routes, Trains, Departures, Psas, RealtimeSource,
    V3Source, inputLoop, pickRouteColor, combinedDelayAlert) {

    var deriveDestination = function (input) {

        var dest = {title: '', subtitle: '', train: undefined },
            headsign = '',
            testVia = /\svia\s/, //Does destination sign contain "via"?
            getBeforeVia = /\svia\s[\W\w]+$/, //Text before word "via"
            getAfterVia = /^[\W\w]+\svia\s/,  //Text after word "via"
            testParens = /\(/,   //Does destination sign contain a "("?
            getBeforeParens = /\([\W\w]+$/, //Text before (
            getAfterParens = /^[\W\w]+\(/,  //Text after (
            removeCloseParens = /\)\s?$/;  //Text before )

        if (input.mode !== 'Commuter Rail') {
            headsign = input.headsign;
            if (testVia.test(headsign)) {
                //Non-commuter rail, has headsign with "via"
                dest.title = headsign.replace(getBeforeVia, '');
                dest.subtitle = headsign.replace(getAfterVia, 'via ');
                return dest;
            }
            if (testParens.test(headsign)) {
                //Non-commuter rail, has headsign with "()"
                dest.title =
                    headsign.replace(getBeforeParens, '');
                dest.subtitle =
                    headsign.replace(getAfterParens, '')
                        .replace(removeCloseParens, '');
                return dest;
            }
            dest.title = headsign;
            return dest;
        }
        dest.title = input.headsign;
        dest.train = input.train;
        return dest;
    };


    var V3Agency = Backbone.Model.extend({
        defaults: {
            name: undefined,
            sourceType: 'V3-API',
            stops: [],
            routes: undefined,
            departures: undefined,
            alerts: undefined,
            featuredAlerts: undefined,
            routesMaxAge: 86400000,
            departuresMaxAge: 30000,
            alertsMaxAge: 60000,
            outputLocalAlerts: true,
            outputSubwayAlerts: true,
            outputAllAlerts: false,
            outputDepartures: true
        },
        initialize: function () {
            var agency = this,
                defaultParams = {
                    api_key: agency.get('api_key')
                },
                allSources = [],
                routesSources = [],
                localRoutesSources = [],
                alertSources = [],
                departureSources = [],
                destOverride,
                stopString,
                initializeSourceV3 = function (config, agency) {
                    var source = new V3Source(),
                        params = [],
                        paramstring = '';
                    // source.url = agency.get('baseURL') + config.command +
                    //     '?' + $.param(config.params);
                    if (config.filters) {
                        params = _(config.filters).map(function (filter) {
                            return 'filter[' + filter.param + ']=' + filter.value;
                        });
                    }

                    if (config.include) {
                        _(params).push('include=' + config.include);
                    }

                    if (config.params && config.params.api_key) {
                        _(params).push('api_key=' + config.params.api_key);
                    }

                    if (params.length > 0) {
                        paramstring = _(params).reduce(function (memo, p) {
                            if (memo === '') {return '?' + p; }
                            return memo + '&' + p;
                        }, '');
                    }

                    source.url = agency.get('baseURL') + config.command + paramstring;
                    // source.nests = config.nests;
                    source.maxAge = config.maxAge;
                    source.agency = agency;
                    agency.set(config.sourceName, source);
                    return config;
                };
            agency.buildRoutes = _.bind(agency.buildRoutes, agency);
            agency.buildDepartures = _.bind(agency.buildDepartures, agency);
            agency.buildAlerts = _.bind(agency.buildAlerts, agency);
            agency.buildAffected = _.bind(agency.buildAffected, agency);

            if (agency.get('destinationFilter')) {
                agency.set({
                    destinationFilter: new RegExp(agency.get('destinationFilter'))
                });
            }
            if (agency.get('routeOverrideTest')) {
                agency.set({
                    routeOverrideTest: new RegExp(agency.get('routeOverrideTest'))
                });
            }
            if (agency.get('destOverride')) {
                destOverride = agency.get('destOverride');
                _(destOverride).each(function (over) {
                    over.test = new RegExp(over.test);
                });
                agency.set('destOverride', destOverride);
            }
            agency.get('destOverride');

            agency.set(
                'stops',
                _(agency.get('stops')).map(function (stop) {
                    if (_(stop).isString()) {stop = {id: stop}; }
                    return _(stop).defaults({
                        getPredictions: true,
                        makesAlertsLocal: true
                    });
                })
            );

            agency.set(
                'stopDirectionsIndex',
                _(agency.get('stops')).reduce(function (memo, stop) {
                    if (stop.hasOwnProperty('directionsToStop')) {
                        memo[stop.id] = stop.directionsToStop;
                    }
                    return memo;
                }, {})
            );

            initializeSourceV3({
                sourceName: 'src_routes',
                command: 'routes',
                nests: ['mode', 'route'],
                maxAge: agency.get('routesMaxAge'),
                params: defaultParams
            }, agency);
            allSources.push('src_routes');
            routesSources.push('src_routes');

            if (agency.get('outputLocalAlerts') &&
                    !agency.get('outputAllAlerts')) {
                stopString = _(agency.get('stops')).reduce(function (memo, stop) {
                    if (stop.makesAlertsLocal) {
                        if (memo === '') { return stop.id; }
                        return memo + ',' + stop.id;
                    }
                    return memo;
                }, '');
                initializeSourceV3({
                    sourceName: 'src_localRoutes',
                    command: 'routes',
                    maxAge: agency.get('routesMaxAge'),
                    filters: [{param: 'stop', value: stopString}],
                    params: defaultParams
                }, agency);
                allSources.push('src_localRoutes');
                routesSources.push('src_localRoutes');
                localRoutesSources.push('src_localRoutes');
            }
            agency.set({localRoutesSources: localRoutesSources});

            agency.set({psas: new Psas()});
            agency.set({alerts: new Alerts()});
            agency.set({featuredAlerts: new Alerts()});

            if (agency.get('outputLocalAlerts') ||
                    agency.get('outputSubwayAlerts') ||
                    agency.get('outputAllAlerts')) {
                initializeSourceV3({
                    sourceName: 'src_alerts',
                    command: 'alerts',
                    maxAge: agency.get('alertsMaxAge'),
                    filters: [{param: 'activity', value: 'BOARD,RIDE,EXIT,USING_WHEELCHAIR'}],
                    include: 'facilities',
                    params: defaultParams
                }, agency);
                allSources.push('src_alerts');
                alertSources.push('routes');
                alertSources.push('src_alerts');
            }

            agency.set({departures: new Departures()});
            if (agency.get('outputDepartures')) {
                stopString = _(agency.get('stops')).reduce(function (memo, stop) {
                    if (stop.getPredictions) {
                        if (memo === '') { return stop.id; }
                        return memo + ',' + stop.id;
                    }
                    return memo;
                }, '');

                initializeSourceV3({
                    sourceName: 'src_departures',
                    command: 'predictions',
                    maxAge: agency.get('departuresMaxAge'),
                    filters: [{param: 'stop', value: stopString}],
                    include: 'schedule,trip',
                    params: defaultParams
                }, agency);
                allSources.push('src_departures');
                departureSources.push('src_departures');
            }
            agency.set({departureSources: departureSources});

            agency.set({routes: new Routes()});

            _(routesSources).each(function (source) {
                agency.get('routes').listenTo(agency.get(source),
                        'reset sync',
                        function () {agency.buildRoutes(agency); });
            });

            _(alertSources).each(function (source) {
                agency.get('alerts').listenTo(agency.get(source),
                        'reset sync',
                        function () {
                        agency.buildAlerts(agency);
                        agency.buildAffected(agency);
                    });
            });

            _(departureSources).each(function (source) {
                agency.get('departures').listenTo(agency.get(source),
                        'reset sync',
                        function () {agency.buildDepartures(agency); });
            });

            _(allSources).reduce(function (t, name) {
                var feed = agency.get(name);
                inputLoop({feed: feed, waittime: t});
                return t + 222;
            }, 0);
        },
        buildRoutes: function (thisAgency) {
            var newRoutes = [],
                i = 0,
                routes,
                modes,
                agency,
                mode_names = {
                    0: 'Subway',
                    1: 'Subway',
                    2: 'Commuter Rail',
                    3: 'Bus',
                    4: 'Ferry',
                    5: 'Cable Car',
                    6: 'Gondola',
                    7: 'Funicular'
                };

            agency = thisAgency || this; //future fix: how SHOULD this work?
            if (agency.get('src_routes') === undefined) {
                agency.get('routes').reset();
                return;
            }

            routes = agency.get('src_routes');

            routes.each(function (route) {
                route.set({mode_name: mode_names[route.get('type')]});
                route.set({route_name: route.get('long_name') === "" ? route.get('short_name') : route.get('long_name')});
            });

            modes = _.uniq(routes.map(function (route) {
                return route.get('mode_name');
            }));

            _(modes).each(function (mode) {
                _(newRoutes).push({
                    txid: 'mode_' + mode,
                    name: mode,
                    mode: mode,
                    color: pickRouteColor(mode, ''),
                    isMode: true,
                    sortOrder: i
                });
                i += 1;
            });

            agency.get('src_routes').each(function (route) {
                _(newRoutes).push({
                    txid: route.get('id'),
                    name:   route.get('route_name'),
                    mode:   route.get('mode_name'),
                    color: pickRouteColor(route.get('mode_name'),
                                route.get('route_name')),
                    isHidden: route.get('route_hide') || false,
                    directionNames: route.get('direction_names') || ['Outbound', 'Inbound'],
                    sortOrder: i
                });
                i += 1;
            });

            if (agency.get('localRoutesSources') === undefined
                    || agency.get('localRoutesSources').length === 0) {
                agency.get('routes').reset(newRoutes);
                return;
            }

            //PICK BACK UP HERE

            _(agency.get('localRoutesSources')).each(function (locals) {
                locals = agency.get(locals);
                _(newRoutes).each(function (r) {
                    if (!r.isMode && locals.findWhere({id: r.txid})) {
                        r.isLocal = true;
                    }
                    if (r.isMode && locals.findWhere(
                            {mode_name: r.mode}
                        )) {
                        r.isLocal = true;
                    }
                }, agency);
            });
            agency.get('routes').reset(newRoutes);
            return;
        },
        buildAlerts: function (thisAgency) {
            var data = thisAgency.get('src_alerts'),
                newAlerts = [], //Coll. of new alerts built here & applied
                newDelayAlerts = new Alerts(),
                newAlert,
                newFeaturedAlert,
                isLocal,
                isSubway,
                isSystemwide,
                isElevator,
                isService,
                affected,
                route,
                mode_names = {
                    0: 'Subway',
                    1: 'Subway',
                    2: 'Commuter Rail',
                    3: 'Bus',
                    4: 'Ferry',
                    5: 'Cable Car',
                    6: 'Gondola',
                    7: 'Funicular'
                },
                relationship,
                containsEscalator = /escalator/,
                getElevatorStation = /\s?elevator unavailable|\s?access issue/,
                getElevatorStationBackup = /\s?-[\W\w]+$/,
                getElevatorName = /^[^a-z]+-\s?/,
                getTrainName = /^([^\s]{1,5})\s/,
                mixedCase = function (str) {
                    return str.charAt(0).toUpperCase() +
                        str.substring(1).toLowerCase();
                };

            if (data === undefined) {
                thisAgency.get('alerts').reset();
                return;
            }

            // Iterate for each alert in source data

            data.each(function (source) {

                //Create the alert and populate with basics

                newAlert = new Alert({
                    txid: source.get('id'),
                    timeframe: source.get('timeframe'),
                    disruptionType: source.get('effect'),
                    summary: source.get('service_effect'),
                    description: source.get('header'),
                    details: source.get('description'),
                    isService: false,
                    isNow: (source.get('lifecycle') === 'NEW'),
                    severityPct: source.get('severity') * 10
                });
                if (source.get('active_period').length > 0) {
                    newAlert.set({
                        startTime: Date.parse(
                            _(source.get('active_period'))
                                .first()
                                .start
                        ),
                        endTime: Date.parse(
                            _(source.get('active_period'))
                                .last()
                                .end
                        )
                    });
                }

                if (source.get('effect') === 'TRACK_CHANGE') {
                    newAlert.set({severityPct: newAlert.get('severityPct') - 10});
                }

                if (source.get('banner')) {
                    newAlert.set({
                        isFeatured: true
                    });
                }

                isSubway = isLocal = isSystemwide = isElevator = isService = false;
                _(source.get('informed_entity')).each(function (el) {
                    route = false;
                    if (el.hasOwnProperty('route') &&
                            !newAlert.get('affecteds').findWhere(
                                {txid: el.route}
                            )) {
                        isService = true;
                        if (thisAgency.get('routes').findWhere(
                                {txid: el.route}
                            )) {
                            route = thisAgency.get('routes').findWhere(
                                {txid: el.route}
                            ).clone();
                            newAlert.get('affecteds').add(route);
                            isLocal = isLocal ||
                                route.get('isLocal');
                            isSubway = isSubway ||
                                (route.get('mode') === 'Subway');
                        }
                    }

                    if (el.hasOwnProperty('facility') &&
                            (newAlert.get('disruptionType') === 'ELEVATOR_CLOSURE' ||
                             newAlert.get('disruptionType') === 'ACCESS_ISSUE') &&
                            !containsEscalator.test(newAlert.get('summary')) &&
                            !newAlert.get('affecteds').findWhere(
                                {txid: el.facility}
                            )) {
                        isElevator = true;
                        affected = new AccessFeature({
                            txid: el.facility,
                            name: '',
                            type: 'Elevator',
                            stationName: newAlert.get('summary').replace(getElevatorStation, '')
                        });

                        if (source.get('relationships') && source.get('relationships').facilities) {
                            relationship = _(source.get('relationships').facilities.data).findWhere({type: 'facility', id: el.facility});
                            if (relationship &&
                                    relationship.hasOwnProperty('attributes') &&
                                    relationship.attributes.hasOwnProperty('name')) {
                                affected.set({name: relationship.attributes.name.replace(getElevatorName, '')});
                                if (affected.get('stationName') === '') {
                                    affected.set({stationName: mixedCase(
                                        relationship.attributes.name.replace(getElevatorStationBackup, '')
                                    )});
                                }
                            }
                        }
                        newAlert.get('affecteds').add(affected);
                        newAlert.set({affectedElevatorId: affected.get('txid')});
                        newAlert.set({affectedStation: affected.get('stationName')});
                        newAlert.set({affectedElevatorDescription: affected.get('name')});
                    }

                    if (!el.hasOwnProperty('route')
                            && !el.hasOwnProperty('stop')
                            && el.hasOwnProperty('route_type')) {
                        isService = true;
                        if (thisAgency.get('routes').findWhere(
                                {txid: 'mode_' + mode_names[el.route_type]}
                            )) {
                            affected = thisAgency.get('routes').findWhere(
                                {txid: 'mode_' + mode_names[el.route_type]}
                            ).clone();
                        } else {
                            affected = new Route({
                                txid: 'mode_' + mode_names[el.route_type],
                                name:   mode_names[el.route_type],
                                mode:   mode_names[el.route_type],
                                color: pickRouteColor(mode_names[el.route_type], ''),
                                sortOrder: 0
                            });
                        }
                        if (!newAlert.get('affecteds')
                                .findWhere({txid: affected.get('txid')})) {
                            newAlert.get('affecteds').add(affected);
                            isLocal = isLocal ||
                                affected.get('isLocal');
                            isSubway = isSubway ||
                                (affected.get('mode') === 'Subway');
                            isSystemwide = true;
                        }
                    }
                }, this);

                newAlert.set({isService: isService});
                newAlert.set({isElevator: isElevator});


                if (source.get('lifecycle') === 'UPCOMING' &&
                        ((newAlert.get('startTime') < Date.now() + 604800000 &&
                            newAlert.get('severityPct') >= 70) ||

                        (newAlert.get('startTime') < Date.now() + 432000000 &&
                            newAlert.get('severityPct') >= 50) ||

                        (newAlert.get('startTime') < Date.now() + 432000000 &&
                            newAlert.get('isElevator')) ||

                        (newAlert.get('startTime') < Date.now() + 259200000 &&
                            newAlert.get('severityPct') >= 30) ||

                        (newAlert.get('startTime') < Date.now() + 129600000))) {
                    newAlert.set({isSoon: true});
                }

                if (newAlert.get('isElevator')
                        && newAlert.get('startTime') < Date.now()
                        && newAlert.get('startTime') >
                        Date.now() - 3628800000) {
                    newAlert.set({isNow: true});
                }


                if (isElevator && (newAlert.get('isNow') || newAlert.get('isSoon'))) {
                    newAlert.set({isRelevant: true});
                }
                if (((isLocal || isSubway) && newAlert.get('severityPct') >= 25) ||
                        ((isLocal && isSubway) && newAlert.get('severityPct') >= 10) ||
                        (thisAgency.get('outputAllAlerts') && newAlert.get('isService'))) {
                    newAlert.set({isRelevant: true});
                }

                if (newAlert.get('disruptionType') === 'DELAY' &&
                        newAlert.get('isRelevant') &&
                        ((isLocal && !isSubway)
                            || (thisAgency.get('outputAllAlerts') && !isSubway)
                            || (!isLocal && isSubway)) &&
                        !isSystemwide) {
                    newDelayAlerts.add(newAlert);
                } else if (newAlert.get('isRelevant')) {
                    newAlerts.push(newAlert);
                }

                if (source.get('banner')) {
                    newFeaturedAlert = newAlert.clone();
                    newFeaturedAlert.set({
                        description: source.get('banner'),
                        details: '',
                        affecteds: newAlert.get('affecteds').clone()
                    });
                }

            }, this);

            if (newDelayAlerts.length > 0) {
                newAlerts.push(combinedDelayAlert(newDelayAlerts));
            }

            thisAgency.get('alerts').reset(newAlerts);
            thisAgency.get('featuredAlerts').reset(newFeaturedAlert);
        },
        buildAffected: function (thisAgency) {
            return;
        },
        buildDepartures: function (thisAgency) {
            var departures = [], destination, route, newdep,
                dirIndex = thisAgency.get('stopDirectionsIndex'),
                pullUp = function (targetObj, attributesToPull) {
                    var match, rels = targetObj.get('relationships');
                    if (!rels) {return; }
                    _(attributesToPull).each(function (att) {
                        if (rels.hasOwnProperty(att) &&
                                rels[att].hasOwnProperty('data') &&
                                _.isArray(rels[att].data) &&
                                rels[att].data.length > 0) {
                            if (rels[att].data[0].attributes) {
                                match = _.defaults(
                                    rels[att].data[0].attributes,
                                    _(rels[att].data[0]).omit('attributes')
                                );
                            } else {
                                match = rels[att].data[0];
                            }
                            targetObj.set(att, match);
                        }
                    });
                };
            _(thisAgency.get('departureSources')).each(function (src) {
                var destFilt = thisAgency.get('destinationFilter'),
                    suppressModes = thisAgency.get('suppressDepartures');
                src = thisAgency.get(src);
                src.each(function (dep) {
                    newdep = {}; //pass to departures;
                    pullUp(dep, ['route', 'trip', 'schedule', 'stop']);

                    if (dep.get('schedule') && dep.get('schedule').pickup_type === 1) {
                        return;
                    }

                    if (thisAgency.get('destOverride') &&
                            dep.get('trip') &&
                            dep.get('trip').headsign) {
                        _(thisAgency.get('destOverride')).each(function (over) {
                            if (over.test.test(dep.get('trip').headsign) && over.replacement) {
                                dep.get('trip').headsign = over.replacement;
                            }
                        });
                    }

                    if (destFilt &&
                            dep.get('trip') &&
                            dep.get('trip').headsign &&
                            destFilt.test(dep.get('trip').headsign)) {
                        return;
                    }

                    if (dep.get('route') && thisAgency.get('routes').findWhere({txid: dep.get('route').id})) {
                        newdep.route = thisAgency.get('routes').findWhere(
                            {
                                txid: dep.get('route').id
                            }
                        ).clone();
                    } else if (dep.get('route') && dep.get('route').id) {
                        newdep.route = new Route(
                            {
                                txid: dep.get('route').id,
                                name: dep.get('route').id,
                                mode: 'Bus',
                                color: pickRouteColor('Bus', dep.get('route').id)
                            }
                        );
                    } else {
                        newdep.route = new Route(
                            {
                                txid: 'none',
                                name: '',
                                mode: 'Bus',
                                color: '#FFFFFF'
                            }
                        );
                    }

                    if (suppressModes &&
                            _(suppressModes).contains(newdep.route.get('mode'))) {
                        return;
                    }

                    destination = deriveDestination({
                        mode: newdep.route.get('mode'),
                        headsign: dep.get('trip').headsign || '',
                        train: dep.get('trip').name || ''
                    });

                    if (thisAgency.get('routeOverrideTest') &&
                            thisAgency.get('routeOverrideTest').test(
                                destination.title
                            )
                            ) {
                        newdep.route = new Route(thisAgency.get('routeOverride'));
                    }

                    if (dep.get('stop') &&
                            dep.get('stop').id &&
                            dirIndex[dep.get('stop').id]) {
                        newdep.showLocationName = true;
                        newdep.locationName = dirIndex[dep.get('stop').id];
                    }

                    newdep.destinationTitle = destination.title;
                    newdep.destinationSubtitle = destination.subtitle;
                    newdep.train = destination.train;
                    if (dep.get('trip')) {
                        newdep.direction =
                                newdep.route.get('directionNames')[
                                dep.get('trip').direction_id || 0
                            ];
                    }
                    if (dep.get('schedule') && dep.get('schedule').arrival_time) {
                        newdep.scheduledTime = Date.parse(
                            dep.get('schedule').arrival_time
                        );
                    } else if (dep.get('schedule') && dep.get('schedule').departure_time) {
                        newdep.scheduledTime = Date.parse(
                            dep.get('schedule').departure_time
                        );
                    }
                    if (dep.get('arrival_time')) {
                        newdep.predictedTime = Date.parse(
                            dep.get('arrival_time')
                        );
                    } else {
                        newdep.predictedTime = Date.parse(
                            dep.get('departure_time')
                        );
                    }
                    if (dep.get('trip')) {
                        newdep.tripId = dep.get('trip').id;
                    }

                    departures.push(newdep);

                });
            });
            thisAgency.get('departures').reset(departures);
            return;
        }
    });

    return V3Agency;
});
