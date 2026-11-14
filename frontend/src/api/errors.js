export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status; // 404 no data · 422 bad params · 429 rate limited · 502 IRSA failed · 503 IRSA busy
  }
}
