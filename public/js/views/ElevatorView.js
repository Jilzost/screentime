/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: views/ElevatorView
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/format/capitalize',
    'helper/format/mixCase',
    'text!templates/one-elevator.html'
], function ($, _, Backbone, capitalize, mixCase, elevatorTemplate) {
    var ElevatorView = Backbone.View.extend({

        tagName: 'div',
        className: 'elevator',
        template: _.template(elevatorTemplate),
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


    return ElevatorView;
});
