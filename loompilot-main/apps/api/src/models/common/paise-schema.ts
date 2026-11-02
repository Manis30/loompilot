import { isValidPaise } from "@loompilot/shared";

/**
 * Shared Mongoose schema definition for monetary paise fields.
 * Guarantees that every *Paise field is:
 * 1. An integer (rejects 1.5, NaN, floats)
 * 2. Greater than or equal to 0, unless allowSigned is explicitly set to true (e.g. deltaPaise).
 */
export function paiseField(options: {
  required?: boolean;
  default?: number;
  allowSigned?: boolean;
} = {}) {
  return {
    type: Number,
    required: options.required ?? false,
    default: options.default,
    validate: {
      validator: (v: number | null | undefined) => {
        if (v === null || v === undefined) return true;
        return isValidPaise(v, options.allowSigned ?? false);
      },
      message: (props: { value: any }) =>
        `${props.value} is not a valid integer paise amount${options.allowSigned ? "" : " (must be >= 0)"}`,
    },
  };
}

