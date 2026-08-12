import type { components } from './generated/schema';

export type EventType = components['schemas']['EventType'];
export type Slot = components['schemas']['Slot'];
export type SlotStatus = components['schemas']['SlotStatus'];
export type BookingRequest = components['schemas']['BookingRequest'];
export type BookingConfirmation = components['schemas']['BookingConfirmation'];
export type AdminBooking = components['schemas']['AdminBooking'];
export type EventTypeInput = components['schemas']['EventTypeInput'];
export type ErrorBody = components['schemas']['ErrorBody'];
export type ErrorCode = components['schemas']['ErrorCode'];
export type FieldError = components['schemas']['FieldError'];
export type NotFoundError = components['schemas']['NotFoundError'];
export type ValidationError = components['schemas']['ValidationError'];
export type SlotConflictError = components['schemas']['SlotConflictError'];

export type { components, operations, paths } from './generated/schema';
