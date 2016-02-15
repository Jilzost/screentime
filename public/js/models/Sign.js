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
    'views/AlertViewTimeframe'

], function ($, _, Backbone, filterProperties, agencyModelIndex,
    Clock, Heartbeat, ScreenData, ScreenModel,
    ScreenshotManager, Speaker, DeparturesView, AlertsView, AlertViewElevator,
    AlertViewSimple, AlertViewTimeframe) {
    var Sign = Backbone.Model.extend({
        defaults: {
            clock: {},
            startTime: Date(0),
            logging: true,
            heartbeat: true,
            signId: '',
            status: '', //FUTURE WORK Store sign's status and show as needed 
            heartbeatRate: 60000,
            lastUpdate: Date(0),
            lastHeartbeat: Date(0),
            agencies: {},
            screenViews: {},
            screenModels: {},
            screenData: {},
            screenshots: {}
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

            if (this.get('heartbeat')) {
                //FUTURE WORK is using function (self) best practice?
                setInterval(function (self) {
                    return self.sendHeartbeat;
                }(this), this.get('heartbeatRate'));
            }

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
                collection: this.get('screenData').get('alerts')
            });

            models.elevatorAlerts = new ScreenModel({
                titleText: 'Elevators Unavailable',
                titleFormat: 'CSS_ElevatorAlertsTitle',
                where: {
                    isElevator: true,
                    isRelevant: true
                },
                collection: this.get('screenData').get('alerts')
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
                        agencyConfig,
                        signConfig,
                        speakerConfig,
                        x;
                    configData = JSON.parse(data);

                    _(configData.agencies).each(function (aName) {
                        agencyConfig = filterProperties(configData, aName, '_');
                        // newAgency = new Agency(agencyConfig);
                        // this.get('agencies')[aName] = newAgency;

                        newAgency = new agencyModelIndex[agencyConfig.sourceType](agencyConfig); //TESTCODE
                        //console.log(this.get('agencies'));
                        this.get('agencies')[aName] = newAgency;    //TESTCODE
                        //console.log(this.get('agencies'));

                        _(['alerts', 'departures']).each(function (x) {
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
                            // collection: targetAgency.get('alerts'),
                            model: self.get('screenModels').serviceAlerts,
                            AlertView: AlertViewSimple,
                            // where: {
                            //     isRelevant: true,
                            //     isNow: true,
                            //     isService: true
                            // },
                            titleText: 'Service Updates',//UNUSED
                            titleFormat: 'CSS_CurrentAlertsTitle',//UNUSED
                        }),
                        upcomingAlerts: new AlertsView({
                            el: '#upcomingAlerts',
                            // collection: targetAgency.get('alerts'),
                            model: self.get('screenModels').upcomingAlerts,
                            AlertView: AlertViewTimeframe,
                            // where: {
                            //     isRelevant: true,
                            //     isSoon: true,
                            //     isService: true
                            // },
                            titleText: 'Coming Up',
                            titleFormat: 'CSS_UpcomingAlertsTitle',
                        }),
                        elevatorAlerts: new AlertsView({
                            el: '#elevatorAlerts',
                            // collection: targetAgency.get('alerts'),
                            model: self.get('screenModels').elevatorAlerts,
                            AlertView: AlertViewElevator,
                            // where: {
                            //     isElevator: true,
                            //     isRelevant: true
                            // },
                            titleText: 'Elevators Unavailable',
                            titleFormat: 'CSS_ElevatorAlertsTitle',
                        })
                    }});


                    speakerConfig = filterProperties(
                        configData,
                        'speaker',
                        '_'
                    );
                    speakerConfig.sign = self;
                    self.set({speaker: new Speaker(speakerConfig)});

                    signConfig = filterProperties(configData, 'sign', '_');
                    for (x in signConfig) {
                        if (signConfig.hasOwnProperty(x)) {
                            self.set(x, signConfig[x]);
                        }
                    }

                    self.runSlideshow(self.get('screenViews').departures,
                        [
                            self.get('screenViews').currentAlerts,
                            self.get('screenViews').upcomingAlerts,
                            self.get('screenViews').elevatorAlerts
                        ]);
                    self.set({screenshotManager: new ScreenshotManager({
                        syncScreenshotFreq: 30000
                    })});


                })
                .fail(function () {
                    setTimeout(function () {this.loadStart(); }, 10000);
                    // log('st.lib.loadStart', 'getsignconfig failed');
                });
        },
        runSlideshow: function (primary, allSecondaries, standalone) {
            var totalHeights = 0,
                comboHeight = 0,
                screenHeight = window.innerHeight,
                allViews = [],
                showViews = [],
                someSecondaries = [],
                t = 0,
                nextSlideInfo = {},
                self = this;
            // console.log(self); //TESTCODE
            // console.log(primary);
            // console.log(allSecondaries);
            if (standalone) {
                _(allViews).push(standalone);
            }
            allViews.push(primary);
            allViews = allViews.concat(allSecondaries);
            someSecondaries = _(allSecondaries).filter(
                function (v) {return v.hasContent; }
            );
            if (standalone && standalone.hasContent) {
                self.showSlide([standalone], allViews);
                t += 10000;
            }

            totalHeights = _(someSecondaries).reduce(function (memo, view) {
                return view.lastHeight + memo;
            }, primary.lastHeight);

            if (totalHeights <= screenHeight || someSecondaries.length === 0) {
                showViews.push(primary);
                _(someSecondaries).each(function (s) {
                    showViews.push(s);
                });
                setTimeout(function () {
                    self.showSlide(showViews, allViews);
                }, t);
                if (t === 0) {t = 1000; } else {t += 10000; }
                setTimeout(function () {
                    self.runSlideshow(primary, allSecondaries, standalone);
                }, t);
                return;
            }

            comboHeight = primary.lastHeight;
            comboHeight += _(someSecondaries).reduce(function (memo, view) {
                return Math.max(view.lastHeight, memo);
            }, 0);
            if (comboHeight < screenHeight) {
                t = _(someSecondaries).reduce(function (memo, view) {
                    setTimeout(function () {
                        self.showSlide([primary, view], allViews);
                    }, memo);
                    return memo + 10000;
                }, t);
                setTimeout(function () {
                    self.runSlideshow(primary, allSecondaries, standalone);
                }, t);
                return;
            }

            nextSlideInfo = _(someSecondaries).reduce(function (memo, view) {
                if (memo.height + view.lastHeight <= screenHeight) {
                    memo.views.push(view);
                    memo.height += view.lastHeight;
                    return memo;
                }
                setTimeout(function () {
                    self.showSlide(memo.views, allViews);
                }, memo.t);
                return {
                    views: [view],
                    height: view.lastHeight,
                    t: memo.t + 10000
                };
            }, {views: [primary], height: primary.lastHeight, t: t});

            t = nextSlideInfo.t;
            if (nextSlideInfo.views.length > 0) {
                setTimeout(function () {
                    self.showSlide(nextSlideInfo.views, allViews);
                }, t);
                t += 10000;
            }
            setTimeout(function () {
                self.runSlideshow(primary, allSecondaries, standalone);
            }, t);
            //FUTURE WORK make timing configurable
            self.set({lastUpdated: Date.now()});
        },
        showSlide: function (showViews, allViews) {
            var hasContent = false;
            _(allViews).each(function (v) {
                if (_(showViews).contains(v)) {
                    v.$el.show();
                    v.render();
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
