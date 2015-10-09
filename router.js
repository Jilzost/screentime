/*jslint node:true */
'use strict';

var logger = require('./logger');

function route(handle, pathname, id, response, postData) {
    try {
        if (typeof handle[pathname] === 'function') {
            //console.log("Routing request for " + pathname);
            handle[pathname](pathname, id, response, postData);
        } else {
            handle['/'](pathname, id, response, postData);
        }
    } catch (err) {
        logger.log('server', id, 1, 'router.route', 'Failed: ' + err);
    }
}

exports.route = route;
