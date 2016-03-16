/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, define,
speechSynthesis, document, window */
'use strict';

// Filename: models/Sign
// 
// NEXT STEPS: 
// loadstart should start the carousel. 
// start screenshotManager
define([
    'jquery',
    'underscore',
    'backbone',
    'helper/process/filterProperties',
    'helper/process/agencyModelIndex',
    'models/Clock',
    'models/Heartbeat',
    'models/ScreenData',
    'models/ScreenModel',
    'models/ScreenshotManager',
    'models/Speaker',
    'views/DeparturesView',
    'views/AlertsView',
    'views/AlertViewElevator',
    'views/AlertViewSimple',
    'views/AlertViewTimeframe',
    'views/AlertViewFeatured'

], function ($, _, Backbone, filterProperties, agencyModelIndex,
    Clock, Heartbeat, ScreenData, ScreenModel,
    ScreenshotManager, Speaker, DeparturesView, AlertsView, AlertViewElevator,
    AlertViewSimple, AlertViewTimeframe, AlertViewFeatured) {
    var Sign = Backbone.Model.extend({
        defaults: {
            clock: {},
            startTime: Date(0),
            logging: true,
            heartbeat: true,
            signId: '',
            status: '', //FUTURE WORK Store sign's status and show as needed 
            heartbeatRate: 200000,
            lastUpdate: Date(0),
            lastHeartbeat: Date(0),
            agencies: {},
            screenViews: {},
            screenModels: {},
            screenData: {},
            screenshots: {},
            slideDuration: 10000,
            shortSlideDuration: 2000
        },
        initialize: function () {
            var models = {};

            if (this.get('signId') === '') {
                this.set({
                    signId: window
                        .location
                        .search
                        .replace(/[\?\&]id=([^\?\&]*)/i, '$1')
                });
            }

            this.set({clock: new Clock()});

            this.set({startTime: Date.now()});

            this.sendHeartbeat = _.bind(this.sendHeartbeat, this);
            this.loadStart = _.bind(this.loadStart, this);
            this.runSlideshow = _.bind(this.runSlideshow, this);
            this.showSlide = _.bind(this.showSlide, this);

            this.set({screenData: new ScreenData()});

            //FUTURE WORK WILL REPLACE SOME OF WHAT FOLLOWS
            // new model: Insight.
            // Represents something shown on a slide, which has a header, a body
            // Has information on the header; the collection; filter info;
            // info on what view to use for collection; probably the element.
            // Spiritual successor to ScreenModel.  
            // new view: InsightView.
            // departures, service updates, etc. all InsightViews. 

            ///notes from earlier:
            //...again raises the question of where exactly the change from 
            //"alerts" to specifics should take place. 
            //Perhaps screenData could have currentAlerts, upcomingServiceAlerts
            //etc. and have them reference its own "alerts".
            //This would also give ScreenData something to do. 
            //
            //But is it possible to do it even later, at the view?
            //
            //Ultimately instead of ScreenData should the aggregation be like an
            //agency, whose data source is other agencies? Like an AggAgency
            //model. (Agg for Aggregate.)
            //
            //It could even be only invoked when there are multiple agencies.
            //Otherwise the views just reference the agency directly. 
            //I'm liking this. 
            //
            //Next steps: 
            //Modify view so that it checks for condition property 
            //(could be function) and uses it if available
            //
            //Modify this file so that it provides those things to 
            //each of the different views
            //
            //Modify this file so that the views reference the 1 agency 
            //directly (with a note to add AggAgency later)
            //
            //Test!

            models.departures = new ScreenModel({
                titleText: 'Departures',
                titleFormat: 'CSS_DeparturesTitle',
                routeColHeader: 'Route',
                destinationColHeader: 'Destination',
                minutesAwayColHeader: 'Mins',
                collection: this.get('screenData').get('departures')
            });
            models.serviceAlerts = new ScreenModel({
                titleText: 'Service Updates',
                titleFormat: 'CSS_CurrentAlertsTitle',
                where: {
                    isRelevant: true,
                    isNow: true,
                    isService: true
                },
                sortOrder: 'byRoute',
                collection: this.get('screenData').get('alerts')
            });
            models.upcomingAlerts = new ScreenModel({
                titleText: 'Coming Up',
                titleFormat: 'CSS_UpcomingAlertsTitle',
                where: {
                    isRelevant: true,
                    isSoon: true,
                    isService: true
                },
                sortOrder: 'byTimeAndRoute',
                collection: this.get('screenData').get('alerts')
            });

            models.elevatorAlerts = new ScreenModel({
                titleText: 'Elevators Unavailable',
                titleFormat: 'CSS_ElevatorAlertsTitle',
                where: {
                    isElevator: true,
                    isRelevant: true
                },
                sortOrder: 'byElevatorStation',
                collection: this.get('screenData').get('alerts')
            });
            models.featuredAlerts = new ScreenModel({
                titleText: 'Important Notice',
                titleFormat: 'CSS_FeaturedAlertsTitle',
                collection: this.get('screenData').get('featuredAlerts')
            });

            this.set({screenModels: models});

            this.loadStart();
        },
        loadStart: function () {
            var newAgency, targetAgency, self = this;
            $('#status').html('Loading...');

            $.get('getsignconfig?id=' + this.get('signId'))
                .done(function (data) {
                    var configData,
                        config,
                        x;
                    configData = JSON.parse(data);

                    //Configure agencies
                    _(configData.agencies).each(function (aName) {
                        config = filterProperties(configData, aName, '_');

                        newAgency =
                            new agencyModelIndex[config.sourceType](config);
                        this.get('agencies')[aName] = newAgency;

                        _(['alerts',
                            'featuredAlerts',
                            'departures']).each(function (x) {
                            if (newAgency.get(x)) {
                                this.get('screenData').get(x + 'Sources').push(
                                    newAgency.get(x)
                                );
                                this.get('screenData').get(x).listenTo(
                                    newAgency.get(x),
                                    'reset sync change',
                                    function () {
                                        return self.get('screenData')
                                            .refresh(x);
                                    }
                                );
                            }
                        }, this);
                    }, self);

                    //FUTURE WORK
                    //The following is not finished and is not used yet. 
                    //targetAgency will be either the one agency or AggAgency. 
                    if (_(self.get('agencies')).keys().length === 1) {
                        _(self.get('agencies')).each(function (a) {
                            targetAgency = a;
                        });
                    } else {
                        console.log('WARNING: unsupported number of agencies');
                        //future: AggAgency here
                    }


                    self.set({screenViews: {
                        departures: new DeparturesView({
                            model: self.get('screenModels').departures,
                        }),
                        currentAlerts: new AlertsView({
                            el: '#currentAlerts',
                            model: self.get('screenModels').serviceAlerts,
                            AlertView: AlertViewSimple
                        }),
                        upcomingAlerts: new AlertsView({
                            el: '#upcomingAlerts',
                            model: self.get('screenModels').upcomingAlerts,
                            AlertView: AlertViewTimeframe
                        }),
                        elevatorAlerts: new AlertsView({
                            el: '#elevatorAlerts',
                            model: self.get('screenModels').elevatorAlerts,
                            AlertView: AlertViewElevator
                        }),
                        featuredAlerts: new AlertsView({
                            el: '#featuredAlerts',
                            model: self.get('screenModels').featuredAlerts,
                            AlertView: AlertViewFeatured
                        })
                    }});

                    //configure speaker
                    config = filterProperties(
                        configData,
                        'speaker',
                        '_'
                    );
                    config.sign = self;
                    self.set({speaker: new Speaker(config)});

                    //configure sign
                    config = filterProperties(configData, 'sign', '_');
                    for (x in config) {
                        if (config.hasOwnProperty(x)) {
                            self.set(x, config[x]);
                        }
                    }

                    if (self.get('heartbeat')) {
                        //FUTURE WORK is using function (self) best practice?
                        setInterval(function (self) {
                            return self.sendHeartbeat;
                        }(self), self.get('heartbeatRate'));
                    }

                    //configure screenshotManager
                    config = filterProperties(
                        configData,
                        'screenshots',
                        '_'
                    );
                    config.signId = self.get('signId');
                    self.set({
                        screenshotManager: new ScreenshotManager(config)
                    });


                    self.runSlideshow(
                        [
                            self.get('screenViews').featuredAlerts,
                            self.get('screenViews').departures,
                            self.get('screenViews').currentAlerts,
                            self.get('screenViews').upcomingAlerts,
                            self.get('screenViews').elevatorAlerts
                        ]
                    );
                })
                .fail(function () {
                    setTimeout(function () {this.loadStart(); }, 10000);
                    // log('st.lib.loadStart', 'getsignconfig failed');
                });
        },
        runSlideshow: function (allSlides) {
            var topBottom = function (allToRotate, i, screenHeight) {
                    var topGroup, bottomGroup, topHeight, bottomHeight;
                    topGroup = _(allToRotate).initial(i);
                    bottomGroup = _(allToRotate).last(i);
                    topHeight = _(topGroup).reduce(function (memo, view) {
                        return view.lastHeight + memo;
                    }, 0);
                    bottomHeight = _(bottomGroup).reduce(function (memo, view) {
                        return Math.max(view.lastHeight, memo);
                    }, 0);
                    if (topHeight + bottomHeight > screenHeight) {
                        return false;
                    }
                    return {topGroup: topGroup, bottomGroup: bottomGroup};
                },
                slides = [],
                screenHeight = window.innerHeight,
                t = 0,
                nextSlideInfo = {},
                self = this,
                i = 0,
                groups = false,
                wait = self.get('slideDuration'),
                shortWait = self.get('shortSlideDuration');

            self.set({lastUpdated: Date.now()});

            //1. Identify the list of slides to be shown. 
            slides = _(allSlides).filter(
                function (s) {return s.hasContent; }
            );

            //2. If there are 0 or 1 slides to show, just show them.
            if (slides.length <= 1) {
                setTimeout(function () {
                    self.showSlide(slides, allSlides);
                }, t);
                t += 2000;
                setTimeout(function () {
                    self.runSlideshow(allSlides);
                }, t);
                return;
            }

            //3. determine if first slide(s) are to be shown 
            //on a screen by themselves (solo). If so show them.
            //At the end we have the list of remaining slides. 
            slides = _(slides).rest().reduce(function (memo, next) {
                var slide;
                //If we are currently paging and the current slide must be
                //paged, page the current slide
                if (memo.mustPage &&
                        memo.curr.lastHeight + next.lastHeight > screenHeight) {
                    slide = memo.curr;
                    setTimeout(function () {
                        self.showSlide(
                            [slide],
                            allSlides
                        );
                    }, t);
                    t += wait;
                    memo.curr = next;
                    memo.remaining = [next];
                    return memo;
                }
                //if we are paging we can no longer page
                memo.mustPage = false;
                memo.remaining.push(next);
                return memo;

            }, {curr: _(slides).first(),
                mustPage: true,
                remaining: [_(slides).first()]
                }).remaining;

            //4. If there is 1 remaining slides to show, just show it.
            if (slides.length === 1) {
                setTimeout(function () {
                    self.showSlide(
                        slides,
                        allSlides
                    );
                }, t);
                t += wait;
                if (t === wait) { t = shortWait; }
                setTimeout(function () {
                    self.runSlideshow(allSlides);
                }, t);
                return;
            }

            //5. Try to cycle remaining slides in groups, holding top
            //constant while bottom rotates. 
            //For n = 1 to the total number of slides - 1, 
            //can we hold n - 1 slides on top, 
            //and rotate through the remaining n slides on the bottom?
            //(If n = 1 that means showing all slides at once.)
            for (i = 1; i < slides.length; i += 1) {
                if (!groups) {
                    groups = topBottom(slides, i, screenHeight);
                }
            }
            //If any top/bottom grouping was found
            if (groups) {
                _(groups.bottomGroup).each(function (bottomView) {
                    var toShow = groups.topGroup.concat([bottomView]),
                        bottomGroup = groups.bottomGroup;
                    setTimeout(function () {
                        self.showSlide(
                            toShow,
                            allSlides,
                            bottomGroup
                        );
                    }, t);
                    t += wait;
                });
                if (t === wait) { t = shortWait; }
                setTimeout(function () {
                    self.runSlideshow(allSlides);
                }, t);
                return;
            }

            //6. Build slides, fitting as much as you can on each (in order)
            nextSlideInfo = _(slides).rest().reduce(function (memo, view) {
                var toShow;
                if (memo.height + view.lastHeight <= screenHeight) {
                    memo.views.push(view);
                    memo.height += view.lastHeight;
                    return memo;
                }
                toShow = memo.views;
                setTimeout(function () {
                    self.showSlide(toShow, allSlides);
                }, memo.t);
                return {
                    views: [view],
                    height: view.lastHeight,
                    t: memo.t + wait
                };
            }, {views: [_(slides).first()],
                height: _(slides).first().lastHeight, t: t});

            t = nextSlideInfo.t;
            if (nextSlideInfo.views.length > 0) {
                setTimeout(function () {
                    self.showSlide(nextSlideInfo.views, allSlides);
                }, t);
                t += wait;
            }
            setTimeout(function () {
                self.runSlideshow(allSlides);
            }, t);
        },
        showSlide: function (showViews, allViews, allBottomViews) {
            var hasContent = false,
                totalHeights = 0,
                screenHeight = window.innerHeight,
                gapHeight = 0,
                bottomHeight = false;

            if (allBottomViews) {
                bottomHeight =
                    _(allBottomViews).reduce(function (memo, view) {
                        return Math.max(memo, view.lastHeight);
                    }, 0);
            }
            totalHeights = _(showViews).reduce(function (memo, view) {
                view.$el.css({'padding-bottom': 0});
                if (bottomHeight && _(allBottomViews).contains(view)) {
                    return bottomHeight + memo;
                }
                if (view.$el.html() === '') {return memo; }
                return view.lastHeight + memo;
            }, 0);

            if (totalHeights * 1.01 < screenHeight) {
                gapHeight = Math.floor(
                    (screenHeight - totalHeights) /
                        Math.max(showViews.length, 1)
                );
            }

            _(allViews).each(function (v) {
                if (_(showViews).contains(v)) {
                    v.$el.show();
                    v.render();
                    v.$el.css({'padding-bottom': gapHeight});
                    if (v.$el.html() !== '') {
                        hasContent = true;
                    }
                } else {
                    v.$el.hide();
                }
            });
            if (hasContent) {
                $('#status').hide();
            } else {
                $('#status').html('No information is available at this time.');
                $('#status').show();
            }
        },
        sendHeartbeat: function () {
        //FUTURE WORK there is much about sendHeartbeat that should be improved.
        //Really there should be a sign-state object, which is defined the
        //same way on both client and server, and the sign uses backbone's
        //native features to update it. 
        //FUTURE WORK the *2.1 is to provide a buffer so one hb can be missed,
        //but that should REALLY be handled server-side

        //if (this.get('lastUpdate') + this.get('heartbeatRate') < Date.now()){
        //     return;
        // }

        //FUTURE WORK this should be moved into a separate error logging fxn

            var heartbeat = new Heartbeat(
                {
                    sign: this.get('signId'),
                    uptime: Date.now() - this.get('startTime'),
                    heartbeatRate: this.get('heartbeatRate') * 2.1
                }
            );
            $.post('postheartbeat', JSON.stringify(heartbeat));
            this.set({lastHeartbeat: Date.now()});
        }
    });
    return Sign;
});
