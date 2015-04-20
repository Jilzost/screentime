/**
 * Carousels are sets of slides. 
 * A slide is one set of visualElements to show on a screen at once. 
 * Each carousel has the conditions under which it should be chosen,
 * and the different elements to show.
 * @type {Array}
 */
var carousels = [
    //Welcome slide only
    {
        conditions: [
            {
                visualElements: ['featuredAlerts', 'departures', 'currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                areEmpty: true
            }
        ],
        slides: [
            {
                carouselId: 1,
                visualElements: ['welcome'],
                duration: 10
            }
        ]
    },
    //all information fits
    {
        conditions: [
            {
                visualElements: ['featuredAlerts', 'departures', 'currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                fitOnDisplay: true,
                areEmpty: false
            }
        ],
        slides: [
            {
                carouselId: 2,
                visualElements: ['featuredAlerts', 'departures', 'currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //featured on its own screen; all other information fits
    //featuredAlerts screen will be shown ONLY if there is content
    {
        conditions: [
            {
                visualElements: ['departures', 'currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                areEmpty: false,
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 3,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //departures remain on top; current & upcoming alerts below them, then elevator alerts below them
    {
        conditions: [
            {
                visualElements: ['departures', 'currentAlerts', 'upcomingAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures'],
                areEmpty: false
            },
            {
                visualElements: ['elevatorAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['currentAlerts', 'upcomingAlerts'],
                areEmpty: false
            }
        ],
        slides: [
            {
                carouselId: 4,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'currentAlerts', 'upcomingAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //departures remain on top; current, then upcoming, then elevator alerts below them
    {
        conditions: [
            {
                visualElements: ['departures'],
                areEmpty: false
            },
            {
                visualElements: ['elevatorAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['currentAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['upcomingAlerts'],
                areEmpty: false
            },

            {
                visualElements: ['departures', 'currentAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures', 'upcomingAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 5,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'currentAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'upcomingAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //departures remain on top; current, then upcoming below them (no elevator)
    {
        conditions: [
            {
                visualElements: ['departures'],
                areEmpty: false
            },
            {
                visualElements: ['elevatorAlerts'],
                areEmpty: true
            },
            {
                visualElements: ['currentAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['upcomingAlerts'],
                areEmpty: false
            },

            {
                visualElements: ['departures', 'currentAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures', 'upcomingAlerts'],
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 6,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'currentAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'upcomingAlerts'],
                duration: 10
            }
        ]
    },
    //departures remain on top; current, then elevator below them (no upcoming)
    {
        conditions: [
            {
                visualElements: ['departures'],
                areEmpty: false
            },
            {
                visualElements: ['elevatorAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['currentAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['upcomingAlerts'],
                areEmpty: true
            },

            {
                visualElements: ['departures', 'currentAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 7,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'currentAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //departures remain on top; upcoming, then elevator below them (no current)
    {
        conditions: [
            {
                visualElements: ['departures'],
                areEmpty: false
            },
            {
                visualElements: ['elevatorAlerts'],
                areEmpty: false
            },
            {
                visualElements: ['currentAlerts'],
                areEmpty: true
            },
            {
                visualElements: ['upcomingAlerts'],
                areEmpty: false
            },

            {
                visualElements: ['departures', 'upcomingAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 8,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'upcomingAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //departures on one screen, all alerts on other screen
    {
        conditions: [
            {
                visualElements: ['currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 9,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures'],
                duration: 10
            },
            {
                visualElements: ['currentAlerts', 'upcomingAlerts', 'elevatorAlerts'],
                duration: 10
            }
        ]
    },
    //departures on one screen with elevators, current / upcoming on next screen
    {
        conditions: [
            {
                visualElements: ['departures', 'elevatorAlerts'],
                fitOnDisplay: true
            },
            {
                visualElements: ['currentAlerts', 'upcomingAlerts'],
                fitOnDisplay: true
            }
        ],
        slides: [
            {
                carouselId: 10,
                visualElements: ['featuredAlerts'],
                duration: 10
            },
            {
                visualElements: ['departures', 'elevatorAlerts'],
                duration: 10
            },
            {
                visualElements: ['currentAlerts', 'upcomingAlerts'],
                duration: 10
            }
        ]
    },
    //departures on one screen, current / upcoming on next screen, elevators on last screen
    {
        conditions: [
            {
                visualElements: ['currentAlerts', 'upcomingAlerts'],
                fitOnDisplay: true
            },
        ],
        slides: [
            {
                carouselId: 11,
                visualElements: ['featuredAlerts'],
                duration: 8
            },
            {
                visualElements: ['departures'],
                duration: 8
            },
            {
                visualElements: ['currentAlerts', 'upcomingAlerts'],
                duration: 8
            },
            {
                visualElements: ['elevatorAlerts'],
                duration: 8
            }
        ]
    },
    //departures on one screen, current on next screen, upcoming / elevators on last screen
    {
        conditions: [
            {
                visualElements: ['upcomingAlerts', 'elevatorAlerts'],
                fitOnDisplay: true
            },
        ],
        slides: [
            {
                carouselId: 12,
                visualElements: ['featuredAlerts'],
                duration: 8
            },
            {
                visualElements: ['departures'],
                duration: 8
            },
            {
                visualElements: ['currentAlerts'],
                duration: 8
            },
            {
                visualElements: ['upcomingAlerts', 'elevatorAlerts'],
                duration: 8
            }
        ]
    },
    //everything on its own screen (no featured)
    {
        conditions: [
            {
                visualElements: ['featuredAlerts'],
                areEmpty: true
            }
        ],
        slides: [
            {
                carouselId: 13,
                visualElements: ['departures'],
                duration: 10
            },
            {
                visualElements: ['currentAlerts'],
                duration: 7
            },
            {
                visualElements: ['upcomingAlerts'],
                duration: 7
            },
            {
                visualElements: ['elevatorAlerts'],
                duration: 7
            }
        ]
    },
    //everything on its own screen (including featured)
    {
        conditions: [
            {
                visualElements: ['featuredAlerts'],
                areEmpty: false
            }
        ],
        slides: [
            {
                carouselId: 14,
                visualElements: ['featuredAlerts'],
                duration: 7
            },
            {
                visualElements: ['departures'],
                duration: 7
            },
            {
                visualElements: ['currentAlerts'],
                duration: 7
            },
            {
                visualElements: ['upcomingAlerts'],
                duration: 5
            },
            {
                visualElements: ['elevatorAlerts'],
                duration: 5
            }
        ]
    }
];