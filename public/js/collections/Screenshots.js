/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';



// Filename: collections/Screenshots
define([
    'jquery',
    'underscore',
    'backbone',
    'models/Screenshot'
], function ($, _, Backbone, Screenshot) {
    var Screenshots = Backbone.Collection.extend({
        model: Screenshot,
        order: 'genericText'
    });
    return Screenshots;
});
