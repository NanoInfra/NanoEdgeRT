// 类型定义文件
export interface Config {
  available_port_start: number;
  available_port_end: number;
  services: ServiceConfig[];
  jwt_secret?: string;
  main_port?: number;
}

export interface ServicePermissions {
  read: string[];
  write: string[];
  env: string[];
  run: string[];
}

export interface ServiceConfig {
  name: string;
  path?: string;
  enable: boolean;
  // checking JWT before running the service
  jwt_check: boolean;
  // commands to compile/bundle the service
  // pwd is the service path
  build_command?: string;
  // deno worker permissions
  permissions: ServicePermissions;
  // service code (for database-stored services)
  code?: string;
}

export interface ServiceInstance {
  config: ServiceConfig;
  worker?: Worker;
  port: number;
  status: "starting" | "running" | "stopped" | "error";
}

export interface RequestContext {
  serviceName: string;
  path: string;
  request: Request;
  authenticated?: boolean;
  user?: Record<string, unknown>;
}
