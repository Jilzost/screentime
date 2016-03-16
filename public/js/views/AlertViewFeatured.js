/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: views/AlertViewFeatured
define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/alert-featured.html'
], function ($, _, Backbone, alertTemplate) {
    var AlertViewFeatured = Backbone.View.extend({

        tagName: 'div',
        className: 'featuredAlert',
        template: _.template(alertTemplate),
        initialize: function () {
            this.listenTo(this.model, 'reset sync', this.render);
            this.render();
        },
        render: function () {
            console.log(this);
            var html;
            html = this.template();
            this.$el.html(html);
            return this;
        }
    });

    return AlertViewFeatured;
});
