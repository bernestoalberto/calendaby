import { z } from 'zod'

/** `review` means the email looked like an appointment but no usable time was found. */
export const AppointmentStatus = z.enum(['proposed', 'review', 'confirmed', 'dismissed'])

export const Appointment = z.object({
  id: z.string().min(1), // gmail:<message id>, so importing the same email twice is a no-op
  title: z.string().min(1),
  provider: z.string().optional(),
  location: z.string().optional(),
  startsAt: z.number().int().positive().optional(), // epoch ms
  endsAt: z.number().int().positive().optional(),
  status: AppointmentStatus,
})
export type Appointment = z.infer<typeof Appointment>
