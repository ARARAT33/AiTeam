export interface Env {
 DB:D1Database; ASSETS:Fetcher; GITHUB_CLIENT_ID:string; GITHUB_CLIENT_SECRET:string;
 SESSION_SECRET:string; APP_ENCRYPTION_KEY:string; ADMIN_GITHUB_LOGIN?:string; ADMIN_GITHUB_EMAIL?:string;
 GITHUB_CALLBACK_URL?:string; MAX_TASK_ATTEMPTS?:string; MAX_ACTIVE_TASKS?:string;
}
export interface ModelRow {id:string;name:string;provider:string;model_id:string;base_url:string;encrypted_api_key:string;enabled:number;priority:number;daily_limit:number;daily_used:number;usage_day:string;max_concurrency:number;active_count:number}
export interface TaskRow {id:string;title:string;prompt:string;status:string;priority:number;result:string|null;error:string|null;attempts:number;max_attempts:number;created_at:string;updated_at:string}
