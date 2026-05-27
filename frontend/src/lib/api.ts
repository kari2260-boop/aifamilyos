// API地址自动推断：
// - NEXT_PUBLIC_API_URL 显式配置时优先使用
// - SSR/容器内使用 SERVER_API_URL 或 Docker 服务名
// - 浏览器直连 :3000 时走同主机 :8000/api
// - 正式域名/Nginx 反代时走同域 /api
export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window === "undefined") {
    return process.env.SERVER_API_URL || "http://backend:8000/api";
  }
  if (window.location.port === "3000") {
    return `${window.location.protocol}//${window.location.hostname}:8000/api`;
  }
  return "/api";
}

const API_BASE = getApiBase();
const REQUEST_TIMEOUT_MS = 12000;

class ApiClient {
  getBaseUrl(): string {
    return API_BASE;
  }

  private getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }

  async request(path: string, options: RequestInit = {}) {
    const token = this.getToken();
    const controller = new AbortController();
    const timeoutId = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers,
        signal: options.signal || controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new Error("请求超时，请检查网络或稍后重试");
      }
      throw err;
    } finally {
      globalThis.clearTimeout(timeoutId);
    }

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

  async submitFeedback(messageId: string, feedbackType: "useful" | "not_useful") {
    return this.request(`/chat/messages/${messageId}/feedback?feedback_type=${feedbackType}`, {
      method: "POST",
    });
  }

  async deleteConversation(conversationId: string) {
    return this.request(`/chat/conversations/${conversationId}`, {
      method: "DELETE",
    });
  }

  async deleteMessage(messageId: string) {
    return this.request(`/chat/messages/${messageId}`, {
      method: "DELETE",
    });
  }

  // 家庭档案
  async getMyFamily() {
    return this.request("/families/me");
  }

  async updateFamily(familyId: string, data: { family_name?: string; city?: string }) {
    return this.request(`/families/${familyId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async getChildren() {
    return this.request("/families/children");
  }

  async createChild(data: { name: string; age?: number; grade?: string; interests?: string; learning_challenges?: string; parent_expectations?: string }) {
    return this.request("/families/children", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateChild(childId: string, data: { name?: string; age?: number; grade?: string; interests?: string; learning_challenges?: string; parent_expectations?: string }) {
    return this.request(`/families/children/${childId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // 家长档案
  async getParentProfile() {
    return this.request("/families/parent-profile");
  }

  async saveParentProfile(data: {
    occupation?: string;
    education_background?: string;
    education_philosophy?: string;
    communication_style?: string;
    parent_child_quality?: string;
    education_concerns?: string;
  }) {
    return this.request("/families/parent-profile", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 孩子扩展信息
  async updateChildExtended(childId: string, data: {
    subject_strengths?: string[];
    subject_weaknesses?: string[];
    learning_style?: string;
    daily_study_hours?: number;
    short_term_goals?: string;
    long_term_goals?: string;
  }) {
    return this.request(`/families/children/${childId}/extended`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async createFamily(data: { family_name: string; city?: string }) {
    return this.request("/families", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 咨询预约
  async getConsultants() {
    return this.request("/booking/consultants");
  }

  async getConsultant(id: string) {
    return this.request(`/booking/consultants/${id}`);
  }

  async getAvailableSlots(consultantId: string, date: string) {
    return this.request(`/booking/consultants/${consultantId}/available-slots?date=${date}`);
  }

  async createBooking(data: { consultant_id: string; booking_date: string; time_slot: string; topic?: string }) {
    return this.request("/booking/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMyBookings() {
    return this.request("/booking/bookings");
  }

  async cancelBooking(bookingId: string) {
    return this.request(`/booking/bookings/${bookingId}/cancel`, { method: "PUT" });
  }

  // 管理后台 - 预约
  async adminGetBookings(status?: string) {
    const query = status ? `?status=${status}` : "";
    return this.request(`/booking/admin/bookings${query}`);
  }

  async adminUpdateBooking(bookingId: string, data: { status: string; notes?: string }) {
    return this.request(`/booking/admin/bookings/${bookingId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminCreateConsultant(data: { name: string; title?: string; bio?: string; specialties?: string; price_per_session?: number }) {
    return this.request("/booking/admin/consultants", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminSetSchedule(consultantId: string, data: { weekday: number; time_slots: string[] }) {
    return this.request(`/booking/admin/consultants/${consultantId}/schedules`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 成长报告
  async generateReport(month?: string, childId?: string) {
    return this.request("/reports/generate", {
      method: "POST",
      body: JSON.stringify({ month, child_id: childId }),
    });
  }

  async getReports() {
    return this.request("/reports");
  }

  async getReport(id: string) {
    return this.request(`/reports/${id}`);
  }

  // 管理后台
  async adminStats() {
    return this.request("/admin/stats");
  }

  async adminFamilies() {
    return this.request("/admin/families");
  }

  async adminFamilyDetail(familyId: string) {
    return this.request(`/admin/families/${familyId}`);
  }

  async adminConversations() {
    return this.request("/admin/conversations");
  }

  async adminConversationMessages(conversationId: string) {
    return this.request(`/admin/conversations/${conversationId}/messages`);
  }

  async adminRisks() {
    return this.request("/admin/risks");
  }

  async adminHandleRisk(riskId: string, notes: string) {
    return this.request(`/admin/risks/${riskId}`, {
      method: "PUT",
      body: JSON.stringify({ handled: true, handler_notes: notes }),
    });
  }

  async adminKnowledgeDocs() {
    return this.request("/knowledge/docs");
  }

  async adminUploadKnowledge(file: File, category: string) {
    const token = this.getToken();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);

    const res = await fetch(`${API_BASE}/knowledge/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "上传失败" }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // Usage 统计
  async adminUsageSummary() {
    return this.request("/admin/usage/summary");
  }

  async adminUsageDaily(days: number = 30) {
    return this.request(`/admin/usage/daily?days=${days}`);
  }

  // 成长标签
  async getChildTags(childId: string) {
    return this.request(`/families/children/${childId}/tags`);
  }

  async refreshChildTags(childId: string) {
    return this.request(`/families/children/${childId}/tags/refresh`, { method: "POST" });
  }

  // 订阅
  async getPlans() {
    return this.request("/subscription/plans");
  }

  async getCurrentSubscription() {
    return this.request("/subscription/current");
  }

  async upgradePlan(planId: string) {
    return this.request("/subscription/upgrade?plan_id=" + planId, { method: "POST" });
  }

  // 课程
  async getCourses(params?: { category?: string; content_type?: string; page?: number; size?: number }) {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.content_type) query.set("content_type", params.content_type);
    if (params?.page) query.set("page", String(params.page));
    if (params?.size) query.set("size", String(params.size));
    const qs = query.toString();
    return this.request(`/courses${qs ? `?${qs}` : ""}`);
  }

  async getCourse(id: string) {
    return this.request(`/courses/${id}`);
  }

  async getCourseCategories() {
    return this.request("/courses/categories");
  }

  async getCoursePaths() {
    return this.request("/courses/paths");
  }

  async getCoursePath(id: string) {
    return this.request(`/courses/paths/${id}`);
  }

  async updateCourseProgress(courseId: string, data: { status: string; progress_percent: number }) {
    return this.request(`/courses/${courseId}/progress`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 管理员 - 课程
  async adminCreateCourse(data: Record<string, unknown>) {
    return this.request("/admin/courses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminUpdateCourse(id: string, data: Record<string, unknown>) {
    return this.request(`/admin/courses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteCourse(id: string) {
    return this.request(`/admin/courses/${id}`, { method: "DELETE" });
  }

  async adminCreateCourseCategory(data: { name: string; slug: string; sort_order?: number }) {
    return this.request("/admin/courses/categories", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // 文章
  async getArticles(params?: { category?: string; tag?: string; page?: number; size?: number }) {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.tag) query.set("tag", params.tag);
    if (params?.page) query.set("page", String(params.page));
    if (params?.size) query.set("size", String(params.size));
    const qs = query.toString();
    return this.request(`/articles${qs ? `?${qs}` : ""}`);
  }

  async getArticle(id: string) {
    return this.request(`/articles/${id}`);
  }

  async getFeaturedArticles(size: number = 5) {
    return this.request(`/articles/featured?size=${size}`);
  }

  // 管理员 - 文章
  async adminCreateArticle(data: Record<string, unknown>) {
    return this.request("/admin/articles", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminUpdateArticle(id: string, data: Record<string, unknown>) {
    return this.request(`/admin/articles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteArticle(id: string) {
    return this.request(`/admin/articles/${id}`, { method: "DELETE" });
  }

  // 订阅状态
  async getSubscriptionStatus() {
    return this.request("/subscription/status");
  }

  async activateTrial() {
    return this.request("/subscription/activate-trial", { method: "POST" });
  }

  // 资料库
  async getResources(params?: { category?: string; resource_type?: string }) {
    const query = new URLSearchParams();
    if (params?.category) query.set("category", params.category);
    if (params?.resource_type) query.set("resource_type", params.resource_type);
    const qs = query.toString();
    return this.request(`/resources${qs ? `?${qs}` : ""}`);
  }

  // 管理员 - 资料库
  async adminCreateResource(data: Record<string, unknown>) {
    return this.request("/admin/resources", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminUpdateResource(id: string, data: Record<string, unknown>) {
    return this.request(`/admin/resources/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteResource(id: string) {
    return this.request(`/admin/resources/${id}`, { method: "DELETE" });
  }

  // 管理员 - Prompt 管理
  async adminGetPrompts() {
    return this.request("/admin/prompts");
  }

  async adminUpdatePrompt(agentType: string, data: { name?: string; role?: string; system_prompt?: string; is_active?: boolean }) {
    return this.request(`/admin/prompts/${agentType}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminCreateExample(agentType: string, data: { title: string; user_input: string; assistant_output: string; sort_order?: number }) {
    return this.request(`/admin/prompts/${agentType}/examples`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminUpdateExample(agentType: string, exampleId: string, data: Record<string, unknown>) {
    return this.request(`/admin/prompts/${agentType}/examples/${exampleId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminDeleteExample(agentType: string, exampleId: string) {
    return this.request(`/admin/prompts/${agentType}/examples/${exampleId}`, { method: "DELETE" });
  }

  async adminResetPrompt(agentType: string) {
    return this.request(`/admin/prompts/${agentType}/reset`, { method: "POST" });
  }

  // 测评系统
  async getAssessmentTemplates() {
    return this.request("/assessments/templates");
  }

  async getAssessmentTemplate(templateId: string) {
    return this.request(`/assessments/templates/${templateId}`);
  }

  async submitAssessment(templateId: string, childId: string, filledBy: string, answers: Array<{question_index: number; selected_value: string}>) {
    return this.request("/assessments/submit", {
      method: "POST",
      body: JSON.stringify({ template_id: templateId, child_id: childId, filled_by: filledBy, answers }),
    });
  }

  async getAssessmentRecords() {
    return this.request("/assessments/records");
  }

  async getAssessmentReport(reportId: string) {
    return this.request(`/assessments/reports/${reportId}`);
  }

  // 测评管理后台
  async adminCreateTemplate(data: { title: string; category: string; description?: string; target_age_min?: number; target_age_max?: number; questions_json: Array<unknown>; sort_order?: number }) {
    return this.request("/assessments/admin/templates", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async adminUpdateTemplate(templateId: string, data: { title: string; category: string; description?: string; target_age_min?: number; target_age_max?: number; questions_json: Array<unknown>; sort_order?: number }) {
    return this.request(`/assessments/admin/templates/${templateId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminGetAssessmentRecords() {
    return this.request("/assessments/admin/records");
  }

  async adminReviewReport(reportId: string, data: { consultant_notes?: string; final_content_json?: Record<string, unknown>; action: string }) {
    return this.request(`/assessments/admin/reports/${reportId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async adminImportAssessmentWorkbook(file: File) {
    const token = this.getToken();
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/assessments/admin/templates/import-xlsx`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ detail: "导入失败" }));
      throw new Error(error.detail || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // 咨询记录
  async getMyConsultationRecords() {
    return this.request("/consultation/records");
  }

  async getConsultationRecord(recordId: string) {
    return this.request(`/consultation/records/${recordId}`);
  }

  async adminGetConsultationRecords() {
    return this.request("/consultation/admin/records");
  }

  async adminCreateConsultationRecord(bookingId: string, childId?: string) {
    return this.request("/consultation/admin/records", {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId, child_id: childId || null }),
    });
  }

  async adminUploadTranscript(recordId: string, transcript: string) {
    return this.request(`/consultation/admin/records/${recordId}/transcript`, {
      method: "PUT",
      body: JSON.stringify({ transcript }),
    });
  }

  async adminUpdateConsultationSummary(recordId: string, summary: string, keyFindings?: string[]) {
    return this.request(`/consultation/admin/records/${recordId}/summary`, {
      method: "PUT",
      body: JSON.stringify({ summary, key_findings: keyFindings }),
    });
  }

  async adminUpdateConsultationPlan(recordId: string, planJson: Record<string, unknown>) {
    return this.request(`/consultation/admin/records/${recordId}/plan`, {
      method: "PUT",
      body: JSON.stringify({ plan_json: planJson }),
    });
  }

  async adminCompleteConsultation(recordId: string) {
    return this.request(`/consultation/admin/records/${recordId}/complete`, {
      method: "PUT",
    });
  }
}

export const api = new ApiClient();
