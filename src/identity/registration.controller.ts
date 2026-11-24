import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../http/public.decorator.js';
import { emailSchema } from './domain/email.js';
import { RegistrationService } from './registration.service.js';

const registrationRequestSchema = z.object({ email: emailSchema });

@Controller('auth')
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  /**
   * Step 1 of registration (RF-1, RF-6, RF-7). Always the same answer for a valid email:
   * whether a code, a notice or nothing is sent is decided after responding (RNF-2).
   */
  @Public()
  @Post('registration-requests')
  @HttpCode(HttpStatus.ACCEPTED)
  requestRegistration(
    @Body({ schema: registrationRequestSchema })
    body: z.output<typeof registrationRequestSchema>,
  ): void {
    this.registration.requestRegistration(body.email);
  }
}
