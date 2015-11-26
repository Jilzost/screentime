/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/AccessFeature
define([
    'jquery',
    'underscore',
    'backbone',
    'models/AgencyComponent'
], function ($, _, Backbone, AgencyComponent) {
    var AccessFeature = AgencyComponent.extend({
        defaults: {
            modelType: 'AccessFeature',
            color: '#80AAFF',
            type: '',
            stationName: '',
        }
    });
    return AccessFeature;
});
