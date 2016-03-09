/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: collections/Trains
define([
    'jquery',
    'underscore',
    'backbone',
    'collections/AgencyComponents',
    'models/Train'
], function ($, _, Backbone, AgencyComponents, Train) {
    var Trains = AgencyComponents.extend({
        model: Train,
        comparator: 'sortOrder',
        maxAge: 86400000
    });

    return Trains;
});
