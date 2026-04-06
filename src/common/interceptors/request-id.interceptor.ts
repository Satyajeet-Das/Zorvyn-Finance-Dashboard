// src/common/interceptors/request-id.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const requestId = (request.headers['x-request-id'] as string | undefined) ?? randomUUID();
    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);

    return next.handle();
  }
}
