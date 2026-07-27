function validDateValue(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return value;
}

export function latestInteractionDate(interactions, legacyFallback = null) {
  let latest = null;

  for (const interaction of interactions || []) {
    const occurredOn = validDateValue(interaction?.occurredOn);
    if (occurredOn && (!latest || occurredOn > latest)) {
      latest = occurredOn;
    }
  }

  return latest || validDateValue(legacyFallback);
}
