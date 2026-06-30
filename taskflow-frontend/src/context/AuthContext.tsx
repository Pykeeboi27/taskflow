"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
} from "react";
import { useRouter } from "next/navigation";

import { login as apiLogin, logout as apiLogout, register as apiRegister } from "@/lib/api";
import type { AuthResponse, User } from "@/types";
import type { ReactNode } from "react";

type AuthContextValue = {
	user: User | null;
	isLoading: boolean;
	isAuthenticated: boolean;
	login: (email: string, password: string) => Promise<void>;
	register: (email: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
};

const AUTH_TOKEN_KEY = "auth_token";

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeBase64UrlPayload(token: string): Record<string, unknown> | null {
	const payload = token.split(".")[1];

	if (!payload) {
		return null;
	}

	try {
		const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
		const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
		const json = atob(paddedBase64);

		return JSON.parse(json) as Record<string, unknown>;
	} catch {
		return null;
	}
}

function userFromAuthResponse(response: AuthResponse): User {
	return {
		id: response.user_id,
		email: response.email,
	};
}

function userFromToken(token: string): User | null {
	const payload = decodeBase64UrlPayload(token);

	if (!payload) {
		return null;
	}

	const userId = typeof payload.user_id === "string" ? payload.user_id : null;
	const email = typeof payload.email === "string" ? payload.email : null;

	if (!userId || !email) {
		return null;
	}

	return {
		id: userId,
		email,
	};
}

type AuthProviderProps = Readonly<{
	children: ReactNode;
}>;

export function AuthProvider({ children }: AuthProviderProps) {
	const router = useRouter();
	const [user, setUser] = useState<User | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		const token = window.localStorage.getItem(AUTH_TOKEN_KEY);

		if (token) {
			setUser(userFromToken(token));
		}

		setIsLoading(false);
	}, []);

	const login = async (email: string, password: string) => {
		const response = await apiLogin(email, password);
		setUser(userFromAuthResponse(response));
	};

	const register = async (email: string, password: string) => {
		const response = await apiRegister(email, password);
		setUser(userFromAuthResponse(response));
	};

	const logout = async () => {
		try {
			await apiLogout();
		} finally {
			setUser(null);
			router.replace("/auth/login");
		}
	};

	return (
		<AuthContext.Provider
			value={{
				user,
				isLoading,
				isAuthenticated: user !== null,
				login,
				register,
				logout,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuthContext() {
	const context = useContext(AuthContext);

	if (!context) {
		throw new Error("useAuthContext must be used within an AuthProvider");
	}

	return context;
}