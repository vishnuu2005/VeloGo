import {
  AuthResponse,
  CategoryEstimate,
  FareEstimateResponse,
  PaymentReceipt,
  Ride,
  User,
  CaptainSummary,
  AdminOverview,
  SupportTicket,
  FareConfiguration,
  Coupon,
  VehicleCategory,
  PaymentMethod,
  VerificationStatus,
} from '../types';

const API_BASE = '/api/v1';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('velogo_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    const refreshToken = localStorage.getItem('velogo_refresh_token');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const authData = (await refreshRes.json()) as AuthResponse;
          localStorage.setItem('velogo_token', authData.accessToken);
          // Retry original request
          const retryHeaders = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authData.accessToken}`,
            ...options.headers,
          };
          const retryResponse = await fetch(`${API_BASE}${path}`, {
            ...options,
            headers: retryHeaders,
          });
          if (!retryResponse.ok) {
            const err = await retryResponse.json().catch(() => ({ message: 'Request failed' }));
            throw new Error(err.message || 'Request failed');
          }
          return retryResponse.json();
        }
      } catch (e) {
        localStorage.removeItem('velogo_token');
        localStorage.removeItem('velogo_refresh_token');
        localStorage.removeItem('velogo_user');
      }
    }
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ message: 'Network request failed' }));
    throw new Error(errorBody.message || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const api = {
  auth: {
    login: (credentials: { emailOrPhone: string; password: string }) =>
      request<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      }),

    registerCustomer: (data: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
      emergencyContactName?: string;
      emergencyContactPhone?: string;
    }) =>
      request<AuthResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    registerCaptain: (data: {
      fullName: string;
      email: string;
      phone: string;
      password: string;
      drivingLicenseNumber: string;
      vehicleCategory: VehicleCategory;
      vehicleModel: string;
      registrationNumber: string;
      vehicleColor: string;
    }) =>
      request<AuthResponse>('/auth/register/captain', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getMe: () => request<User>('/auth/me'),

    logout: (refreshToken?: string) =>
      request<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),
  },

  rides: {
    estimate: (data: {
      pickupLat: number;
      pickupLng: number;
      pickupAddress: string;
      destLat: number;
      destLng: number;
      destAddress: string;
      couponCode?: string;
    }) =>
      request<FareEstimateResponse>('/rides/estimate', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    book: (data: {
      pickupLat: number;
      pickupLng: number;
      pickupAddress: string;
      destLat: number;
      destLng: number;
      destAddress: string;
      vehicleCategory: VehicleCategory;
      paymentMethod: PaymentMethod;
      couponCode?: string;
    }) =>
      request<Ride>('/rides', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getById: (rideId: string) => request<Ride>(`/rides/${rideId}`),

    cancel: (rideId: string, reason: string) =>
      request<Ride>(`/rides/${rideId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),

    getMyHistory: () => request<Ride[]>('/rides/history'),
  },

  captain: {
    getProfile: () => request<CaptainSummary>('/captains/me'),

    toggleAvailability: (online: boolean) =>
      request<CaptainSummary>('/captains/availability', {
        method: 'PATCH',
        body: JSON.stringify({ online }),
      }),

    updateLocation: (lat: number, lng: number, heading?: number) =>
      request<void>('/captains/location', {
        method: 'POST',
        body: JSON.stringify({ latitude: lat, longitude: lng, heading }),
      }),

    getActiveRide: () => request<Ride | null>('/captains/rides/active'),

    getHistory: () => request<Ride[]>('/captains/rides/history'),

    acceptRide: (rideId: string) =>
      request<Ride>(`/captains/rides/${rideId}/accept`, {
        method: 'POST',
      }),

    arriveAtPickup: (rideId: string) =>
      request<Ride>(`/captains/rides/${rideId}/arrive`, {
        method: 'POST',
      }),

    startTrip: (rideId: string, otpCode: string) =>
      request<Ride>(`/captains/rides/${rideId}/start`, {
        method: 'POST',
        body: JSON.stringify({ otpCode }),
      }),

    completeTrip: (rideId: string) =>
      request<Ride>(`/captains/rides/${rideId}/complete`, {
        method: 'POST',
      }),
  },

  customer: {
    getActiveRide: () => request<Ride | null>('/customers/me/active-ride'),
    getHistory: () => request<Ride[]>('/customers/me/rides'),
    getNotifications: () => request<any[]>('/customers/me/notifications'),
  },

  payments: {
    createOrder: (rideId: string, paymentMethod: PaymentMethod) =>
      request<any>('/payments/order', {
        method: 'POST',
        body: JSON.stringify({ rideId, paymentMethod }),
      }),

    verify: (data: {
      paymentId: string;
      razorpayPaymentId?: string;
      razorpayOrderId?: string;
      razorpaySignature?: string;
      simulatedSuccess: boolean;
    }) =>
      request<PaymentReceipt>('/payments/verify', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getReceipt: (rideId: string) => request<PaymentReceipt>(`/payments/receipt/${rideId}`),
  },

  support: {
    submitRating: (rideId: string, score: number, feedback?: string) =>
      request<any>('/support/rating', {
        method: 'POST',
        body: JSON.stringify({ rideId, score, feedback }),
      }),

    createTicket: (data: { rideId?: string; subject: string; category: string; description: string }) =>
      request<SupportTicket>('/support/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getMyTickets: () => request<SupportTicket[]>('/support/tickets/me'),
  },

  admin: {
    getOverview: () => request<AdminOverview>('/admin/overview'),

    getCustomers: (page = 0, size = 20) => request<any>(`/admin/customers?page=${page}&size=${size}`),

    updateCustomerStatus: (userId: string, active: boolean, reason?: string) =>
      request<User>(`/admin/customers/${userId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ active, reason }),
      }),

    getCaptains: (status?: VerificationStatus, page = 0, size = 20) => {
      const q = status ? `status=${status}&` : '';
      return request<any>(`/admin/captains?${q}page=${page}&size=${size}`);
    },

    verifyCaptain: (captainId: string, status: VerificationStatus, reason?: string) =>
      request<any>(`/admin/captains/${captainId}/verification`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reason }),
      }),

    getAllRides: (page = 0, size = 20) => request<any>(`/admin/rides?page=${page}&size=${size}`),

    getPricing: () => request<FareConfiguration[]>('/admin/pricing'),

    updatePricing: (category: VehicleCategory, data: Partial<FareConfiguration>) =>
      request<FareConfiguration>(`/admin/pricing/${category}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),

    getCoupons: () => request<Coupon[]>('/admin/coupons'),

    createCoupon: (data: Partial<Coupon> & { validDays?: number }) =>
      request<Coupon>('/admin/coupons', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getAuditLogs: (page = 0, size = 25) => request<any>(`/admin/audit-logs?page=${page}&size=${size}`),

    getAllTickets: (page = 0, size = 20) => request<any>(`/support/admin/tickets?page=${page}&size=${size}`),

    respondTicket: (ticketId: string, adminResponse: string, status: string) =>
      request<SupportTicket>(`/support/admin/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ adminResponse, status }),
      }),
  },
};
