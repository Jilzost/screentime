/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/ScreenModel
define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    var ScreenModel = Backbone.Model.extend({
        defaults: {
            titleText: ''
        }
    });
    return ScreenModel;
});
