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
            {stop_id: 'place-cntsq', locationName: 'Central Square'},
            {stop_id: '1060', locationName: 'Magazine Street'},
            {stop_id: '1123', locationName: 'Green Street'},
            {stop_id: '72', locationName: 'This bus stop'}
        ],
        destinationFilter: /^Central\sSquare/,
        // behavior_alertsForAllRoutes: true,
        // behavior_suppressAlerts: true
        // behavior_suppressDepartures: true
    };

