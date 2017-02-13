/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: collections/Psas
define([
    'jquery',
    'underscore',
    'backbone',
    'models/Psa'
], function ($, _, Backbone, Psa) {

    var Psas = Backbone.Collection.extend({
        model: Psa,
        urls: [],
        sourceType: 'psa',
        maxAge: 72600,
        comparator: 'lastShown',
        lastUpdated: 0,
        // parse: function (data) {
        //     return unnest(data, this.nests);
        // }
        parse: function (data) {
            return data.images;
        }
    });

    return Psas;
});
