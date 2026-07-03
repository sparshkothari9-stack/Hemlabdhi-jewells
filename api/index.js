const os = require('os');
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.DB_PATH = process.env.DB_PATH || path.join(os.tmpdir(), 'hemlabdhi-pavanart.db');

const { app, initApp } = require('../server/server');
const { ensureSeedData } = require('../server/bootstrap-data');

const ready = initApp().then(ensureSeedData);

module.exports = async (req, res) => {
  await ready;
  return app(req, res);
};
