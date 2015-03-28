/*jslint devel: true indent: 4 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, speechSynthesis, document, window */

var c = {
    file: 'haymarket.js', //Name of this file
    visualElements: {
        welcome: {
            visualizer: 'static',
            div: 'welcome',
            parameters: {
                text: '<span style="font-size: 250%">Welcome to Haymarket</span>'
            }
        },
        featuredAlerts: {
            visualizer: 'featuredAlerts',
            div: 'featuredAlerts',
            requiredFacets: {
                alerts: 'mbtaFeaturedAlerts'
            },
            parameters: {
                title: {
                    text: 'Important Notice',
                    format: 'CSS_FeaturedAlertsTitle'
                }
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
                    text: 'Elevator Updates',
                    format: 'CSS_ElevatorAlerts'
                }
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

        mbtaAllDepartures1: {
            generatorFunction: 'departuresFromMBTARealtime',
            alwaysUpdate: true,
            requiredDatasources: {
                MBTARealtimeTimes: 'source_localPredictionsMBTA1'
            },
            requiredFacets: {
                routes: 'mbtaAgencyRoutes'
            },
            parameters: {
                destinationFilter: /^Haymarket/ //Used to filter out predictions going to this station. Optional.
            }
        },
        mbtaAllDepartures2: {
            generatorFunction: 'departuresFromMBTARealtime',
            alwaysUpdate: true,
            requiredDatasources: {
                MBTARealtimeTimes: 'source_localPredictionsMBTA2'
            },
            requiredFacets: {
                routes: 'mbtaAgencyRoutes'
            },
            parameters: {
                destinationFilter: /^Haymarket/ //Used to filter out predictions going to this station. Optional.
            }
        },
        mbtaAllDepartures3: {
            generatorFunction: 'departuresFromMBTARealtime',
            alwaysUpdate: true,
            requiredDatasources: {
                MBTARealtimeTimes: 'source_localPredictionsMBTA3'
            },
            requiredFacets: {
                routes: 'mbtaAgencyRoutes'
            },
            parameters: {
                destinationFilter: /^Haymarket/ //Used to filter out predictions going to this station. Optional.
            }
        },
        mbtaAllDepartures: {
            generatorFunction: 'append',
            alwaysUpdate: false,
            requiredDatasources: {},
            requiredFacets: {
                one: 'mbtaAllDepartures1',
                two: 'mbtaAllDepartures2',
                three: 'mbtaAllDepartures3'
            }
        },
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
        localPredictions1: {
            id: 'source_localPredictionsMBTA1',
            format: 'MBTA_realtime',
            maxAge: 29000,
            URL: 'http://realtime.mbta.com/developer/api/v2/predictionsbystop?api_key=17xKel6QtUOSVDtGlCgjlg&stop=place-haecl&include_service_alerts=false&format=json'
        },
        localPredictions2: {
            id: 'source_localPredictionsMBTA2',
            format: 'MBTA_realtime',
            maxAge: 29000,
            URL: 'http://realtime.mbta.com/developer/api/v2/predictionsbystop?api_key=17xKel6QtUOSVDtGlCgjlg&stop=4511&include_service_alerts=false&format=json'
        },
        localPredictions3: {
            id: 'source_localPredictionsMBTA3',
            format: 'MBTA_realtime',
            maxAge: 29000,
            URL: 'http://realtime.mbta.com/developer/api/v2/predictionsbystop?api_key=17xKel6QtUOSVDtGlCgjlg&stop=117&include_service_alerts=false&format=json'
        },
        localRoutes: {
            id: 'source_localRoutesMBTA',
            format: 'MBTA_realtime',
            maxAge: 86400000,
            URL: 'http://realtime.mbta.com/developer/api/v2/routesbystop?api_key=17xKel6QtUOSVDtGlCgjlg&stop=place-haecl&format=json'
        }
    }
};