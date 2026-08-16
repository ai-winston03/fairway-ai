const { validateAdminArgs } = require('firebase-admin/data-connect');

const connectorConfig = {
  connector: 'example',
  serviceId: 'fairway-ai',
  location: 'us-central1'
};
exports.connectorConfig = connectorConfig;

function upsertDailyGolfMetric(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertDailyGolfMetric', inputVars, inputOpts);
}
exports.upsertDailyGolfMetric = upsertDailyGolfMetric;

function upsertDailyCommerceMetric(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('UpsertDailyCommerceMetric', inputVars, inputOpts);
}
exports.upsertDailyCommerceMetric = upsertDailyCommerceMetric;

function startForeupSyncRun(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeMutation('StartForeupSyncRun', inputVars, inputOpts);
}
exports.startForeupSyncRun = startForeupSyncRun;

function listDailyGolfMetrics(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListDailyGolfMetrics', inputVars, inputOpts);
}
exports.listDailyGolfMetrics = listDailyGolfMetrics;

function listDailyCommerceMetrics(dcOrVarsOrOptions, varsOrOptions, options) {
  const { dc: dcInstance, vars: inputVars, options: inputOpts} = validateAdminArgs(connectorConfig, dcOrVarsOrOptions, varsOrOptions, options, true, true);
  dcInstance.useGen(true);
  return dcInstance.executeQuery('ListDailyCommerceMetrics', inputVars, inputOpts);
}
exports.listDailyCommerceMetrics = listDailyCommerceMetrics;

