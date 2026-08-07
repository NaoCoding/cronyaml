export class CronYamlError extends Error {
  constructor(message: string, public readonly exitCode = 1) {
    super(message);
    this.name = "CronYamlError";
  }
}

export class ConfigError extends CronYamlError {
  constructor(message: string) {
    super(message, 1);
    this.name = "ConfigError";
  }
}

export class JobNotFoundError extends CronYamlError {
  constructor(name: string) {
    super(`Job not found: ${name}`);
    this.name = "JobNotFoundError";
  }
}
