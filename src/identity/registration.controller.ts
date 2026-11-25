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

  /**
   * Step 2 of registration (RF-4…RF-41). The body is validated by the service, not by a
   * schema, to follow the order of RF-37 and map every problem to the spec (plan Q3).
   */
  @Public()
  @Post('registrations')
  @HttpCode(HttpStatus.CREATED)
  async completeRegistration(@Body() body: unknown): Promise<void> {
    await this.registration.completeRegistration(body);
  }
}
