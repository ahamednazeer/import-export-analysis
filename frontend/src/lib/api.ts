const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

class ApiClient {
    private token: string | null = null;

    setToken(token: string) {
        this.token = token;
        if (typeof window !== 'undefined') {
            localStorage.setItem('token', token);
        }
    }

    getToken() {
        if (!this.token && typeof window !== 'undefined') {
            this.token = localStorage.getItem('token');
        }
        return this.token;
    }

    clearToken() {
        this.token = null;
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
        }
    }

    private async request(endpoint: string, options: RequestInit = {}) {
        const token = this.getToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(options.headers as Record<string, string>),
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers,
            cache: 'no-store',
        });

        if (!response.ok) {
            // Handle auth errors (401 Unauthorized or 422 Unprocessable Entity for invalid token structure)
            if (response.status === 401 || response.status === 422) {
                this.clearToken();
                if (typeof window !== 'undefined') {
                    // Redirect to login if on a protected page
                    if (window.location.pathname !== '/') {
                        window.location.href = '/';
                    }
                }
            }

            const error = await response.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(error.message || 'Request failed');
        }

        return response.json();
    }

    // Auth
    async login(username: string, password: string) {
        const data = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });
        this.setToken(data.access_token);
        return data;
    }

    async register(userData: any) {
        return this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    }

    async getCurrentUser() {
        return this.request('/auth/me');
    }

    // Products
    async getProducts(category?: string, search?: string) {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (search) params.append('search', search);
        const query = params.toString() ? `?${params.toString()}` : '';
        return this.request(`/products${query}`);
    }

    async getProduct(id: number) {
        return this.request(`/products/${id}`);
    }

    async createProduct(data: any) {
        return this.request('/products', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    // Requests
    async getRequests(status?: string) {
        const query = status ? `?status=${status}` : '';
        return this.request(`/requests${query}`);
    }

    async getRequest(id: number) {
        return this.request(`/requests/${id}`);
    }

    async createRequest(data: any) {
        return this.request('/requests', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getRecommendation(requestId: number) {
        return this.request(`/requests/${requestId}/recommendation`);
    }

    async confirmRequest(requestId: number, action: string, notes?: string) {
        return this.request(`/requests/${requestId}/confirm`, {
            method: 'POST',
            body: JSON.stringify({ action, notes }),
        });
    }

    async startPicking(requestId: number) {
        return this.request(`/requests/${requestId}/start-picking`, {
            method: 'POST',
        });
    }

    // Warehouses
    async getWarehouses() {
        return this.request('/warehouses');
    }

    async getWarehouse(id: number) {
        return this.request(`/warehouses/${id}`);
    }

    async createWarehouse(data: any) {
        return this.request('/warehouses', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async getWarehouseStock(warehouseId: number) {
        return this.request(`/warehouses/${warehouseId}/stock`);
    }

    async updateWarehouseStock(warehouseId: number, stockData: any) {
        return this.request(`/warehouses/${warehouseId}/stock`, {
            method: 'POST',
            body: JSON.stringify(stockData),
        });
    }

    async deleteWarehouseStock(warehouseId: number, stockId: number) {
        return this.request(`/warehouses/${warehouseId}/stock/${stockId}`, {
            method: 'DELETE',
        });
    }

    async getProductStock(productId: number) {
        return this.request(`/warehouses/stock/product/${productId}`);
    }

    async getMyPickTasks() {
        return this.request('/warehouses/my/pick-tasks');
    }

    async getMyCompletedTasks() {
        return this.request('/warehouses/my/completed-tasks');
    }

    async pickReservation(reservationId: number) {
        return this.request(`/warehouses/pick/${reservationId}`, {
            method: 'POST',
        });
    }

    async getWarehouseInspectionTasks() {
        return this.request('/inspection/warehouse/tasks');
    }

    async getProductSuppliers(productId: number) {
        return this.request(`/suppliers/products/${productId}`);
    }

    // Suppliers
    async getSuppliers() {
        return this.request('/suppliers');
    }

    async getSupplier(id: number) {
        return this.request(`/suppliers/${id}`);
    }

    async createSupplier(data: any) {
        return this.request('/suppliers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async addSupplierProduct(supplierId: number, data: any) {
        return this.request(`/suppliers/${supplierId}/products`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async removeSupplierProduct(supplierId: number, productId: number) {
        return this.request(`/suppliers/${supplierId}/products/${productId}`, {
            method: 'DELETE',
        });
    }

    // Inspection
    async uploadInspectionImage(formData: FormData) {
        const token = this.getToken();
        const headers: Record<string, string> = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_URL}/inspection/upload`, {
            method: 'POST',
            headers,
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ message: 'Upload failed' }));
            throw new Error(error.message || 'Upload failed');
        }

        return response.json();
    }

    async getInspectionResult(imageId: number) {
        return this.request(`/inspection/${imageId}/result`);
    }

    async getRequestImages(requestId: number) {
        return this.request(`/inspection/request/${requestId}`);
    }

    async overrideInspection(imageId: number, result: string, reason: string) {
        return this.request(`/inspection/${imageId}/override`, {
            method: 'POST',
            body: JSON.stringify({ result, reason }),
        });
    }

    // Procurement
    async getPendingProcurement() {
        return this.request('/procurement/pending');
    }

    async resolveProcurement(requestId: number, action: string, data?: any) {
        return this.request(`/procurement/resolve/${requestId}`, {
            method: 'POST',
            body: JSON.stringify({ action, ...data }),
        });
    }

    async getReplacementOptions(requestId: number) {
        return this.request(`/procurement/replacement-options/${requestId}`);
    }

    async markReadyForAllocation(requestId: number) {
        return this.request(`/procurement/ready-for-allocation/${requestId}`, {
            method: 'POST',
        });
    }

    async autoResolveBlocked(requestId: number) {
        return this.request(`/procurement/auto-resolve-blocked/${requestId}`, {
            method: 'POST',
        });
    }

    // Logistics
    async getReadyForAllocation() {
        return this.request('/logistics/ready-for-allocation');
    }

    async allocateShipments(requestId: number, allocations: any[]) {
        return this.request(`/logistics/allocate/${requestId}`, {
            method: 'POST',
            body: JSON.stringify({ allocations }),
        });
    }

    async getShipments(status?: string) {
        const query = status ? `?status=${status}` : '';
        return this.request(`/logistics/shipments${query}`);
    }

    async getShipment(id: number) {
        return this.request(`/logistics/shipments/${id}`);
    }

    async dispatchShipment(shipmentId: number, carrier: string, trackingUrl?: string) {
        return this.request(`/logistics/shipments/${shipmentId}/dispatch`, {
            method: 'POST',
            body: JSON.stringify({ carrier, trackingUrl }),
        });
    }

    async updateShipmentStatus(shipmentId: number, status: string, deliveredTo?: string, estimatedDeliveryDate?: string) {
        return this.request(`/logistics/shipments/${shipmentId}/update-status`, {
            method: 'POST',
            body: JSON.stringify({ status, deliveredTo, estimatedDeliveryDate }),
        });
    }

    async trackShipment(trackingNumber: string) {
        return this.request(`/logistics/track/${trackingNumber}`);
    }

    // Admin
    async getUsers(role?: string) {
        const query = role ? `?role=${role}` : '';
        return this.request(`/admin/users${query}`);
    }

    async createUser(userData: any) {
        return this.request('/admin/users', {
            method: 'POST',
            body: JSON.stringify(userData),
        });
    }

    async updateUser(userId: number, userData: any) {
        return this.request(`/admin/users/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify(userData),
        });
    }

    async getSystemStats() {
        return this.request('/admin/stats');
    }

    async deleteUser(userId: number) {
        return this.request(`/admin/users/${userId}`, {
            method: 'DELETE',
        });
    }


    // Joint Wait Model - Completion Status
    async getCompletionStatus(requestId: number) {
        return this.request(`/procurement/completion-status/${requestId}`);
    }

    // Supplier Confirmation (Joint Wait Model)
    async getMyPendingSupplierReservations() {
        return this.request('/suppliers/my/pending-reservations');
    }

    async confirmSupplierAvailability(reservationId: number, notes?: string) {
        return this.request(`/suppliers/confirm-availability/${reservationId}`, {
            method: 'POST',
            body: JSON.stringify({ notes }),
        });
    }

    async getMyConfirmedSupplierReservations() {
        return this.request('/suppliers/my/confirmed-reservations');
    }

    async markSourceReady(reservationId: number, reason: string) {
        return this.request('/procurement/mark-source-ready', {
            method: 'POST',
            body: JSON.stringify({ reservationId, reason }),
        });
    }

    // AI Assistant
    async chatWithAssistant(message: string) {
        return this.request('/assistant/chat', {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
    }

    async getAssistantContext() {
        return this.request('/assistant/context');
    }

    async getAssistantHistory() {
        return this.request('/assistant/history');
    }

    async clearAssistantHistory() {
        return this.request('/assistant/history', {
            method: 'DELETE',
        });
    }

    async getAssistantWelcome() {
        return this.request('/assistant/welcome');
    }
}

export const api = new ApiClient();
