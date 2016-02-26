/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/RealtimeAgency
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/logger',//TODO add logging
    'models/Alert',
    'models/AccessFeature',
    'models/Stop',
    'models/Route',
    'collections/Alerts',
    'collections/Routes',
    'collections/Departures',
    'collections/RealtimeSource',
    'helper/input/inputLoop',
    'helper/mbta/pickRouteColor',//Future work: tie to agency generically
    'helper/process/combinedDelayAlert'
], function ($, _, Backbone, logger, Alert, AccessFeature, Stop, Route,
    Alerts, Routes, Departures, RealtimeSource, inputLoop, pickRouteColor,
    combinedDelayAlert) {

    var deriveDestination = function (departure) {

        var dest = {title: '', subtitle: '' },
            headsign = '',
            testVia = /\svia\s/, //Does destination sign contain "via"?
            getBeforeVia = /\svia\s[\W\w]+$/, //Text before word "via"
            getAfterVia = /^[\W\w]+\svia\s/,  //Text after word "via"
            testParens = /\(/,   //Does destination sign contain a "("?
            getBeforeParens = /\([\W\w]+$/, //Text before (
            getAfterParens = /^[\W\w]+\(/,  //Text after (
            removeCloseParens = /\)\s?$/,  //Text before )
            getAfterTo = /^[\W\w]+\sto\s/,  //Text after "... to "
            getBeforeSpace = /\s[\W\w]+$/;  //Text before " "
        if (departure.get('mode_name') !== 'Commuter Rail') {
            if (departure.get('trip_headsign')) {
                headsign = departure.get('trip_headsign');
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
                //Non-commuter rail, one-line destination
                dest.title = headsign;
                return dest;
            }
            //Non-commuter rail, no headsign text at all
            dest.title = departure.get('trip_name').replace(getAfterTo, '');
            return dest;
        }
        if (departure.get('trip_headsign')) {
            //commuter rail, with headsign
            dest.title = departure.get('trip_headsign');
            dest.subtitle = 'Train '
                + departure.get('trip_name').replace(getBeforeSpace, '');
            return dest;
        }
        dest.title = departure.get('direction_name');
        dest.subtitle = departure.get('route_name');
        return dest;

    };


    var RealtimeAgency = Backbone.Model.extend({
        defaults: {
            name: undefined,
            sourceType: 'MBTA-realtime',
            stops: [],
            routes: undefined,
            departures: undefined,
            alerts: undefined,
            outputLocalAlerts: true,
            outputSubwayAlerts: true,
            outputAllAlerts: false,
            outputDepartures: true
        },
        initialize: function () {
            var agency = this,
                defaultParams = {
                    api_key: agency.get('api_key'),
                    format: 'json'
                },
                allSources = [],
                routesSources = [],
                localRoutesSources = [],
                alertSources = [],
                departureSources = [],
                initializeSource = function (config, agency) {
                    var source = new RealtimeSource();
                    source.url = agency.get('baseURL') + config.command +
                        '?' + $.param(config.params);
                    source.nests = config.nests;
                    source.maxAge = config.maxAge;
                    source.agency = agency;
                    agency.set(config.sourceName, source);
                    return config;
                };
            agency.buildRoutes = _.bind(agency.buildRoutes, agency);
            agency.buildDepartures = _.bind(agency.buildDepartures, agency);
            agency.buildAlerts = _.bind(agency.buildAlerts, agency);
            agency.buildAffected = _.bind(agency.buildAffected, agency);

            agency.set({
                destinationFilter: new RegExp(agency.get('destinationFilter'))
            });

            initializeSource({
                sourceName: 'src_routes',
                command: 'routes',
                nests: ['mode', 'route'],
                maxAge: 86400000,
                params: defaultParams
            }, agency);
            allSources.push('src_routes');
            routesSources.push('src_routes');

            if (agency.get('outputLocalAlerts') &&
                    !agency.get('outputAllAlerts')) {
                _(agency.get('stops')).each(function (stop) {
                    var sourceName = 'src_localRoutes_' + stop.stop_id;
                    initializeSource({
                        sourceName: sourceName,
                        command: 'routesbystop',
                        nests: ['mode', 'route'],
                        maxAge: 86400000,
                        params: _({stop: stop.stop_id}).defaults(defaultParams)
                    }, agency);
                    allSources.push(sourceName);
                    routesSources.push(sourceName);
                    localRoutesSources.push(sourceName);
                });
            }
            agency.set({localRoutesSources: localRoutesSources});

            agency.set({alerts: new Alerts()});
            if (agency.get('outputLocalAlerts') ||
                    agency.get('outputSubwayAlerts') ||
                    agency.get('outputAllAlerts')) {
                initializeSource({
                    sourceName: 'src_alerts',
                    command: 'alerts',
                    nests: ['alerts'],
                    maxAge: 60000,
                    params: _({include_access_alerts: 'true'})
                        .defaults(defaultParams)
                }, agency);
                allSources.push('src_alerts');
                alertSources.push('routes');
                alertSources.push('src_alerts');
            }

            agency.set({departures: new Departures()});
            if (agency.get('outputDepartures')) {
                _(agency.get('stops')).each(function (stop) {
                    var sourceName = 'src_departures_' + stop.stop_id;
                    initializeSource({
                        sourceName: sourceName,
                        command: 'predictionsbystop',
                        nests: ['mode', 'route', 'direction', 'trip'],
                        maxAge: 30000,
                        params: _({stop: stop.stop_id,
                            include_service_alerts: 'false'
                            }).defaults(defaultParams)
                    }, agency);
                    agency.get(sourceName).locationName = stop.locationName;
                    allSources.push(sourceName);
                    departureSources.push(sourceName);
                });
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
                agency.get('alerts').listenTo(agency.get(source),
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
                modes,
                agency;

            agency = thisAgency || this; //future fix: how SHOULD this work?
            if (agency.get('src_routes') === undefined) {
                agency.get('routes').reset();
                return;
            }


            modes = _.uniq(agency.get('src_routes').map(function (route) {
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
                    txid: route.get('route_id'),
                    name:   route.get('route_name'),
                    mode:   route.get('mode_name'),
                    color: pickRouteColor(route.get('mode_name'),
                                route.get('route_name')),
                    isHidden: route.get('route_hide') || false,
                    sortOrder: i
                });
                i += 1;
            });

            if (agency.get('localRoutesSources') === undefined
                    || agency.get('localRoutesSources').length === 0) {
                agency.get('routes').reset(newRoutes);
                return;
            }

            _(agency.get('localRoutesSources')).each(function (locals) {
                locals = agency.get(locals);
                _(newRoutes).each(function (r) {
                    if (!r.isMode && locals.findWhere({route_id: r.txid})) {
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
                isLocal,
                isSubway,
                isSystemwide,
                affected,
                getElevatorName = /^[^a-z]+-\s?/,
                getElevatorStation = /\s?-[\W\w]+$/,
                mixedCase = function (str) {
                    return str.charAt(0).toUpperCase() +
                        str.substring(1).toLowerCase();
                };

            if (data === undefined) {
                thisAgency.get('alerts').reset();
                return;
            }

            data.each(function (source) {
                newAlert = new Alert({
                    txid: source.get('alert_id'),
                    timeframe: source.get('timeframe_text'),
                    disruptionType: source.get('effect_name'),
                    summary: source.get('service_effect_text'),
                    description: source.get('header_text'),
                    details: source.get('description_text'),
                    isService:
                        (source.get('affected_services').services.length > 0),
                    isNow: (source.get('alert_lifecycle') === 'New'),
                });
                if (source.get('effect_periods').length > 0) {
                    newAlert.set({
                        startTime: _(source.get('effect_periods'))
                            .first()
                            .effect_start * 1000,
                        endTime: _(source.get('effect_periods'))
                            .last()
                            .effect_end * 1000
                    });
                }

                if (source.get('banner_text')) {
                    newAlert.set({
                        isFeatured: true
                    });
                }

                switch (source.get('severity')) {
                case 'Informational':
                case 'Information':
                    newAlert.set({severityPct: 10});
                    break;
                case 'Minor':
                    newAlert.set({severityPct: 35});
                    break;
                case 'Moderate':
                case 'Significant':
                    newAlert.set({severityPct: 60});
                    break;
                case 'Severe':
                    if (newAlert.get('isFeatured')) {
                        newAlert.set({severityPct: 100});
                    } else {
                        newAlert.set({severityPct: 85});
                    }
                    break;
                default:
                    newAlert.set({severityPct: 50});
                }

                _(source.get('affected_services').elevators).each(function (e) {
                    affected = new AccessFeature({
                        txid: e.elev_id,
                        name: e.elev_name.replace(getElevatorName, ''),
                        type: e.elev_type,
                        stationName: _(e.stops).first().parent_station_name
                                ||  mixedCase(
                                e.elev_name.replace(getElevatorStation, '')
                            )
                    });
                    newAlert.get('affecteds').add(affected);
                    if (e.elev_type === 'Elevator') {
                        newAlert.set({isElevator: true});
                    }
                    if (newAlert.get('affectedElevator') === undefined) {
                        newAlert.set({
                            affectedElevatorId: affected.get('txid'),
                            affectedElevatorDescription: affected
                                .get('name'),
                            affectedStation: affected.get('stationName')
                        });
                    }
                    _(e.stops).each(function (stop) {
                        affected = new Stop({
                            txid: stop.stop_id,
                            childName: stop.stop_name,
                            parentName: stop.parent_station_name
                        });
                        newAlert.get('affecteds').add(affected);
                    });
                });

                if (source.get('alert_lifecycle') === 'Upcoming' &&
                        ((newAlert.get('severityPct') === 100) ||

                        (newAlert.get('startTime') < Date.now() + 604800000 &&
                            newAlert.get('severityPct') >= 75) ||

                        (newAlert.get('startTime') < Date.now() + 432000000 &&
                            newAlert.get('severityPct') >= 50) ||

                        (newAlert.get('startTime') < Date.now() + 432000000 &&
                            newAlert.get('isElevator')) ||

                        (newAlert.get('startTime') < Date.now() + 259200000 &&
                            newAlert.get('severityPct') >= 25) ||

                        (newAlert.get('startTime') < Date.now() + 129600000))) {
                    newAlert.set({isSoon: true});
                }

                if (newAlert.get('isElevator')
                        && newAlert.get('startTime') < Date.now()
                        && newAlert.get('startTime') >
                        Date.now() - 3628800000) {
                    newAlert.set({isNow: true});
                }

                if (newAlert.get('isElevator')
                        && (newAlert.get('isNow')
                            || newAlert.get('isSoon'))) {
                    newAlert.set('isRelevant', true);
                }

                isSubway = isLocal = isSystemwide = false;
                _(source.get('affected_services').services).each(function (el) {
                    if (el.hasOwnProperty('route_id') &&
                            !newAlert.get('affecteds').findWhere(
                                {txid: el.route_id}
                            )) {
                        if (thisAgency.get('routes').findWhere(
                                {txid: el.route_id}
                            )) {
                            affected = thisAgency.get('routes').findWhere(
                                {txid: el.route_id}
                            ).clone();
                        } else {
                            affected = new Route({
                                txid: el.route_id,
                                name:   el.route_name,
                                mode:   el.mode_name,
                                color: pickRouteColor(
                                    el.mode_name,
                                    el.route_name
                                ),
                                isHidden: el.route_hide,
                                sortOrder: 0
                            });
                        }
                        if (el.hasOwnProperty('direction_name')) {
                            affected.set(
                                {direction: el.direction_name}
                            );
                        }
                        if (!newAlert.get('affecteds')
                                .findWhere({txid: affected.get('txid')})) {
                            newAlert.get('affecteds').add(affected);
                            isLocal = isLocal ||
                                affected.get('isLocal');
                            isSubway = isSubway ||
                                (affected.get('mode') === 'Subway');
                        }
                    }

                    if (el.hasOwnProperty('stop_id') &&
                            !newAlert.get('affecteds').findWhere(
                                {txid: el.stop_id}
                            )) {
                        affected = new Stop({
                            txid: el.stop_id,
                            childName: el.stop_name,
                            parentName: el.parent_station_name,
                            color: pickRouteColor(el.mode_name,
                                el.route_name)
                        });
                        if (!newAlert.get('affecteds')
                                .findWhere({txid: affected.get('txid')})) {
                            newAlert.get('affecteds').add(affected);
                        }
                    }

                    if (!el.hasOwnProperty('route_id')
                            && !el.hasOwnProperty('stop_id')) {
                        if (thisAgency.get('routes').findWhere(
                                {txid: 'mode_' + el.mode_name}
                            )) {
                            affected = thisAgency.get('routes').findWhere(
                                {txid: 'mode_' + el.mode_name}
                            ).clone();
                        } else {
                            affected = new Route({
                                txid: 'mode_' + el.mode_name,
                                name:   el.mode_name,
                                mode:   el.mode_name,
                                color: pickRouteColor(el.mode_name, ''),
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

                newAlert.set({isRelevant: newAlert.get('isRelevant')
                    || isLocal || isSubway
                    || (thisAgency.get('outputAllAlerts')
                        && newAlert.get('isLocal'))});

                if (newAlert.get('disruptionType') === 'Delay' &&
                        ((isLocal && !isSubway)
                            || (thisAgency.get('outputAllAlerts') && !isSubway)
                            || (!isLocal && isSubway)) &&
                        !isSystemwide) {
                    newDelayAlerts.add(newAlert);
                } else if (newAlert.get('isRelevant')) {
                    newAlerts.push(newAlert);
                }

            }, this);

            if (newDelayAlerts.length > 0) {
                newAlerts.push(combinedDelayAlert(newDelayAlerts));
            }

            thisAgency.get('alerts').reset(newAlerts);
        },
        buildAffected: function (thisAgency) {
            return;
        },
        buildDepartures: function (thisAgency) {
            var departures = [], destination, route;
            _(thisAgency.get('departureSources')).each(function (src) {
                src = thisAgency.get(src);
                src.each(function (dep) {
                    destination = deriveDestination(dep);
                    if (thisAgency.get('routes').findWhere(
                            {
                                txid: dep.get('route_id')
                            }
                        )) {
                        route = thisAgency.get('routes').findWhere(
                            {
                                txid: dep.get('route_id')
                            }
                        ).clone();
                    } else {
                        route = new Route(
                            {
                                txid: dep.get('route_id'),
                                name: dep.get('route_name'),
                                mode: dep.get('mode_name'),
                                color: pickRouteColor(
                                    dep.get('mode_name'),
                                    dep.get('route_name')
                                )
                            }
                        );
                    }
                    if ((!(thisAgency.get('destinationFilter')) ||
                            !(thisAgency.get('destinationFilter').test(
                                destination.title
                            ))) &&
                            (!(thisAgency.get('suppressDepartures')) ||
                             !(_(thisAgency.get('suppressDepartures'))
                                .contains(route.get('mode'))))) {
                        departures.push({
                            route: route,
                            direction: dep.get('direction_name'),
                            tripId: dep.get('trip_id'),
                            destinationTitle: destination.title,
                            destinationSubtitle: destination.subtitle,
                            scheduledTime: dep.get('sch_dep_dt') * 1000,
                            predictedTime: dep.get('pre_dt') * 1000,
                            locationName: src.locationName
                        });
                    }
                });
            });
            thisAgency.get('departures').reset(departures);
            return;
        }
    });

    return RealtimeAgency;
});
