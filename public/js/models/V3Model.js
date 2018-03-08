/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/V3Model
define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    var V3Model = Backbone.Model.extend({
        defaults: {
            modelType: 'V3Model',
            txid: '',
            name: ''
        }
    });

    return V3Model;
});
