/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: collections/Alerts
define([
    'jquery',
    'underscore',
    'backbone',
    'models/Alert',
    'models/AccessFeature',
    'models/Route',
    'models/Stop',
    'helper/mbta/pickRouteColor',
    'helper/logger'
], function ($, _, Backbone, Alert, AccessFeature,
        Route, Stop, pickRouteColor, logger) {
    var Alerts = Backbone.Collection.extend({

        model: Alert,
        maxAge: 60000, //FUTURE WORK validate role. 
        order: 'txid',
        comparator: function (model) {
            switch (this.order) {
            case 'byRoute':
                return model.get('affecteds').first().get('sortOrder');
            case 'byTime':
                return model.get('startTime') * 10000000000000 +
                        model.get('endTime');
            case 'byElevatorStation':
                return model.get('affectedStation') || model.get('summary');
            case 'byElevatorTimeAndStation':
                return (model.get('isSoon') ? model.get('startTime') : '0000') +
                    model.get('stationName') || model.get('summary');
            default:
                return model.get(this.order);
            }
        },
        parse: function (data) {
            var parseMBTARealtime = function (data) {
                var newAlerts = [], //Coll. of new alerts built here & returned
                    newAlert,
                    affected,
                    getElevatorName = /^[^a-z]+-\s?/,
                    getElevatorStation = /\s?-[\W\w]+$/,
                    mixedCase = function (str) {
                        return str.charAt(0).toUpperCase() +
                            str.substring(1).toLowerCase();
                    };

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
                        isService:
                            (source.affected_services.services.length > 0),
                        isSevere: (source.severity === 'Severe'),
                        isCurrent: (source.alert_lifecycle === 'New'),
                        isUpcoming: (source.alert_lifecycle === 'Upcoming')
                    });
                    if (source.effect_periods.length > 0) {
                        newAlert.set({
                            startTime: _(source.effect_periods)
                                .first()
                                .effect_start * 1000,
                            endTime: _(source.effect_periods)
                                .last()
                                .effect_end * 1000
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
                            name: el.elev_name.replace(getElevatorName, ''),
                            type: el.elev_type,
                            stationName: _(el.stops).first().parent_station_name
                                    ||  mixedCase(
                                    el.elev_name.replace(getElevatorStation, '')
                                )
                        });
                        newAlert.get('affecteds').add(affected);
                        if (el.elev_type === 'Elevator') {
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
                            ((newAlert.get('startTime') <
                                Date.now() + 604800000 &&
                            source.severity === 'Severe') ||
                                (newAlert.get('startTime') <
                                    Date.now() + 432000000 &&
                                    source.severity === 'Moderate') ||
                                (newAlert.get('startTime') <
                                    Date.now() + 432000000 &&
                                    source.severity === 'Significant') ||
                                (newAlert.get('startTime')
                                    < Date.now() + 432000000 &&
                                    newAlert.get('isElevator')) ||
                                (newAlert.get('startTime')
                                    < Date.now() + 259200000 &&
                                    source.severity === 'Minor'))) {
                        newAlert.set({isSoon: true});
                    }

                    if (newAlert.get('isElevator')
                            && newAlert.get('startTime') < Date.now()
                            && newAlert.get('startTime') >
                            Date.now() - 3628800000) {
                        newAlert.set({isCurrent: true});
                    }

                    _(source.affected_services.services).each(function (el) {
                        if (el.hasOwnProperty('route_id')) {
                            affected = new Route({
                                txid: el.route_id,
                                name:   el.route_name,
                                mode:   el.mode_name,
                                color: pickRouteColor(
                                    el.mode_name,
                                    el.route_name
                                ),
                                isHidden: el.route_hide
                            });
                        } else {
                            affected = new Route({
                                txid: el.route_id,
                                name:   el.route_name,
                                mode:   el.mode_name,
                                color: pickRouteColor(el.mode_name, ''),
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
                                color: pickRouteColor(el.mode_name,
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
                logger.log('st.c.Alerts',
                    'Unsupported data source ' + this.sourceType);
                return [];
            }
        }
    });

    return Alerts;
});
