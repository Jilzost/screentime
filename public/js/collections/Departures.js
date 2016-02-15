/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: collections/Departures
define([
    'jquery',
    'underscore',
    'backbone',
    'collections/AgencyComponents',
    'models/Departure'
], function ($, _, Backbone, AgencyComponents, Departure) {
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
        }
    });


    return Departures;
});
