/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: collections/Routes
// st.c.Routes
define([
    'jquery',
    'underscore',
    'backbone',
    'collections/AgencyComponents',
    'models/Route',
    'helper/mbta/pickRouteColor',
    'helper/logger'
], function ($, _, Backbone, AgencyComponents, Route, pickRouteColor, logger) {
    var Routes = AgencyComponents.extend({
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
                        color: pickRouteColor(mode.mode_name, ''),
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
                            color: pickRouteColor(mode.mode_name,
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
                logger.log('st.c.Routes', 'Unsupported data source '
                    + this.sourceType);
                return [];
            }
        },
    });

    return Routes;
});
