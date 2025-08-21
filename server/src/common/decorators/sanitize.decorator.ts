import { Transform } from 'class-transformer';
import { sanitize } from 'class-sanitizer';

export function Sanitize(): PropertyDecorator {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return sanitize(value);
    }
    return value;
  });
}

export function Trim(): PropertyDecorator {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  });
}

export function ToLowerCase(): PropertyDecorator {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase();
    }
    return value;
  });
}

export function ToUpperCase(): PropertyDecorator {
  return Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toUpperCase();
    }
    return value;
  });
}
