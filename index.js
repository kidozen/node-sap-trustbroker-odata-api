"use strict";
require("simple-errors");
var winston = require("winston");
var cybersafeTrustBroker = require("cybersafe-trustbroker");
var OData = require("odata-api").OData;
var baseConnector = require("kido-connector");
var _ = require("lodash");

baseConnector.init("SAP-TrustBroker-oData", winston);

module.exports = function(settings) {
    winston.info("constructor");
    winston.debug("\tsettings:", settings);

    var _15_minutesInMilliseconds = 15 * 60 * 1000;

    settings = settings || {};
    settings.connectionType = "SSO2";
    settings.timeout = Number(settings.timeout) || _15_minutesInMilliseconds;

    winston.verbose("creating trustbroker instance");
    var trustbroker = cybersafeTrustBroker.create(settings);

    winston.verbose("creating odata instance");
    var odataOptions = _.extend({}, settings.odata, { logger: winston, security: new Security() });
    var odata = OData.createClient(odataOptions);

    this.lookupMethod = function (name, cb) {
        winston.log("lookupMethod", {name: name});
        odata.lookupMethod(name, function (errLookup, method) {
            winston.verbose("odata.lookupMethod RES", {errorOcurred: !!errLookup, methodFound: !!method });
            winston.debug("\terr", errLookup);

            if (errLookup) return cb(errLookup);
            if (!method) return cb();

            // returns a wrappers that will inject SAP credentials
            function wrapper(options, callback) {

                winston.verbose("getting sap credentials");
                winston.debug("\toptions", options);
                // gets SAP's credentials
                trustbroker.getSapCredential(options, function (err, credential) {
                    winston.verbose("trustbroker.getSapCredential RES");
                    winston.debug("\terr", err);
                    winston.debug("\tcredential", credential);
                    if (err) return callback(err);

                    var optionsWithCredentials = _.extend({}, options, credential);

                    winston.verbose("invoking method", { name: name });
                    winston.debug("\toptionsWithCredentials", optionsWithCredentials);
                    method(optionsWithCredentials, callback);
                });
            };

            return cb(null, wrapper);
        });
    };

    this.close = function (cb) {
        winston.verbose("close");
        if (trustbroker) return trustbroker.close(cb);
        cb();
    };

    winston.verbose("constructor DONE");
};

function Security() {
    this.addOptions = function(options) {
        options.headers = options.headers || {};
        options.headers.Cookie = "MYSAPSSO2=" + options.mysapsso2;
    };
}