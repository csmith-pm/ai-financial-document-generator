import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../");

describe("Docker configuration", () => {
  it("Dockerfile exists and has multi-stage build", () => {
    const content = readFileSync(resolve(ROOT, "Dockerfile"), "utf-8");
    expect(content).toContain("FROM node:20-alpine AS builder");
    expect(content).toContain("FROM node:20-alpine AS production");
  });

  it("Dockerfile installs Chromium for Puppeteer", () => {
    const content = readFileSync(resolve(ROOT, "Dockerfile"), "utf-8");
    expect(content).toContain("chromium");
    expect(content).toContain("PUPPETEER_EXECUTABLE_PATH");
  });

  it("Dockerfile exposes port 4000", () => {
    const content = readFileSync(resolve(ROOT, "Dockerfile"), "utf-8");
    expect(content).toContain("EXPOSE 4000");
  });

  it("docker-compose.yml exists and defines all services", () => {
    const content = readFileSync(resolve(ROOT, "docker-compose.yml"), "utf-8");
    expect(content).toContain("api:");
    expect(content).toContain("worker:");
    expect(content).toContain("postgres:");
    expect(content).toContain("redis:");
  });

  it("docker-compose.yml uses postgres:16 and redis:7", () => {
    const content = readFileSync(resolve(ROOT, "docker-compose.yml"), "utf-8");
    expect(content).toContain("postgres:16-alpine");
    expect(content).toContain("redis:7-alpine");
  });

  it("docker-compose.yml has health check for postgres", () => {
    const content = readFileSync(resolve(ROOT, "docker-compose.yml"), "utf-8");
    expect(content).toContain("pg_isready");
    expect(content).toContain("condition: service_healthy");
  });

  it("docker-compose.yml maps port 4000 for api", () => {
    const content = readFileSync(resolve(ROOT, "docker-compose.yml"), "utf-8");
    expect(content).toContain('"4000:4000"');
  });
});
