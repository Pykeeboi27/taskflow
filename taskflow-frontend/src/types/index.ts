export type User = {
	id: string;
	email: string;
};

export type TaskStatus = "pending" | "completed";

export type Task = {
	id: string;
	title: string;
	description: string | null;
	status: TaskStatus;
	created_at: string;
	updated_at: string;
};

export type TaskListResponse = {
	items: Task[];
	total: number;
	page: number;
	limit: number;
	pages: number;
};

export type AuthTokens = {
	access_token: string;
	refresh_token: string;
};

export type AuthResponse = AuthTokens & {
	user_id: string;
	email: string;
};

export type ApiError = {
	error: string;
	message: string;
	field?: string;
};

export type CreateTaskPayload = {
	title: string;
	description?: string;
};

export type UpdateTaskPayload = {
	title?: string;
	description?: string;
	status?: TaskStatus;
};