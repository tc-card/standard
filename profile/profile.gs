/* ── Profile lookup viewer's code ──────────── */
function lookupProfile_(identifier, byId) {
  if (!identifier) throw new Error('Invalid identifier parameter');
  const data = findRow(String(identifier).trim(), !!byId);
  if (!data) throw new Error('Profile not found');
  return {
    status: 'success',
    data: {
      status: data.Status || 'Inactive',
      Name: data.Name || '',
      Link: data.Link || '',
      ...sanitizeProfileData(data)
    }
  };
}

function findRow(identifier, byId = false) {
  const cache = CacheService.getScriptCache();
  const cacheKey = (byId ? 'id_' : 'link_') + identifier.trim();

  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    try { return JSON.parse(cachedData); } catch (_) { cache.remove(cacheKey); }
  }

  const spreadsheet = SpreadsheetApp.openById(STANDARD_CONFIG_.SPREADSHEET_ID);
  const sheet = spreadsheet.getSheetByName(STANDARD_CONFIG_.FORM_SHEET);
  if (!sheet) throw new Error('Form sheet not found');

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1) return null;

  const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = data[0];
  const columnName = byId ? 'ID' : 'Link';
  const columnIndex = headers.findIndex(h => h.toString().trim() === columnName);
  if (columnIndex === -1) throw new Error(`${columnName} column not found`);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][columnIndex]).trim() === identifier.trim()) {
      const responseData = {};
      headers.forEach((header, index) => {
        responseData[header] = data[i][index] !== null ? String(data[i][index]).trim() : '';
      });
      if (!responseData.Name) throw new Error('Profile data missing required Name field');
      try {
        cache.put(cacheKey, JSON.stringify(responseData), STANDARD_CONFIG_.PROFILE_CACHE_SECONDS);
      } catch (_) {}
      return responseData;
    }
  }
  return null;
}

function sanitizeProfileData(data) {
  const safe = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      safe[key] = data[key]
        ? data[key].toString().replace(/</g, '&lt;').replace(/>/g, '&gt;')
        : '';
    }
  }
  return safe;
}

function clearProfileCache_(link, id) {
  const cache = CacheService.getScriptCache();
  if (link) cache.remove('link_' + String(link).trim());
  if (id)   cache.remove('id_'   + String(id).trim());
}


/* ── security -> https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTpNYJyT_wECvWqwBkaNmjnFBoxwQycypvTTCZXcnJNezOIdBe_PE__NaM&s=10 ───────────────────────────────────────────── */
function normalizeSocialLinks_(value) {
  if (Array.isArray(value)) return value.map(cleanText_).filter(Boolean).join('\n');
  return String(value || '').split(',').map(v => v.trim()).filter(Boolean).join('\n');
}
function cleanText_(value) { return String(value == null ? '' : value).trim(); }
function safeSheetText_(value) {
  const text = cleanText_(value);
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}
function escapeHtml_(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
function jsonResponse_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}