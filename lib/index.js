/**
 * API Sequence Runner - Main entry point
 * A simple, yet powerful tool for orchestrating sequential API calls
 */

const { ScenarioRunner } = require("./runner");
const { ApiClient } = require("./api-client");
const { Validator } = require("./validator");
const { Extractor } = require("./extractor");
const { ScenarioLoader } = require("./scenario-loader");

// main exports
module.exports = {
  // core classes
  ScenarioRunner,
  ApiClient,
  Validator,
  Extractor,
  ScenarioLoader,

  // helper factories
  createRunner: (options) => new ScenarioRunner(options),
  createValidator: () => new Validator(),
  createExtractor: () => new Extractor(),

  // static helpers
  validators: Validator.createValidators(),
  extractors: Extractor.createExtractors(),

  // version
  version: require("../package.json").version,
};

// convenience factory function
module.exports.createFlow = function (options = {}) {
  return new ScenarioRunner(options);
};
