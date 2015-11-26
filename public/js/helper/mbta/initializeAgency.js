/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';



// Filename: helper/mbta/initializeAgency.js
define([
    'jquery',
    'underscore',
    'backbone',
    'collections/Alerts',
    'collections/Routes',
    'collections/Departures',
    'helper/input/inputLoop',
    'helper/mbta/chooseNextDepartures',
    'helper/mbta/combineAlertsAndRoutes',
    'helper/mbta/combineRoutesAndLocal',
    'helper/process/currentServiceAlertsCD'
], function ($, _, Backbone, Alerts, Routes, Departures,
    inputLoop, chooseNextDepartures,
    combineAlertsAndRoutes, combineRoutesAndLocal,
    currentServiceAlertsCD) {
    var initializeAgency = function (newAgency) {

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
            constructor: Routes,
            fromAPI: true,
            baseURL: newAgency.get('baseURL'),
            command: 'routes',
            params: defaultParams
        }, newAgency)});

        sourceNames.push('routesSource');

        newAgency.set('routes', initializeComponent({
            constructor: Routes,
            fromAPI: false,
        }, newAgency));

        newAgency.get('routes').listenTo(
            newAgency.get('routesSource'),
            'sync reset',
            function () {return combineRoutesAndLocal(newAgency); }
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
                        constructor: Routes,
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
                        return combineRoutesAndLocal(newAgency);
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
                constructor: Alerts,
                fromAPI: false,
            }, newAgency));
        });
        newAgency.get('upcomingServiceAlerts').order = 'byTime';
        newAgency.get('elevatorAlerts').order = 'byElevatorStation';

        if (newAgency.get('behavior_suppressAlerts') !== true) {
            newAgency.set('alertsSource', initializeComponent({
                constructor: Alerts,
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
                            combineAlertsAndRoutes(
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
                        return currentServiceAlertsCD(newAgency.get('alerts'));
                    }
                },
                {
                    collection: 'featuredAlerts',
                    process: function () {
                        return newAgency.get('alerts')
                            .where({isFeatured: true});
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
                        return x;
                    }
                },
            ]).each(function (x) {
                newAgency.get(x.collection)
                    .listenTo(newAgency.get('alerts'),
                        'reset sync',
                        function () {
                            newAgency.get(x.collection).reset(x.process());
                        });
            });
        }

        /********************* departures *********************/
        newAgency.set('departures', initializeComponent({
            constructor: Departures,
            fromAPI: false,
        }, newAgency));

        newAgency.set({departuresCollections: []});

        if (newAgency.get('behavior_suppressDepartures') !== true) {

            _(newAgency.get('stops')).each(function (stop) {
                var name = 'departuresSource_' + stop.stop_id;

                newAgency.set(name, initializeComponent({
                    constructor: Departures,
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
                        return chooseNextDepartures(newAgency);
                    }
                );

                newAgency.get('departuresCollections').push(name);
                sourceNames.push(name);
            });
        }

        newAgency.set({outputs: ['featuredAlerts',
            'currentServiceAlertsCD', 'upcomingServiceAlerts',
            'elevatorAlerts', 'departures']});


        _(sourceNames).each(function (name) {
            var feed = newAgency.get(name);
            feed.fetch({
                success: function () {
                    inputLoop({feed: feed});
                },
                error: function () {
                    inputLoop({feed: feed, failed: true});
                }
            });
        });

    };

    return initializeAgency;
});