/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: views/DeparturesView
define([
    'jquery',
    'underscore',
    'backbone',
    'collections/Departures',
    'views/DepartureView',
    'text!templates/departures.html'
], function ($, _, Backbone, Departures, DepartureView, departuresTemplate) {
    var nextDepartures = function (deps) {
        var nextDeps = new Departures();

        deps = new Departures(deps.toArray());

        nextDeps.order = 'presentationOrder';
        deps.order = 'predictionTimeOrder';
        deps.sort();

        deps.each(function (dep) {

            if (!nextDeps.findWhere({
                    serviceGroup: dep.get('serviceGroup')
                })) {
                nextDeps.add(dep);
            }
        });
        return (nextDeps.toArray());
    };

    var DeparturesView = Backbone.View.extend({

        el: '#departures',
        template: _.template(departuresTemplate),
        initialize: function () {
            this.listenTo(this.model, 'reset sync', this.render);
            if (this.model.get('collection') !== undefined) {
                this.listenTo(
                    this.model.get('collection'),
                    'reset sync',
                    this.render
                );
            }
            this.lastHeight = 0;
            this.fontSize = 100;
            this.minFontSize = 80; //TODO make this configurable
            this.hasContent = false;
            this.speechScript = [];
            this.renderDuration = false;
            this.subSlides = 1;
            this.renderRefreshAll = false;
            this.renderOnly = false;
            this.subSlidesByDeps = [];
            this.render();
        },
        render: function () {
            var self = this,
                html,
                deps,
                soonDeps,
                originalHeight,
                height,
                subSlides,
                depsPerSubSlide,
                renderRefreshAll = this.renderRefreshAll, //plan to show all
                renderDuration = this.renderDuration, //duration
                renderOnly = this.renderOnly, //render only these deps
                hasRoutes = false,
                hasTrains = false,
                innerHeight = this.innerHeight || window.innerHeight,
                buildingSpeech = false;


            this.renderRefreshAll = this.renderDuration = false;
            this.renderOnly = false;

            //if there was no input.duration (meaning this was triggered by
            //something other than showSlide), and there's > 1 subSlide
            //meaning whe may be in the midst of showing some of the
            //information bit by bit), do nothing.

            if ((!renderRefreshAll && !renderOnly)
                    && (this.subSlides > 1)) {
                return this;
            }

            //if there is no model, set to blank.

            if (renderRefreshAll) {
                this.speechScript = [];
                buildingSpeech = true;
            } else {
                buildingSpeech = false;
            }
            if (!renderOnly &&
                    (this.model === undefined ||
                    this.model.get('collection') === undefined ||
                    this.model.get('collection').length === 0)) {
                this.$el.html('');
                this.lastHeight = 0;
                this.hasContent = false;
                return this;
            }
            this.hasContent = true;
            html = this.template(this.model.toJSON());
            this.fontSize = 100;
            this.$('tbody').css('fontSize', this.fontSize + '%');
            this.$el.html(html);
            originalHeight = this.$el.height();
            if (buildingSpeech) {
                this.speechScript.push(this.model.get('titleText'));
            }

            //identify what departures to show

            if (renderOnly) {
                deps = renderOnly;
            } else {
                deps = nextDepartures(this.model.get('collection'));
                soonDeps = _(deps).filter(function (x) {
                    return (x.isSoon());
                });
                if (soonDeps.length > 0) {
                    deps = new Departures(soonDeps);
                } else {
                    deps = new Departures(deps);
                }
            }

            //sort
            deps.order = 'presentationOrder';
            deps.sort();

            //if we know from experience that we will need subslides
            //then don't bother rendering

            //console.log("To show: " + deps.length  + " "
            //+ this.subSlidesByDeps[deps.length]);
            if (!this.subSlidesByDeps[deps.length]
                    || this.subSlidesByDeps[deps.length] < 2
                    || renderOnly) {

                //render
                deps.each(function (x) {
                    var item = new DepartureView(
                        {model: x, className: x.get('route').get('mode')}
                    );
                    if (x.get('train')) {
                        this.$('#route-departures-header').before(item.render().$el);
                        hasTrains = true;
                    } else {
                        this.$('#departurestable tbody').append(item.render().$el);
                        hasRoutes = true;
                    }
                }, this);
                if (!hasTrains) {this.$('#train-departures-header').hide(); }
                if (!hasRoutes) {this.$('#route-departures-header').hide(); }

                //shrink as needed to fit

                height = Math.max(this.$el.height(), 1);
                originalHeight = height - originalHeight;
                while (this.fontSize > 1
                        && height > innerHeight) {
                    this.fontSize -= 1;
                    this.$('tbody').css('fontSize', this.fontSize + '%');
                    height = Math.max(this.$el.height(), 1);
                }
                if (!renderOnly) {this.lastHeight = height; }
            }

            if (buildingSpeech) {
                deps.each(function (x) {
                    var routeName;
                    if (x.get('train')) {
                        this.speechScript.push(
                            'Train ' +
                                x.get('train') +
                                ' to ' +
                                x.get('destinationTitle') + ', ' +
                                x.minsAway() +
                                (x.minsAway() === 1 ? ' minute' : ' minutes') +
                                (x.get('showLocationName') ?
                                        ', ' + x.get('locationName') :
                                        '')
                        );
                    } else {
                        routeName =
                            x.get('route').get('longName').replace('/', ' ');
                        if (routeName === '') {
                            routeName = 'Next service to';
                        }
                        this.speechScript.push(
                            routeName +
                                ' ' +
                                x.get('destinationTitle') + ', ' +
                                x.minsAway() +
                                (x.minsAway() === 1 ? ' minute' : ' minutes') +
                                (x.get('showLocationName') ?
                                        ', ' + x.get('locationName') :
                                        '')
                        );
                    }
                }, this);
            }

            //if we already know we have to make subslides, or
            //if too much shrinking was necessary and conditions right to
            //make subslides,
            //then do so
            if ((this.subSlidesByDeps[deps.length]
                    && this.subSlidesByDeps[deps.length] >= 2) ||
                    (this.fontSize <= this.minFontSize
                        && renderRefreshAll
                        && renderDuration && deps.length > 0)) {
                this.fontSize = 100;

                //calculate number of subslides
                this.$('.tbody').css('fontSize', this.fontSize + '%');
                if (this.subSlidesByDeps[deps.length]) {
                    subSlides = this.subSlidesByDeps[deps.length];
                } else {
                    subSlides = Math.ceil(originalHeight / innerHeight);
                    this.subSlidesByDeps[deps.length] = subSlides;
                }

                //calculate departures per subslide (round up)

                depsPerSubSlide = Math.ceil(deps.length / subSlides);

                //iterate through the departures, building lists;
                //each time you have depsPerSubSlide deps
                //(or are on last dep) create subslide

                deps.reduce(function (memo, dep) {
                    memo.nextDepGroup.push(dep);
                    if (memo.nextDepGroup.length >= memo.depsPerSubSlide
                            || memo.depsRemainingAfterThis <= 0) {
                        setTimeout(function () {
                            self.renderOnly = new Departures(memo.nextDepGroup);
                            self.render();
                        }, memo.nextWait);
                        return {
                            nextWait: memo.nextWait + memo.eachDuration,
                            nextDepGroup: [],
                            depsPerSubSlide: memo.depsPerSubSlide,
                            depsRemainingAfterThis:
                                memo.depsRemainingAfterThis - 1,
                            eachDuration: memo.eachDuration
                        };
                    }
                    return {
                        nextWait: memo.nextWait,
                        nextDepGroup: memo.nextDepGroup,
                        depsPerSubSlide: memo.depsPerSubSlide,
                        depsRemainingAfterThis:
                                memo.depsRemainingAfterThis - 1,
                        eachDuration: memo.eachDuration
                    };
                }, {
                    nextWait: 0,
                    nextDepGroup: [],
                    depsPerSubSlide: depsPerSubSlide,
                    depsRemainingAfterThis: deps.length - 1,
                    eachDuration: renderDuration / subSlides
                });
                self.subSlides = subSlides;
            } else {
                if (renderRefreshAll) {
                    self.subSlides = 1;
                }
            }
            return this;

        }
    });

    return DeparturesView;
});
