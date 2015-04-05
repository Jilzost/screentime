/*jslint devel: true indent: 4 */
/*global XMLHttpRequest, SpeechSynthesisUtterance, speechSynthesis, document, window */

var c = {
    file: 'default.js', //Name of this file
    visualElements: {
        welcome: {
            visualizer: 'static',
            div: 'welcome',
            parameters: {
                text: '<span style="font-size: 250%">Welcome</span>'
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
            visualizer: 'static',
            div: 'departures',
            requiredFacets: {
                departures: 'mbtaNextDepartures'
            },
            parameters: {
                text: ''
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
        mbtaAgencyAlerts: {
            generatorFunction: 'alertsFromMBTARealtime',
            alwaysUpdate: false,
            requiredDatasources: {
                mbtaRealtimeAlerts: 'source_agencyAlertsMBTA'
            },
            requiredFacets: {
                localRoutes: 'mbtaAgencyRoutes',
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
        }
    }
};

