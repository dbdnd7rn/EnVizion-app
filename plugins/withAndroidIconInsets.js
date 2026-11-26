const { withFinalizedMod } = require('expo/config-plugins');
const fs = require('node:fs/promises');
const path = require('node:path');

// Android masks a 108dp adaptive layer down to a much smaller viewport.
// Inset the existing artwork so the entire logo, including the wordmark,
// stays inside the central 66dp safe zone on round and shaped launchers.
module.exports = function withAndroidIconInsets(config) {
  return withFinalizedMod(config, [
    'android',
    async (modConfig) => {
      if (!modConfig.android?.adaptiveIcon?.foregroundImage) {
        return modConfig;
      }

      const resourceRoot = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app/src/main/res/mipmap-anydpi-v26',
      );
      const foreground = `<foreground>
        <inset
            android:drawable="@mipmap/ic_launcher_foreground"
            android:insetLeft="24%"
            android:insetTop="24%"
            android:insetRight="24%"
            android:insetBottom="24%" />
    </foreground>`;

      for (const filename of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
        const filePath = path.join(resourceRoot, filename);
        const xml = await fs.readFile(filePath, 'utf8');
        const updated = xml.replace(
          /<foreground\b[^>]*\/>|<foreground\b[^>]*>[\s\S]*?<\/foreground>/,
          foreground,
        );
        if (!updated.includes(foreground)) {
          throw new Error(`Cannot inset Android launcher icon: ${filename} has no foreground layer.`);
        }
        await fs.writeFile(filePath, updated);
      }

      return modConfig;
    },
  ]);
};
