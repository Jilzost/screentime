/*jslint devel: true nomen: true regexp: true indent: 4 maxlen: 80 */
/*global b, c, XMLHttpRequest, SpeechSynthesisUtterance, speechSynthesis,
document, window, _, $, Backbone */

var agencyConfig =
    {
        name: 'MBTA',
        sourceType: 'MBTA-realtime',
        baseURL: 'http://realtime.mbta.com/developer/api/v2/',
        api_key: '17xKel6QtUOSVDtGlCgjlg',
        stops: [
            {stop_id: 'place-haecl', locationName: 'Haymarket Station'},
            {stop_id: '4511', locationName: 'New Sudbury Street'},
            {stop_id: '117', locationName: 'Congress Street'}
        ],
        destinationFilter: /^Haymarket/,
        // behavior_alertsForAllRoutes: true,
        // behavior_suppressAlerts: true
        // behavior_suppressDepartures: true
    };


var signConfig =
    {
        speech: 'mespeak',
        speechTrigger: 'socket'
    };