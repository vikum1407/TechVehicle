const { withAndroidManifest } = require('expo/config-plugins');

/**
 * Remove USE_EXACT_ALARM and SCHEDULE_EXACT_ALARM permissions from AndroidManifest.
 * expo-notifications adds these automatically; we don't need them.
 */
function removeExactAlarmPlugin(config) {
  return withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest;
    if (manifest['uses-permission']) {
      manifest['uses-permission'] = manifest['uses-permission'].filter((perm) => {
        const name = (perm.$ && perm.$['android:name']) || '';
        return !name.includes('EXACT_ALARM');
      });
    }
    return modConfig;
  });
}

module.exports = removeExactAlarmPlugin;
