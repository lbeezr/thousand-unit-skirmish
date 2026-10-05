// The host owns draft storage/history; this controller owns live dialog values.
export function createMapStudioFormState({ root, document }) {
  function capture() {
    const values = {};
    for (const field of root.querySelectorAll('input[id^="studio-"], select[id^="studio-"], textarea[id^="studio-"]')) {
      if (field.type === 'file') continue;
      values[field.id] = field.type === 'checkbox'
        ? { checked: field.checked }
        : { value: field.value };
    }
    return values;
  }

  function restore(values = {}) {
    for (const [id, state] of Object.entries(values)) {
      const field = document.getElementById(id);
      if (!field || !root.contains(field)) continue;
      if (field.type === 'checkbox') field.checked = state?.checked === true;
      else if (typeof state?.value === 'string') field.value = state.value;
    }
  }

  return { capture, restore };
}
