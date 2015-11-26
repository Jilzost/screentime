/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: collections/Departures
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/logger',
    'collections/AgencyComponents',
    'models/Departure',
    'models/Route',
    'helper/mbta/pickRouteColor',
    'helper/mbta/deriveDestination'
], function ($, _, Backbone, logger, AgencyComponents, Departure, Route,
    pickRouteColor, deriveDestination) {
    var Departures = AgencyComponents.extend({

        model: Departure,
        order: 'routeOrder',
        comparator: function (a, b) {
            switch (this.order) {
            case 'routeOrder':
                return a.get('route').get('sortOrder') -
                        b.get('route').get('sortOrder');
            case 'predictionTimeOrder':
                if (a.get('isPrediction') && !b.get('isPrediction')) {
                    return -1;
                }
                if (b.get('isPrediction') && !a.get('isPrediction')) {
                    return 1;
                }
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
                            //generate "destinationTitle", "destinationSubtitle"
                                destination = deriveDestination(
                                    mode.mode_name,
                                    route.route_name,
                                    direction.direction_name,
                                    trip
                                );
                                departures.push({
                                    route: new Route(
                                        {
                                            txid: route.route_id,
                                            name:   route.route_name,
                                            mode:   mode.mode_name,
                                            color: pickRouteColor(
                                                mode.mode_name,
                                                route.route_name
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
                logger.log('Departures',
                    'Unsupported data source ' + this.sourceType);
                return [];
            }
        }
    });


    return Departures;
});
