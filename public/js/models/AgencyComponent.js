/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/AgencyComponent
define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    var AgencyComponent = Backbone.Model.extend({
        defaults: {
            modelType: 'AgencyComponent',
            txid: '',
            name: ''
        },
        regexes: function () {
            return [new RegExp('\\b(' + this.escape('name') + ')\\b', 'gi')];
        }
    });

    return AgencyComponent;
});
