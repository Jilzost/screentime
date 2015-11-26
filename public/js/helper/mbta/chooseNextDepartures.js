/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/mbta/chooseNextDepartures.js
define([
    'jquery',
    'underscore',
    'backbone',
    'collections/Departures'
], function($, _, Backbone, Departures) {
    var chooseNextDepartures = function (agency) {

        var deps = new Departures(),
            nextDeps = new Departures();

        _(agency.get('departuresCollections')).each(function (d) {
            deps.push(agency.get(d).toArray()); //TODO need to test this
        });

        nextDeps.order = 'presentationOrder';
        deps.order = 'predictionTimeOrder';
        deps.sort();

        deps.each(function (dep) {
            if (agency.get('routes').findWhere(
                    {
                        txid: dep.get('route').get('txid')
                    }
                )) {
                dep.get('route').set(agency.get('routes').findWhere(
                    {
                        txid: dep.get('route').get('txid')
                    }
                ).toJSON());
            }
            if (dep.get('isPrediction') && dep.isSoon() &&
                    !(agency.get('destinationFilter') &&
                        agency.get('destinationFilter').test(
                            dep.get('destinationTitle')
                        )
                    )) {
                if (!nextDeps.findWhere({
                        serviceGroup: dep.get('serviceGroup')
                    })) {
                    nextDeps.add(dep);
                }
            }
        });

        agency.get('departures').reset(nextDeps.toArray());
    };

    return chooseNextDepartures;
});