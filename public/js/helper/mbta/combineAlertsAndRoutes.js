/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/mbta/combineAlertsAndRoutes.js
define([
    'jquery',
    'underscore',
    'backbone',
], function ($, _, Backbone) {
    var combineAlertsAndRoutes = function (alerts, routes) {

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

    return combineAlertsAndRoutes;
});