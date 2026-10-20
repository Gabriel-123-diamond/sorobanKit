'use strict';

const { sanitizeString, sanitized } = require('./common');

module.exports = {
  sanitizeString,
  sanitized,
  ...require('./userSchemas'),
  ...require('./adminSchemas'),
};
