import { env } from '../config/env.js';
import { HttpError } from '../utils/httpError.js';

export function notFound(req, res, next) {
  next(new HttpError(404, 'NOT_FOUND', 'ไม่พบ API ที่ร้องขอ'));
}

export function errorHandler(error, req, res, next) {
  const status = Number.isInteger(error.status) ? error.status : 500;
  const code = error.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR');
  if (status >= 500) {
    console.error(JSON.stringify({
      level: 'error',
      request_id: req.id,
      method: req.method,
      path: req.originalUrl,
      message: error.message,
      code: error.code,
    }));
  }
  const body = {
    error: code,
    code,
    message: status >= 500 && env.NODE_ENV === 'production' ? 'เกิดข้อผิดพลาดภายในระบบ' : error.message,
    request_id: req.id,
  };
  if (error.details && status < 500) body.details = error.details;
  res.status(status).json(body);
}
