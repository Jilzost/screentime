/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: combineRoutesAndLocal.js
define([
    'jquery',
    'underscore',
    'backbone',
], function ($, _, Backbone) {
    var combineRoutesAndLocal = function (agency) {

        var routeList = [];
        if (agency.get('routesSource') === undefined) {
            agency.get('routes').reset();
        } else {
            routeList = agency.get('routesSource').toArray();
            _(agency.get('localRoutesCollections')).each(function (l) {
                _(routeList).each(function (r) {
                    if (agency.get(l).findWhere({txid: r.get('txid')})) {
                        r.set({isLocal: true}, {async: true});
                    }
                });
            });
            agency.get('routes').reset(routeList);
        }
    };

    return combineRoutesAndLocal;
});