import { z } from "zod";
import { AppError } from "./api";

const VALID_FREQ = new Set(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
const VALID_BYDAY = new Set(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);

// Positive integer parts: INTERVAL, COUNT
const POS_INT_RE = /^\d+$/;

// UTC basic ISO date for UNTIL: YYYYMMDDTHHmmssZ
const UNTIL_RE = /^\d{8}T\d{6}Z$/;

// BYDAY values: comma-separated, each optionally prefixed with +/-N ordinal
const BYDAY_PART_RE = /^(?:[+-]?\d)?([A-Z]{2})$/;

/**
 * Validates and normalises a raw RRULE property value (the part after "RRULE:").
 * Accepts the subset defined for Stage 1: FREQ, INTERVAL, COUNT, UNTIL, BYDAY.
 * Throws AppError on anything outside that grammar.
 */
function parseRRule(raw: string): string {
  const parts = raw.split(";").filter(Boolean);
  let hasFreq = false;

  for (const part of parts) {
    const eqIdx = part.indexOf("=");
    if (eqIdx === -1) {
      throw new AppError(`Invalid RRULE part: "${part}"`, "INVALID_RRULE", 400);
    }
    const key = part.slice(0, eqIdx).toUpperCase();
    const val = part.slice(eqIdx + 1);

    switch (key) {
      case "FREQ":
        if (!VALID_FREQ.has(val.toUpperCase())) {
          throw new AppError(
            `FREQ must be one of DAILY, WEEKLY, MONTHLY, YEARLY; got "${val}"`,
            "INVALID_RRULE",
            400,
          );
        }
        hasFreq = true;
        break;

      case "INTERVAL": {
        const n = Number(val);
        if (!POS_INT_RE.test(val) || n < 1) {
          throw new AppError(
            `INTERVAL must be a positive integer; got "${val}"`,
            "INVALID_RRULE",
            400,
          );
        }
        break;
      }

      case "COUNT": {
        const n = Number(val);
        if (!POS_INT_RE.test(val) || n < 1) {
          throw new AppError(
            `COUNT must be a positive integer; got "${val}"`,
            "INVALID_RRULE",
            400,
          );
        }
        break;
      }

      case "UNTIL":
        if (!UNTIL_RE.test(val)) {
          throw new AppError(
            `UNTIL must be UTC basic-ISO (YYYYMMDDTHHmmssZ); got "${val}"`,
            "INVALID_RRULE",
            400,
          );
        }
        break;

      case "BYDAY": {
        const days = val.split(",");
        for (const d of days) {
          const m = BYDAY_PART_RE.exec(d.trim());
          if (!m || !VALID_BYDAY.has(m[1])) {
            throw new AppError(
              `Invalid BYDAY value "${d}"`,
              "INVALID_RRULE",
              400,
            );
          }
        }
        break;
      }

      default:
        throw new AppError(
          `Unsupported RRULE part "${key}" — Stage 1 supports FREQ, INTERVAL, COUNT, UNTIL, BYDAY only`,
          "INVALID_RRULE",
          400,
        );
    }
  }

  if (!hasFreq) {
    throw new AppError("RRULE must contain FREQ", "INVALID_RRULE", 400);
  }

  return raw;
}

export const rruleSchema = z
  .string()
  .min(1)
  .transform((val) => parseRRule(val));

// iCal grammar requires UNTIL to be DATE-only (no time component) when the
// event is all-day. The DB always stores the datetime form, so strip here.
export function normalizeRruleForUntilDateOnly(
  rrule: string,
  allDay: boolean,
): string {
  if (!allDay) return rrule;
  return rrule.replace(/UNTIL=(\d{8})T\d{6}Z/, "UNTIL=$1");
}
