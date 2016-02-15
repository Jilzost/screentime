/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/process/agencyModelIndex.js
define([
    'jquery',
    'underscore',
    'backbone',
    'models/RealtimeAgency'
], function ($, _, Backbone, RealtimeAgency) {
    var agencyModelIndex = {
        'MBTA-realtime': RealtimeAgency
    };

    return agencyModelIndex;
});
