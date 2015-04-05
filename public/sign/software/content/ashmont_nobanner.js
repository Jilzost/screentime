/*jslint devel: true indent: 4 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, speechSynthesis, document, window */

var c = {
    file: 'ashmont.js', //Name of this file
    visualElements: {
        welcome: {
            visualizer: 'static',
            div: 'welcome',
            parameters: {
                text: '<span style="font-size: 250%">Welcome to Ashmont</span>'
            }
        },
        featuredAlerts: {
            visualizer: 'static',
            div: 'departures',
            requiredFacets: {
                departures: 'mbtaNextDepartures'
            },
            parameters: {
                text: ''
            }
        },
        departures: {
            visualizer: 'departures',
            div: 'departures',
            requiredFacets: {
                departures: 'mbtaNextDepartures'
            },
            parameters: {
                title: {
                    text: 'Departures',
                    format: 'CSS_DeparturesTitle'
                }
            }
        },
        currentAlerts: {
            visualizer: 'alerts',
            div: 'currentAlerts',
            requiredFacets: {
                alerts: 'mbtaCurrentServiceAlerts'
            },
            parameters: {
                title: {
                    text: 'Service Updates',
                    format: 'CSS_CurrentAlertsTitle'
                }
            }
        },
        upcomingAlerts: {
            visualizer: 'alerts',
            div: 'upcomingAlerts',
            requiredFacets: {
                alerts: 'mbtaUpcomingServiceAlerts'
            },
            parameters: {
                title: {
                    text: 'Coming Up',
                    format: 'CSS_UpcomingAlertsTitle'
                }
            }
        },
        elevatorAlerts: {
            visualizer: 'alerts',
            div: 'elevatorAlerts',
            requiredFacets: {
                alerts: 'mbtaElevatorAlerts'
            },
            parameters: {
                title: {
                    text: 'Elevators Unavailable',
                    format: 'CSS_ElevatorAlerts'
                },
                footer: 'See mbta.com for suggested alternatives.'
            }
        },
    },
    agencies: {
        MBTA: {
            id: 'MBTA',
            name: 'MBTA',
            showName: false,
            displayOrder: 0
        }
    },
    facets: {
        mbtaAgencyRoutes: {
            generatorFunction: 'routesFromMBTARealtime',
            alwaysUpdate: false,
            requiredDatasources: {
                MBTARealtimeRoutes: 'source_agencyRoutesMBTA'
            }
        },
        mbtaLocalRoutes: {
            generatorFunction: 'routesFromMBTARealtime',
            alwaysUpdate: false,
            requiredDatasources: {
                MBTARealtimeRoutes: 'source_localRoutesMBTA'
            }
        },
        mbtaAgencyAlerts: {
            generatorFunction: 'alertsFromMBTARealtime',
            alwaysUpdate: false,
            requiredDatasources: {
                mbtaRealtimeAlerts: 'source_agencyAlertsMBTA'
            },
            requiredFacets: {
                localRoutes: 'mbtaLocalRoutes',
                agencyRoutes: 'mbtaAgencyRoutes'
            }
        },
        mbtaFeaturedAlerts: {
            generatorFunction: 'objectsMatchATemplate',
            alwaysUpdate: false,
            requiredFacets: {
                source: 'mbtaAgencyAlerts'
            },
            parameters: {
                templates: [{isFeatured: true }]
            }
        },
        mbtaCurrentServiceAlerts: {
            generatorFunction: 'extractCurrentServiceAlertsCombiningDelaysAndSort',
            alwaysUpdate: false,
            requiredFacets: {
                alerts: 'mbtaAgencyAlerts',
                routes: 'mbtaAgencyRoutes'
            }
        },
        mbtaUpcomingServiceAlerts: {
            generatorFunction: 'extractUpcomingServiceAlertsAndSort',
            alwaysUpdate: false,
            requiredFacets: {
                alerts: 'mbtaAgencyAlerts',
                routes: 'mbtaAgencyRoutes'
            }
        },
        mbtaElevatorAlerts: {
            generatorFunction: 'extractElevatorAlertsAndSort',
            alwaysUpdate: false,
            requiredFacets: {
                alerts: 'mbtaAgencyAlerts'
            }
        },

        mbtaAllDepartures: {
            generatorFunction: 'departuresFromMBTARealtime',
            alwaysUpdate: true,
            requiredDatasources: {
                MBTARealtimeTimes: 'source_localPredictionsMBTA'
            },
            requiredFacets: {
                routes: 'mbtaAgencyRoutes'
            },
            parameters: {
                destinationFilter: /^Ashmont/ //Used to filter out predictions going to this station. Optional.
            }
        },
  /*
        mbtaAllPredictedDepartures: {
            generatorFunction: 'departuresFromMBTARealtime',
            alwaysUpdate: true,
            requiredDatasources: {
                MBTARealtimeTimes: 'source_localPredictionsMBTA'
            },
            requiredFacets: {
                routes: 'mbtaAgencyRoutes'
            },
            parameters: {
                destinationFilter: /^Forest\sHills/ //Used to filter out predictions going to this station. Optional.
            }
        },
        mbtaAllScheduledDepartures: {
            generatorFunction: 'departuresFromMBTARealtime',
            alwaysUpdate: true,
            requiredDatasources: {
                MBTARealtimeTimes: 'source_localScheduleMBTA'
            },
            requiredFacets: {
                routes: 'mbtaAgencyRoutes'
            },
            parameters: {
                destinationFilter: /^Forest\sHills/ //Used to filter out predictions going to this station. Optional.
            }
        },
        mbtaAllDepartures: {
            generatorFunction: 'append',
            alwaysUpdate: false,
            requiredDatasources: {},
            requiredFacets: {
                one: 'mbtaAllPredictedDepartures',
                two: 'mbtaAllScheduledDepartures'
            }
        },
        */
        mbtaNextDepartures: {
            generatorFunction: 'nextDeparturesFromDepartures',
            alwaysUpdate: false,
            requiredDatasources: {},
            requiredFacets: {
                departures: 'mbtaAllDepartures',
            }
        }
    },
    datasources: {
        agencyRoutes: {
            id: 'source_agencyRoutesMBTA',
            format: 'MBTA_realtime',
            maxAge: 86400000,
            URL: 'http://realtime.mbta.com/developer/api/v2/routes?api_key=17xKel6QtUOSVDtGlCgjlg&format=json'
        },
        agencyAlerts: {
            id: 'source_agencyAlertsMBTA',
            format: 'MBTA_realtime',
            maxAge: 119000,
            URL: 'http://realtime.mbta.com/developer/api/v2/alerts?api_key=17xKel6QtUOSVDtGlCgjlg&include_access_alerts=true&format=json'
        },
        localPredictions: {
            id: 'source_localPredictionsMBTA',
            format: 'MBTA_realtime',
            maxAge: 29000,
            URL: 'http://realtime.mbta.com/developer/api/v2/predictionsbystop?api_key=17xKel6QtUOSVDtGlCgjlg&stop=place-asmnl&include_service_alerts=false&format=json'
        },
        localRoutes: {
            id: 'source_localRoutesMBTA',
            format: 'MBTA_realtime',
            maxAge: 86400000,
            URL: 'http://realtime.mbta.com/developer/api/v2/routesbystop?api_key=17xKel6QtUOSVDtGlCgjlg&stop=place-asmnl&format=json'
//            URL: 'http://realtime.mbta.com/developer/api/v2/routes?api_key=17xKel6QtUOSVDtGlCgjlg&format=json'
 //       },
 //       localSchedule: {
 //           id: 'source_localScheduleMBTA',
 //           format: 'MBTA_realtime',
 //           maxAge: 3600000,
 //           URL: 'http://realtime.mbta.com/developer/api/v2/schedulebystop?api_key=17xKel6QtUOSVDtGlCgjlg&stop=place-forhl&max_time=720&max_trips=10&format=json'
        }
    }
};