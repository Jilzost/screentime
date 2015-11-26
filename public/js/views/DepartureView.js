/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';



// Filename: views/DepartureView
define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/departure.html'
], function ($, _, Backbone, departureTemplate) {
    var DepartureView = Backbone.View.extend({

        tagName: 'tr',
        template: _.template(departureTemplate),
        initialize: function () {
            this.listenTo(this.model, 'reset sync', this.render);
            this.render();

        },
        render: function () {
            var obj = this.model.toJSON(),
                html;
            obj.minsAway = this.model.minsAway();
            obj.route = this.model.get('route').toJSON();
            html = this.template(obj);
            this.$el.html(html);
            return this;
        }
    });

    return DepartureView;
});
