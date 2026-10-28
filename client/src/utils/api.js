let inMemoryToken = null;

export function setAuthToken(token) {
  inMemoryToken = token;
}

export function getAuthToken() {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window !== 'undefined') {
    return window.sessionStorage?.getItem('aswanna_session') || window.localStorage?.getItem('aswanna_session') || null;
  }
  return null;
}

export class ApiError extends Error {
  constructor(status, code, message, fields = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export async function apiFetch(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let url = endpoint;
  if (!url.startsWith('/api') && !url.startsWith('http')) {
    url = '/api' + (url.startsWith('/') ? '' : '/') + url;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('text/csv')) {
    return response.blob();
  }

  let data;
  try {
    data = await response.json();
  } catch (err) {
    if (!response.ok) {
      throw new ApiError(response.status, 'SERVER_ERROR', 'An unexpected server error occurred.');
    }
    return null;
  }

  if (!response.ok) {
    const errObj = data?.error || {};
    const code = errObj.code || 'UNKNOWN_ERROR';
    const message = errObj.message || 'An error occurred';
    const fields = errObj.fields || [];
    throw new ApiError(response.status, code, message, fields);
  }

  return data;
}
