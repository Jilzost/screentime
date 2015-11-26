/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/Agency
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/logger',
    'helper/mbta/combineRoutesAndLocal',
    'helper/mbta/initializeAgency'
], function ($, _, Backbone, logger, combineRoutesAndLocal, initializeAgency) {
    var Agency = Backbone.Model.extend({

        defaults: {
            name: undefined,
            sourceType: undefined,
            routes: undefined,
            departures: undefined,
            alerts: undefined,
        },
        initialize: function () {
            switch (this.get('sourceType')) {
            case 'MBTA-realtime':
                initializeAgency(this);
                break;
            default:
                logger.log(
                    'Agency',
                    'Unsupported data source ' + this.get('sourceType')
                );
            }
        },
        combineRoutesAndLocal: function () {
            combineRoutesAndLocal(this);
        }
    });

    return Agency;
});
