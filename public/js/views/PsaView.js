/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: views/PsaView
define([
    'jquery',
    'underscore',
    'backbone',
    'text!templates/psa.html'
], function ($, _, Backbone, psaTemplate) {
    var PsaView = Backbone.View.extend({

        tagName: 'div',
        className: 'psa',
        template: _.template(psaTemplate),
        initialize: function () {
            this.listenTo(this.model, 'reset sync', this.render);
            this.render();
        },
        render: function () {
            var obj = this.model.toJSON(),
                html;
            html = this.template(obj);
            this.$el.html(html);
            return this;
        }
    });

    return PsaView;
});
