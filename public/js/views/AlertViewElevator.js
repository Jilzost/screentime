/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: views/AlertViewElevator
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/format/capitalize',
    'helper/format/mixCase',
    'views/ElevatorView',
    'text!templates/alert-elevator.html'
], function ($, _, Backbone, capitalize, mixCase, ElevatorView, alertTemplate) {
    var AlertViewElevator = Backbone.View.extend({

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

            this.model.get('affecteds').each(function (x) {
                var item;

                if (x.get('modelType') !== 'AccessFeature') {
                    return this;
                }

                item = new ElevatorView(
                    {model: x}
                );
                this.$('.elevatorCurrent').append(item.render().$el);
                // TODO revisit speech
                // if (renderRefreshAll) {
                //     this.speechScript.push(x.get('description'));
                // }
            }, this);

            return this;
        }
    });


    return AlertViewElevator;
});
