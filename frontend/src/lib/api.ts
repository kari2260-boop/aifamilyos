const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

class ApiClient {
  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }

  private async request(path: string, options: RequestInit = {}) {
    const token = this.getToken();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "请求失败" }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }

    return res.json();
  }

  // 认证
  async register(phone: string, password: string) {
    const data = await this.request("/auth/register", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    });
    localStorage.setItem("token", data.access_token);
    return data;
  }

  async login(phone: string, password: string) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, password }),
    });
    localStorage.setItem("token", data.access_token);
    return data;
  }

  async getMe() {
    return this.request("/auth/me");
  }

  logout() {
    localStorage.removeItem("token");
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // 对话
  async chatSend(agentType: string, message: string, conversationId?: string) {
    return this.request("/chat/send", {
      method: "POST",
      body: JSON.stringify({
        agent_type: agentType,
        message,
        conversation_id: conversationId || null,
      }),
    });
  }

  async getConversations(agentType?: string) {
    const query = agentType ? `?agent_type=${agentType}` : "";
    return this.request(`/chat/conversations${query}`);
  }

  async getMessages(conversationId: string) {
    return this.request(`/chat/conversations/${conversationId}/messages`);
  }
}

export const api = new ApiClient();
