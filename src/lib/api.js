const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('token');
  }
  setToken(token) {
    this.token = token;
    if (token) localStorage.setItem('token', token);
    else localStorage.removeItem('token');
  }
  async request(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    if (res.status === 204) return null;
    return res.json();
  }

  // ---- Auth ----
  async login(email, password) {
    const data = await this.request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    this.setToken(data.token); return data;
  }
  async register(payload) {
    const data = await this.request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });
    this.setToken(data.token); return data;
  }
  logout() { this.setToken(null); }

  // ---- Users / profile ----
  getMe() { return this.request('/users/me'); }
  updateMe(updates) { return this.request('/users/me', { method: 'PATCH', body: JSON.stringify(updates) }); }
  getProfile() { return this.request('/users/profile'); }
  saveProfile(data) { return this.request('/users/profile', { method: 'PUT', body: JSON.stringify(data) }); }

  // ---- Assessment ----
  getTemplate() { return this.request('/assessment/template'); }
  submitAssessment(data) { return this.request('/assessment/submit', { method: 'POST', body: JSON.stringify(data) }); }
  getLatestAssessment() { return this.request('/assessment/latest'); }
  getAssessmentHistory() { return this.request('/assessment/history'); }

  // ---- Listings / marketplace ----
  getListings(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/listings${qs ? '?' + qs : ''}`);
  }
  getListing(id) { return this.request(`/listings/${id}`); }
  createListing(data) { return this.request('/listings', { method: 'POST', body: JSON.stringify(data) }); }

  // ---- Journey: bookings, checkins, rewards, documents ----
  getBookings() { return this.request('/journey/bookings'); }
  createBooking(data) { return this.request('/journey/bookings', { method: 'POST', body: JSON.stringify(data) }); }
  getCheckins() { return this.request('/journey/checkins'); }
  createCheckin(data) { return this.request('/journey/checkins', { method: 'POST', body: JSON.stringify(data) }); }
  getRewards() { return this.request('/journey/rewards'); }
  getDocuments() { return this.request('/journey/documents'); }
  getDocument(id) { return this.request(`/journey/documents/${id}`); }
  uploadDocument(data) { return this.request('/journey/documents', { method: 'POST', body: JSON.stringify(data) }); }

  // ---- LUCA AI ----
  getLucaMessages() { return this.request('/luca/messages'); }
  sendLucaMessage(content) { return this.request('/luca/messages', { method: 'POST', body: JSON.stringify({ content }) }); }

  // ---- Contributions / Credentials / Agents ----
  getContributions() { return this.request('/contributions'); }
  createContribution(data) { return this.request('/contributions', { method: 'POST', body: JSON.stringify(data) }); }
  getCredentials() { return this.request('/credentials'); }
  getAgents() { return this.request('/agents'); }

  // ---- Vault export (sovereign data) ----
  // JSON manifest + files
  getVaultExport() { return this.request('/export/me'); }
  // Binary ZIP — returns a Blob for download
  async downloadVault() {
    const headers = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${API_URL}/export/me?format=zip`, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(err.error || 'Export failed');
    }
    return res.blob();
  }

  // ---- Practitioner ----
  getPractitionerProfile() { return this.request('/practitioner/profile'); }
  savePractitionerProfile(data) { return this.request('/practitioner/profile', { method: 'PUT', body: JSON.stringify(data) }); }
  getPractitionerBookings() { return this.request('/practitioner/bookings'); }

  // ---- Admin ----
  getAdminOverview() { return this.request('/admin/overview'); }
  getAdminUsers() { return this.request('/admin/users'); }
  getAdminListings() { return this.request('/admin/listings'); }
  updateAdminListing(id, status) { return this.request(`/admin/listings/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); }
  getAdminBookings() { return this.request('/admin/bookings'); }
}

export const api = new ApiClient();
