/*jslint node:true */
'use strict';

var logger = require('./logger');

function route(handle, pathname, options, response, postData) {
    try {
        if (typeof handle[pathname] === 'function') {
            // console.log("Routing request for command " + pathname);
            handle[pathname](pathname, options, response, postData);
        } else {
            // console.log("Routing request for file " + pathname);
            handle['/'](pathname, options, response, postData);
        }
    } catch (err) {
        logger.log('server', options.id, 1, 'router.route', 'Failed to route ' + pathname + " : " + err);
    }
}

exports.route = route;
