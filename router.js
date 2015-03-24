/*jslint node:true */
'use strict';

var logger = require('./logger');

function route(handle, pathname, config, response, postData) {
    try {
        if (typeof handle[pathname] === 'function') {
            //console.log("Routing request for " + pathname);
            handle[pathname](pathname, config, response, postData);
        } else {
            console.log("Unrecognized request " + pathname);
        }
    } catch (err) {
        logger.log('server', config, 1, 'router.route', 'Failed: ' + err);
    }
}

exports.route = route;
