// Unit tests for auth middleware
// Tests: missing token → 401, expired/invalid token → 401, valid token → passes

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { Request, Response, NextFunction } from "express";

// Mock firebase-admin/auth before importing middleware
jest.mock("firebase-admin/auth", () => ({
  getAuth: jest.fn(() => ({
    verifyIdToken: jest.fn(),
  })),
}));

import { requireAuth } from "../auth.middleware";
import { getAuth } from "firebase-admin/auth";

function makeReq(authHeader?: string): Partial<Request> {
  return {
    headers:  { authorization: authHeader },
    method:   "POST",
    path:     "/chat",
    ip:       "127.0.0.1",
  };
}

function makeRes() {
  const res = {
    status:  jest.fn().mockReturnThis() as jest.MockedFunction<Response["status"]>,
    json:    jest.fn().mockReturnThis() as jest.MockedFunction<Response["json"]>,
  };
  return res as unknown as Response;
}

describe("requireAuth middleware", () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    next = jest.fn();
    jest.clearAllMocks();
  });

  it("rejects with 401 when Authorization header is missing", async () => {
    const req = makeReq(undefined);
    const res = makeRes();

    await requireAuth(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects with 401 when Authorization header is malformed (no Bearer prefix)", async () => {
    const req = makeReq("Basic sometoken");
    const res = makeRes();

    await requireAuth(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects with 401 when token is expired", async () => {
    const mockVerify = jest.fn().mockRejectedValue(
      Object.assign(new Error("Token expired"), { code: "auth/id-token-expired" }),
    );
    (getAuth as jest.MockedFunction<typeof getAuth>).mockReturnValue({
      verifyIdToken: mockVerify,
    } as ReturnType<typeof getAuth>);

    const req = makeReq("Bearer expired.token.here");
    const res = makeRes();

    await requireAuth(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects with 401 when token is invalid", async () => {
    const mockVerify = jest.fn().mockRejectedValue(
      Object.assign(new Error("Invalid token"), { code: "auth/argument-error" }),
    );
    (getAuth as jest.MockedFunction<typeof getAuth>).mockReturnValue({
      verifyIdToken: mockVerify,
    } as ReturnType<typeof getAuth>);

    const req = makeReq("Bearer invalid.token.here");
    const res = makeRes();

    await requireAuth(req as Request, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() and sets req.uid when token is valid", async () => {
    const mockVerify = jest.fn().mockResolvedValue({ uid: "user-abc-123" });
    (getAuth as jest.MockedFunction<typeof getAuth>).mockReturnValue({
      verifyIdToken: mockVerify,
    } as ReturnType<typeof getAuth>);

    const req = makeReq("Bearer valid.token.here") as Request;
    const res = makeRes();

    await requireAuth(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as Request & { uid: string }).uid).toBe("user-abc-123");
    expect(res.status).not.toHaveBeenCalled();
  });
});
