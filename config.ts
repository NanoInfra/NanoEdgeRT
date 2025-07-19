export interface Config {
  available_port_start: number;
  available_port_end: number;
}

export interface ServiceConfig {
  name: string;
  path?: string;
  enable: boolean;
  jwt_check: boolean;
  permissions: {
    read: string[];
    write: string[];
    env: string[];
    run: string[];
  };
}

export interface FunctionConfig {
  name: string;
  path?: string;
  enable: boolean;
  returning_iter_behavior: "SSE" | "COLLECT" | "IGNORE";
}

const config: Config = {
  available_port_start: 18000,
  available_port_end: 19000,
};
