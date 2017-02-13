/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: helper/process/agencyModelIndex.js
define([
    'jquery',
    'underscore',
    'backbone',
    'models/AggAgency',
    'models/RealtimeAgency',
    'models/PsaAgency'
], function ($, _, Backbone, AggAgency, RealtimeAgency, PsaAgency) {
    var agencyModelIndex = {
        'AggAgency': AggAgency,
        'MBTA-realtime': RealtimeAgency,
        'psa-only': PsaAgency
    };

    return agencyModelIndex;
});
