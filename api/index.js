const os = require('os');
const path = require('path');

process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.DB_PATH = process.env.DB_PATH || path.join(os.tmpdir(), 'hemlabdhi-pavanart.db');

const { app, initApp } = require('../server/server');
const { ensureSeedData } = require('../server/bootstrap-data');

let ready = null;
function getReady() {
  if (!ready) ready = initApp().then(ensureSeedData).then(() => console.error('[BOOT] Ready')).catch(e => console.error('[BOOT ERROR]', e && e.message));
  return ready;
}

module.exports = async (req, res) => {
  await getReady();
  return app(req, res);
};
