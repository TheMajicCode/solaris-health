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

  // ---- Timeline & Trends (Phase 3) ----
  getTimeline(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/timeline/me${qs ? '?' + qs : ''}`);
  }
  getPatientTimeline(userId, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/timeline/patient/${userId}${qs ? '?' + qs : ''}`);
  }
  getSystemTimeline(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/timeline/system${qs ? '?' + qs : ''}`);
  }
  getVitalsTrends(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/trends/vitals${qs ? '?' + qs : ''}`);
  }
  async exportTimeline(body = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${API_URL}/timeline/export`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Export failed' }));
      throw new Error(err.error || 'Export failed');
    }
    return res.blob();
  }

  // ---- Wallet (Phase 4: Cross-chain) ----
  getWalletChains() { return this.request('/wallet/chains'); }
  getWallets() { return this.request('/wallet/me'); }
  connectWallet(data) { return this.request('/wallet/connect', { method: 'POST', body: JSON.stringify(data) }); }
  disconnectWallet(id) { return this.request('/wallet/disconnect', { method: 'PUT', body: JSON.stringify({ id }) }); }
  setPrimaryWallet(id) { return this.request('/wallet/primary', { method: 'PUT', body: JSON.stringify({ id }) }); }
  getWalletNonce(address) {
    const qs = address ? `?address=${encodeURIComponent(address)}` : '';
    return this.request(`/wallet/nonce${qs}`);
  }
  verifyWalletSignature(data) { return this.request('/wallet/verify-signature', { method: 'POST', body: JSON.stringify(data) }); }
  getWalletBalance(chain, address) { return this.request(`/wallet/balance/${chain}/${address}`); }
  getWalletTransactions(chain, address, limit = 20) { return this.request(`/wallet/transactions/${chain}/${address}?limit=${limit}`); }

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

  // ---- Messaging (Phase 5: E2E encrypted) ----
  uploadPublicKey(publicKey, algorithm = 'RSA-OAEP-256') {
    return this.request('/messages/keys', { method: 'POST', body: JSON.stringify({ publicKey, algorithm }) });
  }
  getPublicKey(userId) { return this.request(`/messages/keys/${userId}`); }
  getMessageContacts() { return this.request('/messages/contacts'); }
  getConversations() { return this.request('/messages/conversations'); }
  startConversation(contactId) {
    return this.request('/messages/conversations', { method: 'POST', body: JSON.stringify({ contactId }) });
  }
  getConversation(conversationId) { return this.request(`/messages/${conversationId}`); }
  sendMessage(payload) { return this.request('/messages/send', { method: 'POST', body: JSON.stringify(payload) }); }
  uploadAttachment(payload) { return this.request('/messages/upload', { method: 'POST', body: JSON.stringify(payload) }); }
  downloadAttachment(messageId) { return this.request(`/messages/${messageId}/attachment`); }
  setTyping(conversationId) { return this.request('/messages/typing', { method: 'POST', body: JSON.stringify({ conversationId }) }); }
  markRead(conversationId) { return this.request('/messages/read', { method: 'POST', body: JSON.stringify({ conversationId }) }); }
  reportMessage(payload) { return this.request('/messages/report', { method: 'POST', body: JSON.stringify(payload) }); }
  getUnreadCount() { return this.request('/messages/unread-count'); }

  // ---- Marketplace ----
  getMarketplaceCategories() { return this.request('/marketplace/categories'); }
  getProviders(params = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    return this.request(`/marketplace/providers${qs ? `?${qs}` : ''}`);
  }
  searchProviders(params = {}) {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString();
    return this.request(`/marketplace/search${qs ? `?${qs}` : ''}`);
  }
  getProvider(id) { return this.request(`/marketplace/providers/${id}`); }
  getProviderReviews(id, params = {}) {
    const qs = new URLSearchParams(params).toString();
    return this.request(`/marketplace/providers/${id}/reviews${qs ? `?${qs}` : ''}`);
  }
  createProvider(data) { return this.request('/marketplace/providers', { method: 'POST', body: JSON.stringify(data) }); }
  updateProvider(id, data) { return this.request(`/marketplace/providers/${id}`, { method: 'PUT', body: JSON.stringify(data) }); }
  addProviderPhoto(id, data) { return this.request(`/marketplace/providers/${id}/photos`, { method: 'POST', body: JSON.stringify(data) }); }
  addProviderService(id, data) { return this.request(`/marketplace/providers/${id}/services`, { method: 'POST', body: JSON.stringify(data) }); }
  addProviderReview(id, data) { return this.request(`/marketplace/providers/${id}/reviews`, { method: 'POST', body: JSON.stringify(data) }); }
  claimProvider(id) { return this.request(`/marketplace/providers/${id}/claim`, { method: 'POST', body: JSON.stringify({}) }); }
  getMyProviders() { return this.request('/marketplace/my-providers'); }

  // ---- Profile photo ----
  uploadProfilePhoto(image) { return this.request('/users/upload-photo', { method: 'POST', body: JSON.stringify({ image }) }); }
}

export const api = new ApiClient();
