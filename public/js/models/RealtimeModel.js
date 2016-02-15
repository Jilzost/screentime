/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/RealtimeModel
define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    var RealtimeModel = Backbone.Model.extend({
        defaults: {
            modelType: 'RealtimeModel',
            txid: '',
            name: ''
        }
    });

    return RealtimeModel;
});
