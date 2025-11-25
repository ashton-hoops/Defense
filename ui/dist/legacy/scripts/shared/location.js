(function (global) {
  const LOCATION_MAP_KEY = 'ou_wbb_game_location_map';

  function standardizeLocation(value) {
    const raw = (value ?? '').toString().trim().toLowerCase();
    if (!raw) return '';
    if (raw.includes('neutral')) return 'neutral';
    if (raw === 'away' || raw.includes('away') || raw === 'road' || raw.includes('road')) return 'away';
    if (raw === 'home' || raw.includes('home')) return 'home';
    return raw;
  }

  function normalizeLocationCode(value) {
    const raw = standardizeLocation(value);
    return raw;
  }

  function formatLocationLabel(code) {
    const normalized = standardizeLocation(code);
    if (normalized === 'home') return 'HOME';
    if (normalized === 'away') return 'AWAY';
    if (normalized === 'neutral') return 'NEUTRAL';
    return normalized ? normalized.toUpperCase() : '—';
  }

  function cacheGameLocation(keys, locationCode, locationDisplay) {
    const validKeys = (Array.isArray(keys) ? keys : [keys])
      .map((key) => String(key || ''))
      .filter(Boolean);
    if (!validKeys.length) return;
    const payload = {
      code: locationCode || '',
      display: locationDisplay || ''
    };
    try {
      const existing = JSON.parse(global.localStorage?.getItem(LOCATION_MAP_KEY) || '{}');
      validKeys.forEach((key) => {
        existing[key] = payload;
      });
      global.localStorage?.setItem(LOCATION_MAP_KEY, JSON.stringify(existing));
    } catch (err) {
      console.warn('Unable to cache game location', err);
    }
  }

  function resolveCachedLocation(keysOrClip) {
    const keys = [];
    if (!keysOrClip) return null;
    if (typeof keysOrClip === 'object') {
      const clip = keysOrClip;
      keys.push(
        clip.__gameId,
        clip.gameId,
        clip.game_id,
        clip.game_num,
        clip['Game #'],
        clip.gameNumber,
        clip.id && `clip:${clip.id}`,
        clip.gameId && clip.opponent ? `game:${clip.gameId}:${String(clip.opponent).toLowerCase()}` : null,
        clip['Game #'] && clip['Opponent']
          ? `num:${clip['Game #']}:${String(clip['Opponent']).toLowerCase()}`
          : null
      );
    } else if (Array.isArray(keysOrClip)) {
      keys.push(...keysOrClip);
    } else {
      keys.push(keysOrClip);
    }
    try {
      const existing = JSON.parse(global.localStorage?.getItem(LOCATION_MAP_KEY) || '{}');
      for (const key of keys) {
        if (!key) continue;
        const payload = existing[String(key)];
        if (payload && (payload.code || payload.display)) return payload;
      }
    } catch (err) {
      console.warn('Unable to read cached locations', err);
    }
    return null;
  }

  function ensureLocationFields(clip, fallbackKeys = []) {
    if (!clip) return clip;
    const display =
      clip.location_display ||
      clip.locationDisplay ||
      clip['Location'] ||
      clip['Game Location'] ||
      clip.location_label ||
      clip.locationLabel ||
      '';
    const code =
      clip.location ||
      clip.location_code ||
      clip.locationCode ||
      clip.game_location ||
      clip.gameLocation ||
      standardizeLocation(display);
    const cached = resolveCachedLocation([clip.__gameId, ...fallbackKeys]);
    const finalCode = standardizeLocation(code || cached?.code || display);
    const finalDisplay = display || cached?.display || formatLocationLabel(finalCode);

    return {
      ...clip,
      location: finalCode,
      location_code: finalCode,
      locationCode: finalCode,
      location_display: finalDisplay,
      locationDisplay: finalDisplay,
      Location: finalDisplay,
      locationLabel: finalDisplay,
      game_location: finalCode,
      gameLocation: finalCode
    };
  }

  const api = {
    LOCATION_MAP_KEY,
    standardizeLocation,
    normalizeLocationCode,
    formatLocationLabel,
    cacheGameLocation,
    resolveCachedLocation,
    ensureLocationFields
  };

  global.LocationUtils = api;
})(typeof window !== 'undefined' ? window : (globalThis || {}));
