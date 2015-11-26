/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: views/AlertViewSimple
//TODO confirm whether text requirejs plugin will work without installation
define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/alert-simple.html'
], function ($, _, Backbone, alertTemplate) {
    var AlertViewSimple = Backbone.View.extend({

        tagName: 'div',
        className: 'alert',
        template: _.template(alertTemplate),
        initialize: function () {
            this.listenTo(this.model, 'reset sync', this.render);
            this.render();
        },
        render: function () {
            var html;
            html = this.template();
            this.$el.html(html);
            return this;
        }
    });

    return AlertViewSimple;
});
