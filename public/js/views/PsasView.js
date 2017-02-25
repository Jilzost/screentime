/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: views/PsasView
define([
    'jquery',
    'underscore',
    'backbone',
    'collections/Psas',
    'views/PsaView',
    'text!templates/psas.html'
], function ($, _, Backbone, Psas, PsaView, psasTemplate) {
    var PsasView = Backbone.View.extend({

        el: '#psas',
        template: _.template(psasTemplate),
        initialize: function () {
            this.listenTo(this.model, 'reset sync', this.render);
            if (this.model.get('collection') !== undefined) {
                this.listenTo(
                    this.model.get('collection'),
                    'reset sync',
                    this.render
                );
            }
        },
        render: function () {
            var psa,
                psaView,
                html,
                innerHeight = this.innerHeight || window.innerHeight;

            if (this.model.get('collection').length === 0) {
                this.$el.html('');
                this.hasContent = false;
                this.lastHeight = 0;
                return this;
            }

            this.hasContent = true;
            this.lastHeight = innerHeight;

            html = this.template(this.model.toJSON());
            this.$el.html(html);


            //this.model.get('collection').sort();
            //psa = (this.model.get('collection').first());

            //psa = (this.model.get('collection').first());
            psa = (this.model.get('collection').sample());

            psaView = new PsaView({model: psa});

            this.$('.psa-list').append(psaView.render().$el);

            //psa.set({lastShown: Date.now() }); //Uncommenting this line leads to an infinite loop!
            //Need to either go back to the source and change lastShown there,
            //or pick a different way to walk through the PSAs.
            //

            return this;

        }
    });

    return PsasView;
});
