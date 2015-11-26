/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/project
define([
    'jquery',
    'underscore',
    'backbone'
], function ($, _, Backbone) {
    var Clock = Backbone.View.extend({
        el: '#clock',
        initialize: function () {
            this.render = _.bind(this.render, this);
            setInterval(function (self) {
                return self.render;
            }(this), 1000);
        },
        render: function () {
            var today = new Date(),
                h = today.getHours(),
                m = today.getMinutes();
            if (m < 10) { m = '0' + m; }
            if (h > 12) { h -= 12; }
            this.$el.html(h + ':' + m);
        }
    });
    return Clock;
});
