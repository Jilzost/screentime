/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/Psa
define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    var Psa = Backbone.Model.extend({
        defaults: {
            modelType: 'Psa',
            url: '',
            displayOrder: 0,
            lastShown: Date(0)
        },
        initialize: function () {
          if (this.get('lastShown') === 0) {
            this.set({lastShown: this.get('displayOrder')});
          }
        }

    });

    return Psa;
});
